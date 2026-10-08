begin;
create temp table ia_before as select count(*) n,coalesce(sum(amount_cents),0) total from public.icom_bank_admin_entries;
select set_config('request.jwt.claim.sub',(select user_id::text from public.icom_bank_user_access where role='OWNER' and active limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
set local role authenticated;
do $test$
declare a uuid:=gen_random_uuid(); income uuid:=gen_random_uuid(); p jsonb; r public.icom_bank_personal_wealth; first_version timestamptz; begin
p:=jsonb_build_object('id',a,'kind','ATIVO','name','QA patrimônio rollback','category','Poupança','record_date',(now() at time zone 'America/Sao_Paulo')::date,'amount_cents',100000,'debt_cents',0,'invested_cents',100000,'rate_percent',1.25,'rate_period','MENSAL','source_id',null,'notes','','active',true);
r:=public.icom_bank_save_personal_wealth(p,null);first_version:=r.updated_at;
if r.owner_id is distinct from auth.uid() or r.rate_percent<>1.25 then raise exception 'Create failed';end if;
r:=public.icom_bank_save_personal_wealth(p,null);
if (select count(*) from public.icom_bank_personal_wealth where id=a)<>1 then raise exception 'Replay duplicated';end if;
begin perform public.icom_bank_save_personal_wealth(p||jsonb_build_object('name','Different'),null);raise exception 'Missing conflict protection';exception when others then if sqlerrm<>'BANK_WEALTH_CHANGED' then raise;end if;end;
r:=public.icom_bank_save_personal_wealth(p||jsonb_build_object('name','QA updated'),first_version);
begin perform public.icom_bank_save_personal_wealth(p,first_version);raise exception 'Missing stale protection';exception when others then if sqlerrm<>'BANK_WEALTH_CHANGED' then raise;end if;end;
p:=p||jsonb_build_object('name','QA updated','active',false);
r:=public.icom_bank_save_personal_wealth(p,r.updated_at);if r.active then raise exception 'Archive failed';end if;
p:=p||jsonb_build_object('active',true);
r:=public.icom_bank_save_personal_wealth(p,r.updated_at);if not r.active then raise exception 'Restore failed';end if;
p:=jsonb_build_object('id',income,'kind','RENDA','name','QA income rollback','category','Poupança','record_date',(now() at time zone 'America/Sao_Paulo')::date,'amount_cents',1250,'debt_cents',0,'invested_cents',0,'rate_percent',null,'rate_period','MENSAL','source_id',a,'notes','','active',true);
r:=public.icom_bank_save_personal_wealth(p,null);if r.source_id<>a then raise exception 'Source failed';end if;
begin perform public.icom_bank_save_personal_wealth(p||jsonb_build_object('id',gen_random_uuid(),'source_id',income),null);raise exception 'Income source accepted';exception when others then if sqlerrm<>'BANK_WEALTH_INVALID' then raise;end if;end;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.icom_bank_user_access where role='VENDEDOR' and active limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
set local role authenticated;
do $test$ begin
 if (select count(*) from public.icom_bank_personal_wealth)<>0 then raise exception 'Seller sees personal records';end if;
 begin perform public.icom_bank_save_personal_wealth('{}',null);raise exception 'Seller write accepted';exception when others then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
end $test$;
reset role;
do $test$ begin if exists(select 1 from ia_before b where b.n<>(select count(*) from public.icom_bank_admin_entries) or b.total<>(select coalesce(sum(amount_cents),0) from public.icom_bank_admin_entries)) then raise exception 'Ledger changed';end if;end $test$;
select 'PASS: create, edit, replay, stale guard, archive, restore, source validation, seller isolation, unchanged ledger. Rolled back.' as verification;
rollback;
