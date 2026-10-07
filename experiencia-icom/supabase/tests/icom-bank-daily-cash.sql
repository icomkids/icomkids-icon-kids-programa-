-- All fixtures and snapshots roll back; no real payments are recorded.
do $test$
declare owner_id uuid;other_id uuid;ctx jsonb;record_id uuid:=gen_random_uuid();out_id uuid:=gen_random_uuid();income_id uuid:=gen_random_uuid();payload jsonb;r public.icom_bank_cash_checks;m jsonb;before_count bigint;after_count bigint;begin
 select user_id into owner_id from public.icom_bank_user_access where active and role='OWNER' order by user_id limit 1;
 if owner_id is null then raise exception 'Owner fixture unavailable';end if;
 select count(*) into before_count from public.icom_bank_cash_checks;
 begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  if exists(select 1 from public.icom_bank_admin_entries where entry_date<='2000-01-01') then raise exception 'Fixture day already occupied';end if;
  ctx:=public.icom_bank_daily_context('2000-01-01');
  m:='{"opening_gross":0,"opening_available":0,"income":0,"expenses":0,"personal":0,"gross":0,"investor":0,"capital":0,"costs":0,"review":0,"available":0}';
  r:=public.icom_bank_save_cash_check(record_id,'2000-01-01',0,'',ctx->>'revision',m);
  if r.difference_cents<>0 or r.actor_id<>owner_id then raise exception 'Snapshot incorrect';end if;
  r:=public.icom_bank_save_cash_check(record_id,'2000-01-01',0,'',ctx->>'revision',m);
  if (select count(*) from public.icom_bank_cash_checks where id=record_id)<>1 then raise exception 'Duplicate snapshot';end if;
  begin
   perform public.icom_bank_save_cash_check(gen_random_uuid(),'2000-01-01',1,'',ctx->>'revision',m);
   raise exception 'Difference saved without note';
  exception when others then if sqlerrm<>'BANK_CHECK_NOTE' then raise;end if;end;
  perform public.icom_bank_save_admin_entry(jsonb_build_object('id',income_id,'kind','ENTRADA','scope','LOJA','entry_date','2000-01-01','description','TEST rollback income','category','','status','REALIZADO','amount_cents',1500000,'details','{}'::jsonb),null);
  begin
   perform public.icom_bank_save_cash_check(gen_random_uuid(),'2000-01-01',0,'',ctx->>'revision',m);
   raise exception 'Stale snapshot accepted';
  exception when others then if sqlerrm<>'BANK_CHECK_CHANGED' then raise;end if;end;
  payload:=jsonb_build_object('id',out_id,'kind','CUSTO','scope','LOJA','entry_date','2000-01-01','description','Pix · TEST rollback','category','Retirada / Pix','status','REALIZADO','amount_cents',45000,'details',jsonb_build_object('payment_method','PIX','notes','Destinatário: TEST rollback; Motivo: fixture'));
  perform public.icom_bank_record_withdrawal(payload);
  perform public.icom_bank_record_withdrawal(payload);
  if (select count(*) from public.icom_bank_admin_entries where id=out_id)<>1 then raise exception 'Duplicate withdrawal';end if;
  ctx:=public.icom_bank_daily_context('2000-01-01');
  m:=m||'{"income":1500000,"expenses":45000,"gross":1455000,"available":1455000}'::jsonb;
  r:=public.icom_bank_save_cash_check(gen_random_uuid(),'2000-01-01',1455000,'Fixture rollback',ctx->>'revision',m);
  if r.difference_cents<>0 then raise exception 'Withdrawal reconciliation incorrect';end if;
  begin
   perform public.icom_bank_record_withdrawal(payload||'{"amount_cents":0}'::jsonb);
   raise exception 'Zero withdrawal accepted';
  exception when others then if sqlerrm<>'BANK_WITHDRAWAL_INVALID' then raise;end if;end;
  select user_id into other_id from public.icom_bank_user_access where active and role<>'OWNER' order by user_id limit 1;
  if other_id is not null then
   perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
   begin perform public.icom_bank_daily_context('2000-01-01');raise exception 'Unauthorized read';exception when others then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
   begin perform public.icom_bank_record_withdrawal(payload);raise exception 'Unauthorized withdrawal';exception when others then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
   begin perform public.icom_bank_save_cash_check(gen_random_uuid(),'2000-01-01',0,'',ctx->>'revision',m);raise exception 'Unauthorized save';exception when others then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
  end if;
  perform set_config('request.jwt.claims','{}',true);
  begin perform public.icom_bank_daily_context('2000-01-01');raise exception 'Anonymous read';exception when others then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
  raise exception using errcode='P0002',message='ROLLBACK_DAILY_FIXTURES';
 exception when no_data_found then if sqlerrm<>'ROLLBACK_DAILY_FIXTURES' then raise;end if;end;
 select count(*) into after_count from public.icom_bank_cash_checks;
 if before_count<>after_count or exists(select 1 from public.icom_bank_admin_entries where id in(income_id,out_id)) then raise exception 'Fixtures did not roll back';end if;
 raise notice 'Daily cash, stale revision, duplicate requests, role checks and rollback verified';
end $test$;

-- API roles cannot edit/insert snapshots directly; Owner-only SELECT under RLS.
select relrowsecurity from pg_class where oid='public.icom_bank_cash_checks'::regclass;
select has_table_privilege('authenticated','public.icom_bank_cash_checks','INSERT') as direct_insert,
 has_table_privilege('authenticated','public.icom_bank_cash_checks','UPDATE') as direct_update,
 has_table_privilege('anon','public.icom_bank_cash_checks','SELECT') as anon_read,
 has_function_privilege('anon','public.icom_bank_save_cash_check(uuid,date,bigint,text,text,jsonb)','EXECUTE') as anon_save;
