-- All synthetic writes roll back inside this block, including payment links/audit.
do $$ declare owner_id uuid;origin uuid:=gen_random_uuid();payout uuid:=gen_random_uuid();cost_id uuid:=gen_random_uuid();debt_sale uuid:=gen_random_uuid();debt_payout uuid:=gen_random_uuid();debt_payment uuid:=gen_random_uuid();payload jsonb;outgoing jsonb;s public.icom_bank_admin_entries;e public.icom_bank_admin_entries;q public.icom_bank_payables;today date:=(now() at time zone 'America/Sao_Paulo')::date;begin
 select user_id into strict owner_id from public.icom_bank_user_access where active and role='OWNER' limit 1;
 begin
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  payload:=jsonb_build_object('id',origin,'kind','VENDA','scope','LOJA','entry_date',today,'description','TESTE LUCRO LIQUIDO ROLLBACK','category','Venda','status','REALIZADO','amount_cents',7200000,'details',jsonb_build_object('plate','TST9N01','vehicle','Carro teste','sale_cents',10200000,'purchase_cents',8600000,'vehicle_cost_cents',20000,'commission_cents',165000,'sale_owner','INVESTIDOR','investor_name','Investidor teste','sale_mode','NORMAL','trade_in',true,'trade_destination','INVESTIDOR','trade_investor_name','Investidor teste','trade_plate','TST9N02','trade_vehicle','Troca teste','trade_year',2020,'trade_value_cents',3000000,'trade_has_debts',false,'payment_method','PIX'));
  perform public.icom_bank_save_admin_entry(payload,null);
  select * into strict s from public.icom_bank_admin_entries where id=origin;
  if icom_bank_internal.cash_investor_headroom(s,today)<>5785000 then raise exception '72000 minus 14150 must return 57850';end if;
  outgoing:=jsonb_build_object('id',payout,'kind','CUSTO','scope','LOJA','entry_date',today,'description','TESTE DEVOLUCAO LIQUIDA ROLLBACK','category','Investidor','status','REALIZADO','amount_cents',5785000,'details',jsonb_build_object('sale_cost_id',origin,'settlement_part','INVESTIDOR','payment_method','PIX'));
  perform public.icom_bank_save_admin_entry(outgoing,null);
  perform public.icom_bank_save_admin_entry(outgoing,null);
  if icom_bank_internal.cash_investor_headroom(s,today)<>0 then raise exception 'Return not consumed';end if;
  begin perform public.icom_bank_save_admin_entry(outgoing||jsonb_build_object('id',gen_random_uuid(),'amount_cents',1),null);raise exception 'Returned store net profit';exception when raise_exception then if sqlerrm<>'BANK_CASH_LIMIT' then raise;end if;end;
  begin perform public.icom_bank_save_admin_entry(outgoing||jsonb_build_object('id',cost_id,'amount_cents',20000,'details',(outgoing->'details')||'{"settlement_part":"CUSTOS"}'),null);raise exception 'Investor expense paid twice after return';exception when raise_exception then if sqlerrm<>'BANK_CASH_LIMIT' then raise;end if;end;
  select * into strict e from public.icom_bank_admin_entries where id=payout;
  perform public.icom_bank_archive_admin_entry(payout,false,e.updated_at);
  perform public.icom_bank_save_admin_entry(outgoing||jsonb_build_object('id',cost_id,'amount_cents',20000,'details',(outgoing->'details')||'{"settlement_part":"CUSTOS"}'),null);
  if icom_bank_internal.cash_investor_headroom(s,today)<>5765000 then raise exception 'Linked expense must reduce investor return';end if;
  perform public.icom_bank_save_admin_entry(outgoing||jsonb_build_object('id',gen_random_uuid(),'amount_cents',5765000),null);
  if icom_bank_internal.cash_investor_headroom(s,today)<>0 then raise exception 'Expense and payout counted twice';end if;
  -- Same net trade credit, but with 5000 in debt paid on behalf of investor.
  payload:=payload||jsonb_build_object('id',debt_sale,'details',(payload->'details')||'{"plate":"TST9N03","trade_plate":"TST9N04","trade_value_cents":3500000,"trade_has_debts":true,"trade_has_payoff":false,"trade_ipva_cents":500000,"trade_fines_cents":0}');
  perform public.icom_bank_save_admin_entry(payload,null);
  select * into strict s from public.icom_bank_admin_entries where id=debt_sale;
  if icom_bank_internal.cash_investor_headroom(s,today)<>5785000 then raise exception 'Debt must use net trade credit';end if;
  outgoing:=outgoing||jsonb_build_object('id',debt_payout,'details',(outgoing->'details')||jsonb_build_object('sale_cost_id',debt_sale));
  perform public.icom_bank_save_admin_entry(outgoing,null);
  select p.* into strict q from public.icom_bank_payables p join public.icom_bank_stock_vehicles stock on stock.id=p.stock_id where stock.origin_entry_id=debt_sale and p.active;
  begin perform public.icom_bank_pay_trade_debt(q.id,debt_payment,today,'PIX',null,null,q.updated_at);raise exception 'Debt paid twice after full investor return';exception when raise_exception then if sqlerrm<>'BANK_CASH_LIMIT' then raise;end if;end;
  select * into strict e from public.icom_bank_admin_entries where id=debt_payout;
  perform public.icom_bank_archive_admin_entry(debt_payout,false,e.updated_at);
  perform public.icom_bank_pay_trade_debt(q.id,debt_payment,today,'PIX',null,null,q.updated_at);
  if icom_bank_internal.cash_investor_headroom(s,today)<>5285000 then raise exception 'Debt payment not deducted from investor return';end if;
  perform public.icom_bank_reverse_payable(q.id,'Teste rollback',(select updated_at from public.icom_bank_payables where id=q.id));
  if icom_bank_internal.cash_investor_headroom(s,today)<>5785000 then raise exception 'Reversed debt must restore investor reserve';end if;
  raise exception using errcode='P0002',message='ROLLBACK_NET_PROFIT_VALIDATION';
 exception when no_data_found then if sqlerrm<>'ROLLBACK_NET_PROFIT_VALIDATION' then raise;end if;end;
 if exists(select 1 from public.icom_bank_admin_entries where id in(origin,payout,cost_id,debt_sale,debt_payout,debt_payment)) then raise exception 'Net profit fixture persisted';end if;
end $$;
