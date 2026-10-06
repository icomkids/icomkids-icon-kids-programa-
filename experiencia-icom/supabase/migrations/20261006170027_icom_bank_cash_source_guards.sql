-- Investor capital already returned must be corrected before reversing its source.
create function icom_bank_internal.guard_cash_sources() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;parent uuid;depth integer:=0;s public.icom_bank_admin_entries;begin
 if new.kind='VENDA' and new.details ? 'stock_id' and new.details ? 'sale_owner' and new.details->>'sale_owner'<>'LOJA' then raise exception 'BANK_CASH_STOCK';end if;
 if tg_op<>'UPDATE' then return new;end if;
 if old.kind='VENDA' then
  if new.active=old.active and new.status=old.status and new.kind=old.kind and new.amount_cents is not distinct from old.amount_cents and new.entry_date=old.entry_date and (new.details-array['notes','vehicle_spec','trade_spec','vehicle','trade_vehicle','payment_method','payment_bank','payment_bank_other']) is not distinct from (old.details-array['notes','vehicle_spec','trade_spec','vehicle','trade_vehicle','payment_method','payment_bank','payment_bank_other']) then return new;end if;
  select stock.origin_entry_id into target from public.icom_bank_stock_vehicles stock where stock.sold_entry_id=old.id;
 elsif old.kind='ENTRADA' then
  if new.active=old.active and new.status=old.status and new.amount_cents is not distinct from old.amount_cents and new.entry_date=old.entry_date then return new;end if;
  select r.source_entry_id into target from public.icom_bank_receipts receipt join public.icom_bank_receivables r on r.id=receipt.receivable_id where receipt.ledger_entry_id=old.id;
 else return new;end if;
 while target is not null loop
  depth:=depth+1;if depth>32 then raise exception 'BANK_CASH_INVALID';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text,0));
  select * into s from public.icom_bank_admin_entries where id=target for update;
  if s.active and exists(select 1 from public.icom_bank_admin_entries e where e.active and e.status='REALIZADO' and e.details->>'sale_cost_id'=target::text and e.details->>'settlement_part' in('INVESTIDOR','CAPITAL')) then raise exception 'BANK_CASH_LOCKED';end if;
  select stock.origin_entry_id into parent from public.icom_bank_stock_vehicles stock where stock.sold_entry_id=target;
  target:=parent;
 end loop;return new;
end $$;
revoke all on function icom_bank_internal.guard_cash_sources() from public,anon,authenticated;
create trigger bank_cash_sources_guard before insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_cash_sources();
