-- Extend the existing owner-only ledger without changing sale-profit arithmetic.
do $patch$ declare s text;oldpart text;begin
 s:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 oldpart:=$a$when 'VENDA' then array['stock_id',$a$;
 if position(oldpart in s)=0 then raise exception 'Unexpected administrative function';end if;
 s:=replace(s,oldpart,$a$when 'VENDA' then array['sale_owner','investor_name','trade_destination','trade_investor_name','sale_mode','stock_id',$a$);
 oldpart:=$a$when 'CUSTO' then array['stock_id',$a$;
 if position(oldpart in s)=0 then raise exception 'Unexpected cost function';end if;
 s:=replace(s,oldpart,$a$when 'CUSTO' then array['sale_cost_id','settlement_part','stock_id',$a$);
 execute s;
end $patch$;

do $patch$ declare s text;oldpart text;begin
 s:=pg_get_functiondef('icom_bank_internal.guard_stock_entry()'::regprocedure);
 oldpart:=$a$ if new.entry_date<s.entry_date then$a$;
 if position(oldpart in s)=0 then raise exception 'Unexpected stock guard';end if;
 s:=replace(s,oldpart,$a$ if new.active and s.source_details->>'trade_destination'='INVESTIDOR' then raise exception 'BANK_CASH_STOCK';end if;
 if new.active and new.kind='VENDA' and new.details ? 'sale_owner' and (coalesce(s.source_details->>'trade_destination','') not in('LOJA','REPASSE') or (s.source_details->>'trade_destination'='REPASSE') is distinct from (coalesce(new.details->>'sale_mode','NORMAL')='REPASSE')) then raise exception 'BANK_CASH_STOCK';end if;
 if new.entry_date<s.entry_date then$a$);
 execute s;
 s:=pg_get_functiondef('icom_bank_internal.sync_stock_entry()'::regprocedure);
 oldpart:=$a$   if has_activity and ($a$;
 if position(oldpart in s)=0 then raise exception 'Unexpected stock sync';end if;
 s:=replace(s,oldpart,$a$   if has_activity and new.details->>'trade_destination' is distinct from s.source_details->>'trade_destination' and not(s.source_details->>'trade_destination' is null and new.details->>'trade_destination'='LOJA') then raise exception 'BANK_STOCK_LOCKED';end if;
   if has_activity and ($a$);
 s:=replace(s,$a$array['vehicle_spec','trade_spec','vehicle','trade_vehicle','notes','payment_method','payment_bank','payment_bank_other']$a$,$a$array['sale_owner','investor_name','sale_mode','trade_destination','trade_investor_name','vehicle_spec','trade_spec','vehicle','trade_vehicle','notes','payment_method','payment_bank','payment_bank_other']$a$);
 execute s;
end $patch$;

-- Consistent entry/source lock serialises investor returns and concurrent receipts.
create function icom_bank_internal.guard_cash_ownership() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.icom_bank_admin_entries;st public.icom_bank_stock_vehicles;received bigint;principal bigint;paid bigint;cost bigint;trade bigint;begin
 if new.kind='VENDA' and new.details ? 'sale_owner' then
  if new.details->>'sale_owner' not in('LOJA','INVESTIDOR') or coalesce(new.details->>'sale_mode','NORMAL') not in('NORMAL','REPASSE') then raise exception 'BANK_CASH_INVALID';end if;
  if new.details->>'sale_owner'='INVESTIDOR' and length(trim(coalesce(new.details->>'investor_name','')))=0 then raise exception 'BANK_CASH_INVALID';end if;
  if new.details->>'trade_in'='true' and (coalesce(new.details->>'trade_destination','') not in('LOJA','INVESTIDOR','REPASSE') or new.details->>'trade_destination'='INVESTIDOR' and length(trim(coalesce(new.details->>'trade_investor_name','')))=0) then raise exception 'BANK_CASH_INVALID';end if;
  if new.details->>'sale_mode'='REPASSE' then
   if new.details->>'sale_owner'<>'LOJA' or not(new.details ? 'stock_id') or new.details->>'trade_in' is distinct from 'false' or coalesce((new.details->>'commission_cents')::bigint,-1)<>0 then raise exception 'BANK_CASH_INVALID';end if;
  end if;
 end if;
 if tg_op='UPDATE' and old.kind='VENDA' then
  if exists(select 1 from public.icom_bank_admin_entries e where e.active and e.details->>'sale_cost_id'=old.id::text) and (not new.active or new.status<>'REALIZADO' or new.kind<>'VENDA' or new.entry_date<>old.entry_date or (new.details-array['notes','vehicle_spec','trade_spec','vehicle','trade_vehicle','payment_method','payment_bank','payment_bank_other']) is distinct from (old.details-array['notes','vehicle_spec','trade_spec','vehicle','trade_vehicle','payment_method','payment_bank','payment_bank_other']) or new.amount_cents is distinct from old.amount_cents) then raise exception 'BANK_CASH_LOCKED';end if;
 end if;
 if tg_op='UPDATE' and old.details ? 'sale_cost_id' and (new.details->>'sale_cost_id' is distinct from old.details->>'sale_cost_id' or new.details->>'settlement_part' is distinct from old.details->>'settlement_part') then raise exception 'BANK_CASH_LOCKED';end if;
 if new.details ? 'stock_id' and new.active then
  select * into st from public.icom_bank_stock_vehicles where id=(new.details->>'stock_id')::uuid;
  if st.source_details->>'trade_destination'='INVESTIDOR' then raise exception 'BANK_CASH_STOCK';end if;
  if new.kind='VENDA' and new.details ? 'sale_owner' and (coalesce(st.source_details->>'trade_destination','') not in('LOJA','REPASSE') or (st.source_details->>'trade_destination'='REPASSE') is distinct from (coalesce(new.details->>'sale_mode','NORMAL')='REPASSE')) then raise exception 'BANK_CASH_STOCK';end if;
 end if;
 if not(new.details ? 'sale_cost_id') then return new;end if;
 if new.kind<>'CUSTO' or new.scope<>'LOJA' or new.details ? 'stock_id' or coalesce(new.details->>'sale_cost_id','')!~'^[0-9a-fA-F-]{36}$' or coalesce(new.details->>'settlement_part','') not in('CUSTOS','INVESTIDOR','CAPITAL') then raise exception 'BANK_CASH_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.details->>'sale_cost_id',0));
 select * into s from public.icom_bank_admin_entries where id=(new.details->>'sale_cost_id')::uuid for update;
 if not found or not s.active or s.kind<>'VENDA' or s.status<>'REALIZADO' or new.entry_date<s.entry_date or new.id=s.id then raise exception 'BANK_CASH_INVALID';end if;
 if not new.active or new.status<>'REALIZADO' then return new;end if;
 if new.entry_date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'BANK_CASH_INVALID';end if;
 select coalesce(sum(e.amount_cents),0) into paid from public.icom_bank_admin_entries e where e.active and e.status='REALIZADO' and e.id<>new.id and e.details->>'sale_cost_id'=s.id::text and e.details->>'settlement_part'=new.details->>'settlement_part';
 if new.details->>'settlement_part'='CUSTOS' then
  select coalesce(sum(e.amount_cents),0) into cost from public.icom_bank_admin_entries e where e.active and e.status='REALIZADO' and e.kind='CUSTO' and e.details->>'stock_id'=s.details->>'stock_id';
  if paid+cost+new.amount_cents>coalesce((s.details->>'vehicle_cost_cents')::bigint,0)+coalesce((s.details->>'commission_cents')::bigint,0) then raise exception 'BANK_CASH_LIMIT';end if;
 else
  if new.details->>'settlement_part'='INVESTIDOR' and s.details->>'sale_owner' is distinct from 'INVESTIDOR' or new.details->>'settlement_part'='CAPITAL' and s.details->>'sale_mode' is distinct from 'REPASSE' then raise exception 'BANK_CASH_INVALID';end if;
  trade:=case when s.details->>'trade_in'='true' and s.details->>'trade_destination'='INVESTIDOR' and lower(trim(s.details->>'trade_investor_name'))=lower(trim(s.details->>'investor_name')) then coalesce((s.details->>'trade_value_cents')::bigint,0) else 0 end;
  principal:=greatest(0,coalesce((s.details->>'purchase_cents')::bigint,0)-trade);
  select coalesce(sum(e.amount_cents),0)+coalesce(s.amount_cents,0) into received from public.icom_bank_receipts p join public.icom_bank_receivables r on r.id=p.receivable_id join public.icom_bank_admin_entries e on e.id=p.ledger_entry_id where r.source_entry_id=s.id and p.active and r.active and e.active and e.status='REALIZADO' and e.entry_date<=new.entry_date;
  if paid+new.amount_cents>least(principal,received) then raise exception 'BANK_CASH_LIMIT';end if;
 end if;
 return new;
end $$;
revoke all on function icom_bank_internal.guard_cash_ownership() from public,anon,authenticated;
create trigger bank_cash_ownership_guard before insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_cash_ownership();
create index bank_admin_sale_cost on public.icom_bank_admin_entries((details->>'sale_cost_id')) where details ? 'sale_cost_id';

-- This read-only RPC decorates ledger rows with trusted receipt/payment links.
-- Clients cannot forge those associations in an administrative write.
create function public.icom_bank_cash_entries() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if (select count(*) from public.icom_bank_admin_entries)>100000 then raise exception 'BANK_CASH_VOLUME';end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('cash_source_id',r.source_entry_id,'cash_cost_source_id',coalesce(origin.origin_entry_id,sale.id),'cash_cost_part',case when origin.id is not null then 'DEBITOS' when sale.id is not null then 'CUSTOS' end) order by e.entry_date desc,e.id),'[]'::jsonb) into result
 from public.icom_bank_admin_entries e
 left join public.icom_bank_receipts receipt on receipt.ledger_entry_id=e.id and receipt.active
 left join public.icom_bank_receivables r on r.id=receipt.receivable_id and r.active
 left join public.icom_bank_payables payable on payable.ledger_entry_id=e.id and payable.active and payable.status='PAGO' and payable.stock_id is not null
 left join public.icom_bank_stock_vehicles origin on origin.id=payable.stock_id
 left join public.icom_bank_stock_vehicles stock on stock.id::text=e.details->>'stock_id' and e.kind='CUSTO'
 left join public.icom_bank_admin_entries sale on sale.id=stock.sold_entry_id and sale.active;
 return result;
end $$;
revoke all on function public.icom_bank_cash_entries() from public,anon;
grant execute on function public.icom_bank_cash_entries() to authenticated;
-- All ownership snapshots use the existing private administrative/stock history.
