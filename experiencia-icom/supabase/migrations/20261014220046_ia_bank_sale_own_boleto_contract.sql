-- One internal installment contract per administrative sale. No second sale or cash receipt is created.
do $patch$ declare s text;old text:='''PIX'',''DINHEIRO'',''CARTAO'',''FINANCIAMENTO'',''SEM_DIFERENCA''';begin
 s:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 if position(old in s)=0 then raise exception 'SALE_PAYMENT_VALIDATION_CHANGED';end if;
 execute replace(s,old,'''PIX'',''DINHEIRO'',''CARTAO'',''FINANCIAMENTO'',''BOLETO_PROPRIO'',''SEM_DIFERENCA''');
end $patch$;
create table public.icom_bank_sale_contracts(
 sale_id uuid primary key references public.icom_bank_admin_entries(id),
 contract_id uuid unique not null references public.icom_bank_contracts(id),
 owner_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
alter table public.icom_bank_sale_contracts enable row level security;
revoke all on public.icom_bank_sale_contracts from public,anon,authenticated;
grant select on public.icom_bank_sale_contracts to authenticated,service_role;
create policy bank_sale_contract_visible on public.icom_bank_sale_contracts for select to authenticated
 using((select auth.uid()) is not null and exists(select 1 from public.icom_bank_contracts c where c.id=contract_id));
create function icom_bank_internal.create_sale_contract(p_sale uuid,p_expected timestamptz,p_customer uuid,p_request uuid,p_vehicle jsonb,p_finance jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.icom_bank_admin_entries;l public.icom_bank_sale_contracts;r public.icom_bank_receivables;pending bigint;result jsonb;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 select * into s from public.icom_bank_admin_entries where id=p_sale and created_by=auth.uid() for update;
 if not found or s.kind<>'VENDA' or not s.active or s.status<>'REALIZADO' or s.details->>'payment_method' is distinct from 'BOLETO_PROPRIO' then raise exception 'BANK_SALE_CONTRACT_INVALID';end if;
 select * into l from public.icom_bank_sale_contracts where sale_id=p_sale;
 if found then
  if l.contract_id is distinct from p_request then raise exception 'BANK_SALE_CONTRACT_EXISTS';end if;
  return public.icom_bank_create_contract(p_customer,p_request,p_vehicle,p_finance||jsonb_build_object('admin_sale_id',p_sale,'payment_method','BOLETO_PROPRIO'));
 end if;
 if p_expected is null or p_expected is distinct from s.updated_at then raise exception 'BANK_SALE_CONTRACT_CHANGED';end if;
 select * into r from public.icom_bank_receivables where source_entry_id=p_sale and active for update;
 pending:=icom_bank_internal.sale_receivable_amount(s)-coalesce(r.received_cents,0);
 if pending is null or pending<=0 or (p_finance->>'vehicle_cents')::bigint is distinct from (s.details->>'sale_cents')::bigint or (p_finance->>'down_payment_cents')::bigint is distinct from (s.details->>'sale_cents')::bigint-pending or (p_finance->>'sale_date')::date is distinct from s.entry_date or coalesce(p_vehicle->>'plate','') is distinct from coalesce(s.details->>'plate','') then raise exception 'BANK_SALE_CONTRACT_CHANGED';end if;
 result:=public.icom_bank_create_contract(p_customer,p_request,p_vehicle,p_finance||jsonb_build_object('admin_sale_id',p_sale,'payment_method','BOLETO_PROPRIO'));
 insert into public.icom_bank_sale_contracts(sale_id,contract_id,owner_id) values(p_sale,(result->>'id')::uuid,auth.uid());
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'SALE_CONTRACT_LINKED',p_sale,jsonb_build_object('contract_id',result->>'id','principal_cents',pending));return result;
end $$;
revoke all on function icom_bank_internal.create_sale_contract(uuid,timestamptz,uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function icom_bank_internal.create_sale_contract(uuid,timestamptz,uuid,uuid,jsonb,jsonb) to authenticated,service_role;
create function public.icom_bank_create_sale_contract(p_sale uuid,p_expected timestamptz,p_customer uuid,p_request uuid,p_vehicle jsonb,p_finance jsonb) returns jsonb language sql security invoker set search_path='' as $$
 select icom_bank_internal.create_sale_contract(p_sale,p_expected,p_customer,p_request,p_vehicle,p_finance);
$$;
revoke all on function public.icom_bank_create_sale_contract(uuid,timestamptz,uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.icom_bank_create_sale_contract(uuid,timestamptz,uuid,uuid,jsonb,jsonb) to authenticated,service_role;
create function icom_bank_internal.guard_sale_contract() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.icom_bank_sale_contracts l join public.icom_bank_contracts c on c.id=l.contract_id where l.sale_id=old.id and c.status<>'CANCELADO') and
 (not new.active or new.kind<>old.kind or new.scope<>old.scope or new.status<>old.status or new.amount_cents is distinct from old.amount_cents or new.entry_date<>old.entry_date or icom_bank_internal.sale_receivable_amount(new) is distinct from icom_bank_internal.sale_receivable_amount(old) or new.details->>'payment_method' is distinct from old.details->>'payment_method' or new.details->>'plate' is distinct from old.details->>'plate') then raise exception 'BANK_SALE_CONTRACT_LOCKED';end if;return new;
end $$;
revoke all on function icom_bank_internal.guard_sale_contract() from public,anon,authenticated;
create trigger bank_sale_contract_guard before update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_sale_contract();
create function icom_bank_internal.guard_linked_contract() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.icom_bank_sale_contracts l where l.contract_id=old.id) and (new.principal_cents<>old.principal_cents or new.down_payment_cents<>old.down_payment_cents or new.sale_date<>old.sale_date or new.customer_id<>old.customer_id or new.vehicle_id<>old.vehicle_id) then raise exception 'BANK_SALE_CONTRACT_LOCKED';end if;return new;
end $$;
revoke all on function icom_bank_internal.guard_linked_contract() from public,anon,authenticated;
create trigger bank_linked_contract_guard before update on public.icom_bank_contracts for each row execute function icom_bank_internal.guard_linked_contract();
