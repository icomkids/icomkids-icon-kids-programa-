-- WhatsApp reads are scoped to an already authenticated, claimed owner message.
-- Subscriber contacts are an enrollment registry, never local financial authorization.
create table public.ia_bank_whatsapp_subscriber_contacts (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 100),
 phone text not null unique check(phone ~ '^55[0-9]{10,11}$'),
 subscriber_id uuid references public.ia_bank_saas_subscribers(id),
 active boolean not null default true,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.ia_bank_whatsapp_subscriber_contacts enable row level security;
revoke all on public.ia_bank_whatsapp_subscriber_contacts from public,anon;
grant select on public.ia_bank_whatsapp_subscriber_contacts to authenticated;
grant select,insert,update on public.ia_bank_whatsapp_subscriber_contacts to service_role;
create policy platform_whatsapp_contacts_select on public.ia_bank_whatsapp_subscriber_contacts for select to authenticated using ((select public.ia_bank_platform_access()));
create policy platform_whatsapp_contacts_insert on public.ia_bank_whatsapp_subscriber_contacts for insert to authenticated with check ((select public.ia_bank_platform_access()) and created_by=(select auth.uid()));
create policy platform_whatsapp_contacts_update on public.ia_bank_whatsapp_subscriber_contacts for update to authenticated using ((select public.ia_bank_platform_access())) with check ((select public.ia_bank_platform_access()));
create index ia_bank_whatsapp_subscriber_contacts_subscriber on public.ia_bank_whatsapp_subscriber_contacts(subscriber_id) where subscriber_id is not null;

create function icom_bank_internal.whatsapp_contact_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(48274312);
 if TG_OP='UPDATE' and new.created_by<>old.created_by then raise exception 'CONTACT_OWNER_IMMUTABLE';end if;
 if new.active and exists(select 1 from public.icom_bank_whatsapp_bot b where new.phone=b.phone or new.phone=any(b.allowed_phones)) then raise exception 'CONTACT_IS_LOCAL_NUMBER';end if;
 if new.active and (select count(*) from public.ia_bank_whatsapp_subscriber_contacts c where c.active and c.id<>new.id)>=40 then raise exception 'CONTACT_LIMIT_40';end if;
 new.name=btrim(new.name);new.updated_at=clock_timestamp();return new;
end $$;
revoke all on function icom_bank_internal.whatsapp_contact_guard() from public,anon,authenticated;
create trigger whatsapp_contact_guard before insert or update on public.ia_bank_whatsapp_subscriber_contacts for each row execute function icom_bank_internal.whatsapp_contact_guard();

create function public.icom_bank_whatsapp_read_rows(p_id uuid,p_claim uuid,p_table text) returns jsonb
language plpgsql set search_path='' as $$
declare owner uuid;result jsonb;fields text;owner_filter text:='';begin
 if current_user<>'service_role' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 select m.owner_id into owner from public.icom_bank_whatsapp_inbox m join public.icom_bank_whatsapp_bot b on b.id=1 and b.owner_id=m.owner_id
 join public.icom_bank_user_access a on a.user_id=m.owner_id and a.active and a.role='OWNER'
 where m.id=p_id and m.claim_id=p_claim and m.status='PROCESSANDO' and b.enabled and b.status='PRONTO' and m.sender=any(b.allowed_phones);
 if owner is null or (select count(*) from public.icom_bank_user_access where active and role='OWNER')<>1 then raise exception 'BANK_WHATSAPP_ISOLATION_REQUIRED' using errcode='42501';end if;
 if p_table='ledger' then
  if (select count(*) from public.icom_bank_admin_entries)>20000 then raise exception 'BANK_WHATSAPP_READ_VOLUME';end if;
  select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('cash_source_id',r.source_entry_id,'cash_stock_origin_id',resold.origin_entry_id,'cash_cost_source_id',coalesce(origin.origin_entry_id,sale.id),'cash_cost_part',case when origin.id is not null then 'DEBITOS' when sale.id is not null then 'CUSTOS' end,'cash_account_id',link.account_id,'cash_account_purpose',link.purpose) order by e.entry_date desc,e.id),'[]'::jsonb) into result
  from public.icom_bank_admin_entries e
  left join public.icom_bank_receipts receipt on receipt.ledger_entry_id=e.id and receipt.active
  left join public.icom_bank_receivables r on r.id=receipt.receivable_id and r.active
  left join public.icom_bank_payables payable on payable.ledger_entry_id=e.id and payable.active and payable.status='PAGO' and payable.stock_id is not null
  left join public.icom_bank_stock_vehicles origin on origin.id=payable.stock_id
  left join public.icom_bank_stock_vehicles stock on stock.id::text=e.details->>'stock_id' and e.kind='CUSTO'
  left join public.icom_bank_admin_entries sale on sale.id=stock.sold_entry_id and sale.active
  left join public.icom_bank_stock_vehicles resold on resold.sold_entry_id=e.id and e.kind='VENDA'
  left join public.icom_bank_account_links link on link.ledger_entry_id=e.id;
  return result;
 end if;
 fields:=case p_table
 when 'icom_bank_accounts' then 'id,owner_id,name,bank,scope,active,created_at,updated_at'
 when 'icom_bank_account_links' then 'ledger_entry_id,account_id,purpose'
 when 'icom_bank_prolabore' then 'id,owner_id,reference_month,paid_at,amount_cents,source_account_id,target_account_id,status,due_date,series_id,sequence_number,months_count'
 when 'icom_bank_rent_dues' then 'id,title,due_date,amount_cents,status,received_at,active'
 when 'icom_bank_personal_wealth' then 'id,kind,category,name,record_date,amount_cents,debt_cents,invested_cents,rate_percent,rate_period,source_id,active'
 when 'icom_bank_payables' then 'id,stock_id,kind,scope,person,title,amount_cents,due_date,active,status,paid_at,created_at'
 when 'icom_bank_stock_vehicles' then 'id,plate,vehicle,status,active,entry_date,source_details,purchase_cents,debt_cents'
 when 'icom_bank_investors' then 'id,name,active'
 when 'icom_bank_receivables' then 'id,source_entry_id,title,payer,kind,bank,amount_cents,received_cents,due_date,active'
 when 'icom_bank_customers' then 'id,name,status,created_at'
 when 'icom_bank_user_access' then 'user_id as id,name,role,active'
 when 'icom_bank_system_settings' then 'id,company_name,pix_type'
 when 'icom_bank_vehicles' then 'id,brand,model,plate'
 when 'icom_bank_contracts' then 'id,customer_id,number,status,principal_cents,total_cents,sale_date'
 when 'icom_bank_installments' then 'id,contract_id,number,due_date,original_cents,updated_cents,paid_cents,paid_at,status'
 when 'icom_bank_payments' then 'id,installment_id,amount_cents,paid_at,status'
 when 'icom_bank_payment_proofs' then 'id,installment_id,informed_cents,status,created_at'
 else null end;
 if fields is null then raise exception 'BANK_WHATSAPP_READ_TABLE';end if;
 if p_table in ('icom_bank_accounts','icom_bank_prolabore','icom_bank_rent_dues','icom_bank_personal_wealth') then owner_filter:=pg_catalog.format(' where owner_id=%L::uuid',owner);end if;
 execute pg_catalog.format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select %s from public.%I%s limit 20001) x',fields,p_table,owner_filter) into result;
 if jsonb_array_length(result)>20000 then raise exception 'BANK_WHATSAPP_READ_VOLUME';end if;
 return result;
end $$;
revoke all on function public.icom_bank_whatsapp_read_rows(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.icom_bank_whatsapp_read_rows(uuid,uuid,text) to service_role;
