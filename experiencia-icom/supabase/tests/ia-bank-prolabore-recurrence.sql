begin;
create temp table qa_recurring as select gen_random_uuid() pj,gen_random_uuid() pf,gen_random_uuid() series,(select user_id from public.icom_bank_user_access where role='OWNER' and active order by user_id limit 1) actor,(select count(*) from public.icom_bank_admin_entries) ledger_count,(select coalesce(sum(amount_cents),0) from public.icom_bank_admin_entries) ledger_amount;
grant select on qa_recurring to authenticated;
select set_config('request.jwt.claim.sub',(select actor::text from qa_recurring),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select actor from qa_recurring),'role','authenticated')::text,true);
set local role authenticated;
do $test$
declare f record;p jsonb;r jsonb;second public.icom_bank_prolabore;first_version timestamptz;begin
 select * into f from qa_recurring;
 perform public.icom_bank_save_account(jsonb_build_object('id',f.pj,'name','QA recorrência PJ '||f.pj,'bank','Santander','scope','LOJA','active',true,'initial_cents',0,'initial_date',current_date),null);
 perform public.icom_bank_save_account(jsonb_build_object('id',f.pf,'name','QA recorrência PF '||f.pf,'bank','Itaú','scope','PESSOAL','active',true,'initial_cents',0,'initial_date',current_date),null);
 p:=jsonb_build_object('id',f.series,'source_account_id',f.pj,'target_account_id',f.pf,'reference_month','2026-01','first_due','2026-01-31','months',12,'first_received',false,'paid_at',null,'amount_cents',3000000,'notes','QA rollback');
 r:=public.icom_bank_schedule_prolabore(p);first_version:=(r->>'updated_at')::timestamptz;perform public.icom_bank_schedule_prolabore(p);
 if (select count(*) from public.icom_bank_prolabore where series_id=f.series)<>12 or exists(select 1 from public.icom_bank_prolabore where series_id=f.series and (status<>'PREVISTO' or paid_at is not null)) then raise exception 'Schedule duplicated or claimed receipt';end if;
 if not exists(select 1 from public.icom_bank_prolabore where series_id=f.series and sequence_number=2 and due_date='2026-02-28') then raise exception 'February day clipping failed';end if;
 begin update public.icom_bank_prolabore set status='REALIZADO',amount_cents=1,paid_at=current_date where id=f.series;raise exception 'Receipt changed amount';exception when others then if sqlerrm<>'BANK_PROLABORE_CHANGED' then raise;end if;end;
 r:=public.icom_bank_receive_prolabore(f.series,first_version,current_date);perform public.icom_bank_receive_prolabore(f.series,first_version,current_date);
 if (select count(*) from public.icom_bank_prolabore where series_id=f.series and status='REALIZADO')<>1 then raise exception 'Duplicate receipt';end if;
 select * into second from public.icom_bank_prolabore where series_id=f.series and sequence_number=2;
 r:=public.icom_bank_edit_prolabore_series(second.id,second.updated_at,jsonb_build_object('amount_cents',3500000,'source_account_id',f.pj,'target_account_id',f.pf,'notes','New value'));
 if (select amount_cents from public.icom_bank_prolabore where id=f.series)<>3000000 or (select count(*) from public.icom_bank_prolabore where series_id=f.series and status='PREVISTO' and amount_cents=3500000)<>11 then raise exception 'Received history modified or pending series not edited';end if;
 begin perform public.icom_bank_edit_prolabore_series(second.id,second.updated_at,'{}');raise exception 'Stale edit accepted';exception when others then if sqlerrm<>'BANK_PROLABORE_CHANGED' then raise;end if;end;
 begin perform public.icom_bank_cancel_prolabore(second.id,(r->>'updated_at')::timestamptz);raise exception 'Cancel without password';exception when others then if sqlerrm<>'BANK_DELETE_REQUIRED' then raise;end if;end;
 begin perform public.icom_bank_schedule_prolabore(p||jsonb_build_object('id',gen_random_uuid(),'source_account_id',f.pf,'target_account_id',f.pj));raise exception 'Invalid account scopes';exception when others then if sqlerrm<>'BANK_PROLABORE_ACCOUNTS' then raise;end if;end;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.icom_bank_user_access where role='VENDEDOR' and active limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.icom_bank_prolabore) then raise exception 'Seller sees recurring income';end if;
 begin perform public.icom_bank_schedule_prolabore('{}');raise exception 'Seller scheduled income';exception when others then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
end $test$;
reset role;
do $test$ declare f record;begin
 select * into f from qa_recurring;
 if f.ledger_count<>(select count(*) from public.icom_bank_admin_entries) or f.ledger_amount<>(select coalesce(sum(amount_cents),0) from public.icom_bank_admin_entries) then raise exception 'Consolidated ledger altered';end if;
 if (select count(*) from icom_bank_internal.account_history where entity='icom_bank_prolabore' and entity_id=f.series)<>2 then raise exception 'Replay duplicated audit';end if;
 if has_function_privilege('anon','public.icom_bank_schedule_prolabore(jsonb)','EXECUTE') then raise exception 'Anonymous schedule access';end if;
end $test$;
select 'PASS: 12 months, replay, February clipping, no premature receipt, single receipt, edits only upcoming entries, stale/password guards, seller isolation, unchanged ledger. Rolled back.' verification;
rollback;
