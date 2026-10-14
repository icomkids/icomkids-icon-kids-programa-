begin;
do $test$
declare owner_id uuid;event_id uuid:=gen_random_uuid();future_id uuid:=gen_random_uuid();done_id uuid:=gen_random_uuid();bill_id uuid:=gen_random_uuid();future_bill uuid:=gen_random_uuid();p jsonb;row jsonb;before_count bigint;content jsonb;order_json jsonb;
begin
 select user_id into strict owner_id from public.icom_bank_user_access where role='OWNER' and active limit 1;
 perform set_config('agenda.test_owner',owner_id::text,true);perform set_config('agenda.test_event',event_id::text,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 select count(*) into before_count from public.icom_bank_admin_entries;
 p:=jsonb_build_object('id',event_id,'scope','LOJA','title','TEST AGENDA ROLLBACK','due_date',(now() at time zone 'America/Sao_Paulo')::date,'due_time','14:30','notes','','status','PENDENTE','origin','PAINEL');
 row:=public.icom_bank_save_agenda(p,null);
 perform public.icom_bank_save_agenda(p,null);
 if (select count(*) from public.icom_bank_agenda_events where id=event_id)<>1 then raise exception 'Duplicate event';end if;
 begin perform public.icom_bank_save_agenda(p||'{"title":"Changed"}',null);raise exception 'Missing stale check';exception when raise_exception then if sqlerrm<>'BANK_AGENDA_STALE' then raise;end if;end;
 perform public.icom_bank_save_agenda(p||jsonb_build_object('id',future_id,'due_date',((now() at time zone 'America/Sao_Paulo')::date+1)),null);
 perform public.icom_bank_save_agenda(p||jsonb_build_object('id',done_id,'status','CONCLUIDO'),null);
 perform public.icom_bank_save_expense(jsonb_build_object('id',bill_id,'scope','PESSOAL','person','AMBOS','title','TEST BILL TODAY ROLLBACK','category','Agenda','notes','','amount_cents',25000,'due_date',(now() at time zone 'America/Sao_Paulo')::date,'months',1),null);
 perform public.icom_bank_save_expense(jsonb_build_object('id',future_bill,'scope','LOJA','person','AMBOS','title','TEST BILL FUTURE ROLLBACK','category','Agenda','notes','','amount_cents',50000,'due_date',((now() at time zone 'America/Sao_Paulo')::date+1),'months',1),null);
 if (select count(*) from public.icom_bank_admin_entries)<>before_count then raise exception 'Scheduling changed ledger';end if;
 content:=icom_bank_internal.agenda_due_content(owner_id,(now() at time zone 'America/Sao_Paulo')::date);
 if not exists(select 1 from jsonb_array_elements(content->'events') e where e->>'id'=event_id::text) or exists(select 1 from jsonb_array_elements(content->'events') e where e->>'id' in(future_id::text,done_id::text)) then raise exception 'Wrong due commitments';end if;
 if not exists(select 1 from jsonb_array_elements(content->'bills') e where e->>'id'=bill_id::text) or exists(select 1 from jsonb_array_elements(content->'bills') e where e->>'id'=future_bill::text) then raise exception 'Wrong due bills';end if;
 order_json:='["clientes","dashboard","contratos","administrativo","agenda","parcelas","pagamentos","comprovantes","inadimplencia","veiculos","relatorios","funcionarios","configuracoes"]';
 perform public.icom_bank_save_preferences(jsonb_build_object('menu_order',order_json));
 if (select menu_order from public.icom_bank_user_preferences where user_id=owner_id)<>order_json then raise exception 'Menu order not preserved';end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('agenda.test_owner'),true);
do $test$ begin
 if not exists(select 1 from public.icom_bank_agenda_events where id=current_setting('agenda.test_event')::uuid) then raise exception 'Owner cannot see event';end if;
 if has_table_privilege('authenticated','public.icom_bank_agenda_notifications','INSERT') or has_function_privilege('authenticated','public.icom_bank_agenda_notification_claim()','EXECUTE') then raise exception 'Public notification write';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.icom_bank_agenda_events) or exists(select 1 from public.icom_bank_agenda_notifications) then raise exception 'Agenda owner leak';end if;
 begin perform public.icom_bank_save_agenda(jsonb_build_object('id',gen_random_uuid(),'title','Forbidden','scope','LOJA','due_date',current_date,'status','PENDENTE'),null);raise exception 'Wrong user wrote event';exception when insufficient_privilege then null;end;
end $test$;
reset role;
do $test$
declare b public.icom_bank_whatsapp_bot;m uuid:=gen_random_uuid();cl uuid:=gen_random_uuid();outgoing jsonb;
begin
 select * into strict b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO';
 insert into public.icom_bank_whatsapp_inbox(id,owner_id,provider_id,sender,type,text,transcript,sent_at,status,claim_id,reply)
 values(m,b.owner_id,'TEST_AGENDA_'||m::text,b.allowed_phones[1],'text','Agenda teste','Agenda teste',now(),'PROCESSANDO',cl,'Agenda: teste');
 perform set_config('agenda.test_message',m::text,true);perform set_config('agenda.test_claim',cl::text,true);
end $test$;
set local role service_role;
do $test$
declare m uuid:=current_setting('agenda.test_message')::uuid;cl uuid:=current_setting('agenda.test_claim')::uuid;p jsonb;r jsonb;c jsonb;first_job jsonb;
begin
 p:=jsonb_build_object('p_expected',null,'p_payload',jsonb_build_object('id',m,'title','TEST WHATSAPP AGENDA ROLLBACK','scope','PESSOAL','due_date',(now() at time zone 'America/Sao_Paulo')::date,'due_time',null,'notes','','status','PENDENTE','origin','WHATSAPP'));
 begin perform public.icom_bank_whatsapp_agenda_commit(m,gen_random_uuid(),'AGENDA',p);raise exception 'Wrong claim accepted';exception when raise_exception then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
 r:=public.icom_bank_whatsapp_agenda_commit(m,cl,'AGENDA',p);
 perform public.icom_bank_whatsapp_agenda_commit(m,cl,'AGENDA',p);
 if (select count(*) from public.icom_bank_agenda_events where id=m)<>1 then raise exception 'WhatsApp duplicated event';end if;
 if (select status from public.icom_bank_whatsapp_inbox where id=m)<>'RESOLVIDO' then raise exception 'Job not committed';end if;
 begin perform public.icom_bank_whatsapp_read_rows(m,cl,'icom_bank_agenda_events');raise exception 'Completed job retained read capability';exception when insufficient_privilege then null;end;
 -- A future WhatsApp debt must stay pending and never change cash.
 declare debt uuid:=gen_random_uuid();debt_claim uuid:=gen_random_uuid();b public.icom_bank_whatsapp_bot;before_count bigint;args jsonb;begin
 select * into strict b from public.icom_bank_whatsapp_bot where id=1;
 select count(*) into before_count from public.icom_bank_admin_entries;
 insert into public.icom_bank_whatsapp_inbox(id,owner_id,provider_id,sender,type,text,transcript,sent_at,status,claim_id,reply)
 values(debt,b.owner_id,'TEST_AGENDA_DEBT_'||debt::text,b.allowed_phones[1],'text','Debt test','Debt test',now(),'PROCESSANDO',debt_claim,'Agenda: conta teste');
 args:=jsonb_build_object('p_expected',null,'p_payload',jsonb_build_object('id',debt,'scope','PESSOAL','person','AMBOS','title','TEST WHATSAPP BILL ROLLBACK','category','Agenda','notes','Registro por WhatsApp','amount_cents',10000,'due_date',((now() at time zone 'America/Sao_Paulo')::date+1),'months',1));
 perform public.icom_bank_whatsapp_agenda_commit(debt,debt_claim,'CONTA_PAGAR',args);
 perform public.icom_bank_whatsapp_agenda_commit(debt,debt_claim,'CONTA_PAGAR',args);
 if (select count(*) from public.icom_bank_payables where id=debt and status='PENDENTE')<>1 or (select count(*) from public.icom_bank_admin_entries)<>before_count then raise exception 'WhatsApp debt changed cash or duplicated';end if;
 end;
 first_job:=public.icom_bank_agenda_notification_claim();
 if extract(hour from clock_timestamp() at time zone 'America/Sao_Paulo') between 8 and 19 then
  if first_job is null then raise exception 'Due notification not claimed';end if;
  if public.icom_bank_agenda_notification_claim() is not null then raise exception 'Concurrent notification claimed twice';end if;
  perform public.icom_bank_agenda_notification_finish((first_job->>'id')::uuid,(first_job->>'claim_id')::uuid,'FALHOU');
  if public.icom_bank_agenda_notification_claim() is not null then raise exception 'Retry ignored cooldown';end if;
  update public.icom_bank_agenda_notifications set next_attempt_at=clock_timestamp()-interval '1 second' where id=(first_job->>'id')::uuid;
  first_job:=public.icom_bank_agenda_notification_claim();
  if first_job is null or (first_job->>'attempts')::integer<>2 then raise exception 'Definite failure not retried once';end if;
  perform public.icom_bank_agenda_notification_finish((first_job->>'id')::uuid,(first_job->>'claim_id')::uuid,'INCERTO');
  if public.icom_bank_agenda_notification_claim() is not null then raise exception 'Uncertain delivery retried';end if;
  update public.icom_bank_agenda_notifications set status='ENVIANDO',attempts=3,updated_at=clock_timestamp()-interval '11 minutes' where id=(first_job->>'id')::uuid;
  if public.icom_bank_agenda_notification_claim() is not null then raise exception 'Expired third send duplicated';end if;
  if (select status from public.icom_bank_agenda_notifications where id=(first_job->>'id')::uuid)<>'INCERTO' then raise exception 'Expired send not recovered';end if;
 else if first_job is not null then raise exception 'Notification outside morning/day window';end if;end if;
end $test$;
reset role;
rollback;