begin;
create temp table qa_prolabore as select gen_random_uuid() pj,gen_random_uuid() pf,gen_random_uuid() transfer,gen_random_uuid() approval,(select user_id from public.icom_bank_user_access where role='OWNER' and active order by user_id limit 1) actor,(select count(*) from public.icom_bank_admin_entries) ledger_count,(select coalesce(sum(amount_cents),0) from public.icom_bank_admin_entries) ledger_amount;
grant select on qa_prolabore to authenticated;
select set_config('request.jwt.claim.sub',(select actor::text from qa_prolabore),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select actor from qa_prolabore),'role','authenticated')::text,true);
set local role authenticated;
do $test$
declare f record;p jsonb;r jsonb;begin
 select * into f from qa_prolabore;
 perform public.icom_bank_save_account(jsonb_build_object('id',f.pj,'name','QA PJ '||f.pj,'bank','Santander','scope','LOJA','active',true,'initial_cents',0,'initial_date',current_date),null);
 perform public.icom_bank_save_account(jsonb_build_object('id',f.pf,'name','QA PF '||f.pf,'bank','Itaú','scope','PESSOAL','active',true,'initial_cents',0,'initial_date',current_date),null);
 p:=jsonb_build_object('id',f.transfer,'source_account_id',f.pj,'target_account_id',f.pf,'reference_month',to_char(current_date,'YYYY-MM'),'paid_at',current_date,'amount_cents',3000000,'notes','QA rollback');
 r:=public.icom_bank_save_prolabore(p);perform public.icom_bank_save_prolabore(p);
 if (select count(*) from public.icom_bank_prolabore where id=f.transfer)<>1 or (r->>'owner_id')::uuid<>f.actor then raise exception 'Replay or identity failed';end if;
 begin perform public.icom_bank_save_prolabore(p||jsonb_build_object('amount_cents',3000001));raise exception 'Conflict accepted';exception when others then if sqlerrm<>'BANK_PROLABORE_CHANGED' then raise;end if;end;
 begin perform public.icom_bank_save_prolabore(p||jsonb_build_object('id',gen_random_uuid(),'source_account_id',f.pf,'target_account_id',f.pj));raise exception 'Reversed scopes accepted';exception when others then if sqlerrm<>'BANK_PROLABORE_ACCOUNTS' then raise;end if;end;
 begin perform public.icom_bank_save_prolabore(p||jsonb_build_object('id',gen_random_uuid(),'paid_at',current_date+1));raise exception 'Future accepted';exception when others then if sqlerrm<>'BANK_PROLABORE_INVALID' then raise;end if;end;
 begin update public.icom_bank_prolabore set amount_cents=1 where id=f.transfer;raise exception 'Settled amount edited';exception when others then if sqlerrm<>'BANK_PROLABORE_CHANGED' then raise;end if;end;
 begin update public.icom_bank_accounts set scope='PESSOAL' where id=f.pj;raise exception 'Historical scope changed';exception when others then if sqlerrm<>'BANK_PROLABORE_ACCOUNTS' then raise;end if;end;
 begin perform public.icom_bank_cancel_prolabore(f.transfer,(r->>'updated_at')::timestamptz);raise exception 'Cancellation accepted without password';exception when others then if sqlerrm<>'BANK_DELETE_REQUIRED' then raise;end if;end;
end $test$;
reset role;
-- An approval fixture validates the protected state transition without reading or changing a real password.
insert into icom_bank_internal.deletion_approvals(id,actor_id,operation,target_id,expires_at) select approval,actor,'cancel_prolabore',transfer,clock_timestamp()+interval '60 seconds' from qa_prolabore;
select set_config('request.headers',jsonb_build_object('x-bank-delete-approval',(select approval from qa_prolabore))::text,true);
set local role authenticated;
do $test$ declare f record;r jsonb;begin
 select * into f from qa_prolabore;
 r:=public.icom_bank_cancel_prolabore(f.transfer,(select updated_at from public.icom_bank_prolabore where id=f.transfer));
 if r->>'status'<>'CANCELADO' then raise exception 'Approved cancellation failed';end if;
 if (select sum(amount_cents) from public.icom_bank_prolabore where id=f.transfer and status='REALIZADO') is not null then raise exception 'Canceled value still active';end if;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.icom_bank_user_access where role='VENDEDOR' and active limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.icom_bank_prolabore) then raise exception 'Seller sees prolabore';end if;
 begin perform public.icom_bank_save_prolabore('{}');raise exception 'Seller write accepted';exception when others then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
end $test$;
reset role;
do $test$ declare f record;begin
 select * into f from qa_prolabore;
 if f.ledger_count<>(select count(*) from public.icom_bank_admin_entries) or f.ledger_amount<>(select coalesce(sum(amount_cents),0) from public.icom_bank_admin_entries) then raise exception 'Consolidated ledger changed';end if;
 if not exists(select 1 from icom_bank_internal.account_history where entity='icom_bank_prolabore' and entity_id=f.transfer and new_data->>'status'='CANCELADO') then raise exception 'Audit missing';end if;
 if has_table_privilege('anon','public.icom_bank_prolabore','SELECT') or has_table_privilege('authenticated','public.icom_bank_prolabore','DELETE') or has_function_privilege('anon','public.icom_bank_save_prolabore(jsonb)','EXECUTE') then raise exception 'Unexpected grant';end if;
end $test$;
select 'PASS: replay, amount immutability, PF/PJ validation, future rejection, password cancellation, seller isolation, audit, unchanged ledger. All fixtures rolled back.' verification;
rollback;
