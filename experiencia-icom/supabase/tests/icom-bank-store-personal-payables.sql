-- Generated fixtures are confined to the inner subtransaction and rolled back.
do $$ declare owner_id uuid;other_id uuid;root_id uuid:=gen_random_uuid();bill_id uuid:=gen_random_uuid();cash_id uuid:=gen_random_uuid();existing_id uuid:=gen_random_uuid();payload jsonb;bad jsonb;r jsonb;p public.icom_bank_payables;e public.icom_bank_admin_entries;stamp timestamptz;n bigint;today date:=(now() at time zone 'America/Sao_Paulo')::date;begin
 select user_id into owner_id from public.icom_bank_user_access where active and role='OWNER' limit 1;
 if owner_id is null then raise exception 'Owner fixture missing';end if;
 begin
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select count(*) into n from public.icom_bank_admin_entries;
  payload:=jsonb_build_object('id',root_id,'scope','LOJA','person','AMBOS','title','TESTE ALUGUEL ROLLBACK','category','Conta mensal','notes','','amount_cents',20000,'due_date','2028-01-31','months',12);
  r:=public.icom_bank_save_expense(payload,null);
  perform public.icom_bank_save_expense(payload,null);
  if (select count(*) from public.icom_bank_payables where series_id=root_id)<>12 or (select count(*) from public.icom_bank_admin_entries)<>n then raise exception 'Series duplicated or unpaid bill moved cash';end if;
  if (select due_date from public.icom_bank_payables where series_id=root_id and series_index=2)<>date '2028-02-29' or (select due_date from public.icom_bank_payables where series_id=root_id and series_index=3)<>date '2028-03-31' then raise exception 'Anchor day lost across short months';end if;
  for bad in select value from jsonb_array_elements('[{"amount_cents":0},{"amount_cents":-1},{"amount_cents":1.2},{"amount_cents":"100"},{"months":61},{"months":1.2},{"due_date":"2026-02-30"},{"due_date":"2100-12-31"},{"title":true},{"notes":{}},{"scope":"PESSOAL","person":"OUTRO"}]'::jsonb) loop
   begin perform public.icom_bank_save_expense(payload||jsonb_build_object('id',gen_random_uuid())||bad,null);raise exception 'Invalid expense accepted';exception when raise_exception then if sqlerrm<>'BANK_EXPENSE_INVALID' then raise;end if;end;
  end loop;
  begin perform public.icom_bank_save_expense(payload||'{"title":"changed"}',null);raise exception 'Different retry accepted';exception when raise_exception then if sqlerrm<>'BANK_PAYABLE_CHANGED' then raise;end if;end;
  select * into strict p from public.icom_bank_payables where id=root_id;stamp:=p.updated_at;
  perform public.icom_bank_save_expense(payload||'{"months":1,"amount_cents":30000}',stamp);
  begin perform public.icom_bank_save_expense(payload||'{"months":1,"amount_cents":40000}',stamp);raise exception 'Stale edit accepted';exception when raise_exception then if sqlerrm<>'BANK_PAYABLE_CHANGED' then raise;end if;end;
  if exists(select 1 from public.icom_bank_payables where series_id=root_id and series_index>1 and amount_cents<>20000) then raise exception 'One edit changed all months';end if;
  payload:=jsonb_build_object('id',bill_id,'scope','PESSOAL','person','GISELA','title','TESTE PESSOAL ROLLBACK','category','Pessoal','notes','','amount_cents',23000,'due_date',today,'months',1);
  perform public.icom_bank_save_expense(payload,null);
  select * into strict p from public.icom_bank_payables where id=bill_id;
  for other_id in select user_id from public.icom_bank_user_access where active and role<>'OWNER' loop
   perform set_config('request.jwt.claim.sub',other_id::text,true);execute 'set local role authenticated';
   if exists(select 1 from public.icom_bank_payables) or exists(select 1 from public.icom_bank_payable_history) then raise exception 'Staff read private bills';end if;
   begin perform public.icom_bank_save_expense(payload,null);raise exception 'Staff created private bill';exception when insufficient_privilege then null;end;
   begin perform public.icom_bank_archive_expense(p.id,false,p.updated_at);raise exception 'Staff archived private bill';exception when insufficient_privilege then null;end;
   execute 'reset role';
  end loop;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.icom_bank_save_admin_entry(jsonb_build_object('id',existing_id,'kind','CUSTO','scope','LOJA','entry_date',today,'description','TESTE STORE ROLLBACK','category','','status','REALIZADO','amount_cents',23000,'details','{"payment_method":"PIX"}'::jsonb),null);
  begin perform public.icom_bank_pay_trade_debt(p.id,cash_id,today,'PIX',null,existing_id,p.updated_at);raise exception 'Personal bill linked store cash';exception when raise_exception then if sqlerrm<>'BANK_PAYABLE_EXISTING' then raise;end if;end;
  perform public.icom_bank_pay_trade_debt(p.id,cash_id,today,'PIX',null,null,p.updated_at);
  perform public.icom_bank_pay_trade_debt(p.id,cash_id,today,'PIX',null,null,p.updated_at);
  select * into strict p from public.icom_bank_payables where id=bill_id;
  select * into strict e from public.icom_bank_admin_entries where id=cash_id;
  if e.scope<>'PESSOAL' or e.kind<>'PESSOAL' or e.amount_cents<>23000 or e.details ? 'stock_id' or e.details ? 'plate' or p.status<>'PAGO' or (select count(*) from public.icom_bank_admin_history where entry_id=e.id)<>1 then raise exception 'Personal cash scope or duplicate wrong';end if;
  begin perform public.icom_bank_archive_expense(p.id,false,p.updated_at);raise exception 'Paid bill archived';exception when raise_exception then if sqlerrm<>'BANK_PAYABLE_CLOSED' then raise;end if;end;
  begin perform public.icom_bank_save_expense(payload,p.updated_at);raise exception 'Paid bill edited';exception when raise_exception then if sqlerrm<>'BANK_PAYABLE_CLOSED' then raise;end if;end;
  begin perform public.icom_bank_pay_trade_debt(p.id,gen_random_uuid(),today,'PIX',null,null,p.updated_at);raise exception 'Second payment accepted';exception when raise_exception then if sqlerrm<>'BANK_PAYABLE_CLOSED' then raise;end if;end;
  perform public.icom_bank_reverse_payable(p.id,'Correção teste',p.updated_at);
  select * into strict p from public.icom_bank_payables where id=bill_id;select * into strict e from public.icom_bank_admin_entries where id=cash_id;
  if e.active or p.status<>'PENDENTE' then raise exception 'Personal reversal inconsistent';end if;
  begin perform public.icom_bank_archive_admin_entry(e.id,true,e.updated_at);raise exception 'Reversed cash restored';exception when raise_exception then if sqlerrm<>'BANK_PAYABLE_LEDGER_LOCKED' then raise;end if;end;
  perform public.icom_bank_archive_expense(p.id,false,p.updated_at);select * into strict p from public.icom_bank_payables where id=bill_id;
  if p.active then raise exception 'Archive failed';end if;
  perform public.icom_bank_archive_expense(p.id,true,p.updated_at);select * into strict p from public.icom_bank_payables where id=bill_id;
  if not p.active then raise exception 'Restore failed';end if;
  -- Same accounting and existing-ledger flow for a general store bill.
  select * into strict p from public.icom_bank_payables where id=root_id;
  perform public.icom_bank_save_expense(jsonb_build_object('id',root_id,'scope','LOJA','person','AMBOS','title',p.title,'category',p.category,'notes','','amount_cents',23000,'due_date',today,'months',1),p.updated_at);
  select * into strict p from public.icom_bank_payables where id=root_id;
  perform public.icom_bank_pay_trade_debt(p.id,gen_random_uuid(),today,'PIX',null,existing_id,p.updated_at);
  if (select ledger_entry_id from public.icom_bank_payables where id=root_id)<>existing_id then raise exception 'Store existing cash not linked';end if;
  raise exception using errcode='P0002',message='ROLLBACK_GENERAL_PAYABLE_VALIDATION';
 exception when no_data_found then if sqlerrm<>'ROLLBACK_GENERAL_PAYABLE_VALIDATION' then raise;end if;end;
 if exists(select 1 from public.icom_bank_payables where id in(root_id,bill_id) or series_id=root_id) or exists(select 1 from public.icom_bank_admin_entries where id in(cash_id,existing_id)) then raise exception 'Expense test fixture persisted';end if;
end $$;
