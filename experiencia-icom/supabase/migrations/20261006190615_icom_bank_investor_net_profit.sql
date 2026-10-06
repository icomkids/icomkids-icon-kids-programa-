-- The store's saleProfit is already net. The investor receives the remaining
-- collected proceeds, minus any expenses the store paid on that investor's behalf.
-- No financial records, ownership choices or payment statuses are changed here.
create function icom_bank_internal.cash_same_investor(d jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(d->>'sale_owner'='INVESTIDOR' and d->>'trade_in'='true'
 and d->>'trade_destination'='INVESTIDOR' and case
 when nullif(d->>'investor_id','') is not null and nullif(d->>'trade_investor_id','') is not null
 then d->>'investor_id'=d->>'trade_investor_id'
 else nullif(trim(d->>'investor_name'),'') is not null
 and lower(trim(d->>'investor_name'))=lower(trim(d->>'trade_investor_name')) end,false);
$$;
create function icom_bank_internal.cash_investor_target(d jsonb) returns bigint
language sql immutable set search_path='' as $$
 select greatest(0,coalesce((d->>'purchase_cents')::bigint,0)
 +coalesce((d->>'vehicle_cost_cents')::bigint,0)+coalesce((d->>'commission_cents')::bigint,0)
 -case when icom_bank_internal.cash_same_investor(d) then
 coalesce((d->>'trade_value_cents')::bigint,0)-case when d->>'trade_has_debts'='true'
 then coalesce((d->>'trade_ipva_cents')::bigint,0)+coalesce((d->>'trade_fines_cents')::bigint,0)
 +case when d->>'trade_has_payoff'='true' then coalesce((d->>'trade_payoff_cents')::bigint,0) else 0 end
 else 0 end else 0 end);
$$;
-- All linked payouts share this allowance. Row/advisory locks are taken by callers.
-- Use actual collected cash at the requested date and all committed payments,
-- including future-dated rows, to prevent a backdated payment spending twice.
create function icom_bank_internal.cash_investor_headroom(s public.icom_bank_admin_entries,p_date date,p_exclude uuid default null) returns bigint
language plpgsql stable set search_path='' as $$
declare costs bigint;debts bigint;returned bigint;debt_target bigint;remaining_debt bigint;same_investor boolean;begin
 same_investor:=icom_bank_internal.cash_same_investor(s.details);
 select coalesce(sum(e.amount_cents),0) into costs from public.icom_bank_admin_entries e
 where e.active and e.status='REALIZADO' and e.kind='CUSTO' and e.id is distinct from p_exclude
 and (e.details->>'sale_cost_id'=s.id::text and e.details->>'settlement_part'='CUSTOS'
 or s.details ? 'stock_id' and e.details->>'stock_id'=s.details->>'stock_id');
 select coalesce(sum(e.amount_cents),0) into debts from public.icom_bank_payables p
 join public.icom_bank_stock_vehicles stock on stock.id=p.stock_id
 join public.icom_bank_admin_entries e on e.id=p.ledger_entry_id
 where stock.origin_entry_id=s.id and p.active and p.status='PAGO'
 and e.active and e.status='REALIZADO' and e.id is distinct from p_exclude;
 select coalesce(sum(e.amount_cents),0) into returned from public.icom_bank_admin_entries e
 where e.active and e.status='REALIZADO' and e.id is distinct from p_exclude
 and e.details->>'sale_cost_id'=s.id::text and e.details->>'settlement_part'='INVESTIDOR';
 debt_target:=case when s.details->>'trade_in'='true' and s.details->>'trade_has_debts'='true'
 then coalesce((s.details->>'trade_ipva_cents')::bigint,0)+coalesce((s.details->>'trade_fines_cents')::bigint,0)
 +case when s.details->>'trade_has_payoff'='true' then coalesce((s.details->>'trade_payoff_cents')::bigint,0) else 0 end else 0 end;
 remaining_debt:=case when same_investor then 0 else greatest(0,debt_target-debts) end;
 return greatest(0,least(icom_bank_internal.cash_investor_target(s.details)-costs-case when same_investor then debts else 0 end-returned,
 icom_bank_internal.cash_collected(s.id,p_date)-costs-debts-returned-remaining_debt));
end $$;
revoke all on function icom_bank_internal.cash_same_investor(jsonb),icom_bank_internal.cash_investor_target(jsonb),icom_bank_internal.cash_investor_headroom(public.icom_bank_admin_entries,date,uuid) from public,anon,authenticated;

-- Preserve the existing ownership, stock, version, date and source safeguards.
do $patch$ declare s text;old_fragment text;new_fragment text;begin
 s:=pg_get_functiondef('icom_bank_internal.guard_cash_ownership()'::regprocedure);
 old_fragment:=$old$if paid+cost+new.amount_cents>coalesce((s.details->>'vehicle_cost_cents')::bigint,0)+coalesce((s.details->>'commission_cents')::bigint,0) then raise exception 'BANK_CASH_LIMIT';end if;$old$;
 new_fragment:=old_fragment||$new$
  if s.details->>'sale_owner'='INVESTIDOR' and new.amount_cents>icom_bank_internal.cash_investor_headroom(s,new.entry_date,new.id) then raise exception 'BANK_CASH_LIMIT';end if;$new$;
 if position(old_fragment in s)=0 then raise exception 'NET_PROFIT_COST_GUARD_NOT_FOUND';end if;
 s:=replace(s,old_fragment,new_fragment);
 old_fragment:=$old$if paid+new.amount_cents>least(principal,received) then raise exception 'BANK_CASH_LIMIT';end if;$old$;
 new_fragment:=$new$if new.details->>'settlement_part'='INVESTIDOR' then
   if new.amount_cents>icom_bank_internal.cash_investor_headroom(s,new.entry_date,new.id) then raise exception 'BANK_CASH_LIMIT';end if;
  elsif paid+new.amount_cents>least(principal,received) then raise exception 'BANK_CASH_LIMIT';end if;$new$;
 if position(old_fragment in s)=0 then raise exception 'NET_PROFIT_RETURN_GUARD_NOT_FOUND';end if;
 s:=replace(s,old_fragment,new_fragment);execute s;
end $patch$;

-- A debt settled for a trade delivered to the same investor is also paid on
-- their behalf. Prevent paying it again after already returning those proceeds.
create function icom_bank_internal.guard_investor_debt_payment() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_id uuid;s public.icom_bank_admin_entries;begin
 if new.stock_id is null or new.status<>'PAGO' or not new.active
 or old.status='PAGO' and old.active then return new;end if;
 select origin_entry_id into parent_id from public.icom_bank_stock_vehicles where id=new.stock_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(parent_id::text,0));
 select * into s from public.icom_bank_admin_entries where id=parent_id for update;
 if icom_bank_internal.cash_same_investor(s.details)
 and new.amount_cents>icom_bank_internal.cash_investor_headroom(s,new.paid_at,new.ledger_entry_id)
 then raise exception 'BANK_CASH_LIMIT';end if;
 return new;
end $$;
revoke all on function icom_bank_internal.guard_investor_debt_payment() from public,anon,authenticated;
create trigger bank_investor_debt_payment_guard before update on public.icom_bank_payables
for each row execute function icom_bank_internal.guard_investor_debt_payment();
