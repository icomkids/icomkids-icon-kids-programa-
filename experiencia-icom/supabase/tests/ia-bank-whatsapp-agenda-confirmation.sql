begin;
do $test$ begin
 if has_table_privilege('authenticated','icom_bank_internal.whatsapp_agenda_drafts','SELECT') or has_table_privilege('anon','icom_bank_internal.whatsapp_agenda_drafts','INSERT') or has_function_privilege('authenticated','public.icom_bank_whatsapp_agenda_confirm(uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'Draft exposed to clients';end if;
end $test$;
set local role service_role;
do $test$
declare b public.icom_bank_whatsapp_bot;ids uuid[]:='{}';claims uuid[]:='{}';i integer;args jsonb;d jsonb;edited jsonb;original_version uuid;before_events bigint;before_bills bigint;before_ledger bigint;
begin
 select * into strict b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO';
 select count(*) into before_events from public.icom_bank_agenda_events;select count(*) into before_bills from public.icom_bank_payables;select count(*) into before_ledger from public.icom_bank_admin_entries;
 for i in 1..12 loop
 ids:=array_append(ids,gen_random_uuid());claims:=array_append(claims,gen_random_uuid());
 insert into public.icom_bank_whatsapp_inbox(id,owner_id,provider_id,sender,type,text,transcript,sent_at,status,claim_id,reply,created_at)
 values(ids[i],b.owner_id,'TEST_CONFIRM_ROLLBACK_'||ids[i]::text,case when i=12 then '5511999999999' else b.allowed_phones[1] end,'text',case when i=2 then '2' else '1' end,case when i=2 then '2' else '1' end,clock_timestamp(),'PROCESSANDO',claims[i],'Agenda: Confira os dados',clock_timestamp()+i*interval '1 second');
 end loop;
 args:=jsonb_build_object('p_expected',null,'p_payload',jsonb_build_object('id',ids[1],'title','TEST CONFIRM EVENT ROLLBACK','scope','PESSOAL','due_date','2026-10-19','due_time','19:00','notes','','status','PENDENTE','origin','WHATSAPP'));
 d:=public.icom_bank_whatsapp_agenda_prepare(ids[1],claims[1],'AGENDA',args,'[]','Agende reunião dia 19 do 10 às 19 horas');
 perform public.icom_bank_whatsapp_agenda_prepare(ids[1],claims[1],'AGENDA',args,'[]','Agende reunião dia 19 do 10 às 19 horas');
 if (select count(*) from public.icom_bank_agenda_events)<>before_events or (select count(*) from public.icom_bank_payables)<>before_bills then raise exception 'Preview created a record';end if;
 original_version:=(d->>'version')::uuid;
 begin perform public.icom_bank_whatsapp_agenda_confirm(ids[3],claims[3],ids[1],original_version);raise exception 'Undelivered preview approved';exception when raise_exception then if sqlerrm<>'BANK_AGENDA_CONFIRMATION_REQUIRED' then raise;end if;end;
 update public.icom_bank_whatsapp_inbox set reply_status='ACEITO' where id=ids[1];
 begin perform public.icom_bank_whatsapp_agenda_confirm(ids[12],claims[12],ids[1],original_version);raise exception 'Other sender approved';exception when insufficient_privilege then null;end;
 d:=public.icom_bank_whatsapp_agenda_edit(ids[2],claims[2],ids[1],original_version);
 begin perform public.icom_bank_whatsapp_agenda_confirm(ids[3],claims[3],ids[1],(d->>'version')::uuid);raise exception 'Editing draft approved';exception when raise_exception then if sqlerrm<>'BANK_AGENDA_CONFIRMATION_REQUIRED' then raise;end if;end;
 args:=jsonb_set(jsonb_set(args,'{p_payload,id}',to_jsonb(ids[4]::text)),'{p_payload,due_date}','"2026-10-20"');
 edited:=public.icom_bank_whatsapp_agenda_prepare(ids[4],claims[4],'AGENDA',args,'[]','Agende reunião dia 20 do 10 às 19 horas');
 begin perform public.icom_bank_whatsapp_agenda_confirm(ids[5],claims[5],ids[1],original_version);raise exception 'Old preview approved';exception when raise_exception then if sqlerrm<>'BANK_AGENDA_CONFIRMATION_REQUIRED' then raise;end if;end;
 update public.icom_bank_whatsapp_inbox set reply_status='ACEITO' where id=ids[4];
 perform public.icom_bank_whatsapp_agenda_confirm(ids[6],claims[6],ids[4],(edited->>'version')::uuid);
 perform public.icom_bank_whatsapp_agenda_confirm(ids[6],claims[6],ids[4],(edited->>'version')::uuid);
 if (select count(*) from public.icom_bank_agenda_events where id=ids[6] and due_date='2026-10-20')<>1 or (select count(*) from public.icom_bank_agenda_events)<>before_events+1 then raise exception 'Wrong or duplicate confirmed event';end if;
 begin perform public.icom_bank_whatsapp_agenda_confirm(ids[7],claims[7],ids[4],(edited->>'version')::uuid);raise exception 'Repeated new confirmation duplicated';exception when raise_exception then if sqlerrm<>'BANK_AGENDA_CONFIRMATION_REQUIRED' then raise;end if;end;
 args:=jsonb_build_object('p_expected',null,'p_payload',jsonb_build_object('id',ids[8],'scope','PESSOAL','person','AMBOS','title','TEST CONFIRM BILL ROLLBACK','category','Agenda','notes','','amount_cents',25000,'due_date','2026-10-20','months',1));
 d:=public.icom_bank_whatsapp_agenda_prepare(ids[8],claims[8],'CONTA_PAGAR',args,'[]','Lança uma conta de 250 reais para dia 20 CPF');
 if (select count(*) from public.icom_bank_payables)<>before_bills then raise exception 'Debt created before approval';end if;
 update public.icom_bank_whatsapp_inbox set reply_status='ACEITO' where id=ids[8];
 perform public.icom_bank_whatsapp_agenda_confirm(ids[9],claims[9],ids[8],(d->>'version')::uuid);
 if (select count(*) from public.icom_bank_payables where id=ids[9] and status='PENDENTE' and amount_cents=25000)<>1 then raise exception 'Debt not pending after approval';end if;
 args:=jsonb_set(args,'{p_payload,id}',to_jsonb(ids[10]::text));
 d:=public.icom_bank_whatsapp_agenda_prepare(ids[10],claims[10],'CONTA_PAGAR',args,'[]','Lança outra conta para dia 20 CPF');
 update icom_bank_internal.whatsapp_agenda_drafts set expires_at=clock_timestamp()-interval '1 second' where id=ids[10];
 if public.icom_bank_whatsapp_agenda_draft(ids[11],claims[11]) is not null then raise exception 'Expired preview returned';end if;
 begin perform public.icom_bank_whatsapp_agenda_confirm(ids[11],claims[11],ids[10],(d->>'version')::uuid);raise exception 'Expired preview approved';exception when raise_exception then if sqlerrm<>'BANK_AGENDA_CONFIRMATION_REQUIRED' then raise;end if;end;
 if (select count(*) from public.icom_bank_admin_entries)<>before_ledger then raise exception 'Confirmation changed cash';end if;
end $test$;
reset role;
rollback;