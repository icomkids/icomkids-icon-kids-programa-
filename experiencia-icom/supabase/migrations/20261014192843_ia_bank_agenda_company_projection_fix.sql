create or replace function icom_bank_internal.agenda_company_items() returns table(id uuid,stock_id uuid,kind text,scope text,title text,amount_cents bigint,due_date date,active boolean,status text,paid_at date,notes text,created_at timestamptz,updated_at timestamptz,stock_active boolean,stock_status text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or icom_bank_internal.role() not in('OWNER','ADMIN') or icom_bank_internal.agenda_owner() is null then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 -- Legacy payables are store-wide; fail closed if the deployment no longer has one OWNER.
 if (select count(*) from public.icom_bank_user_access ua where ua.active and ua.role='OWNER')<>1 then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 return query select p.id,p.stock_id,p.kind,p.scope,p.title,p.amount_cents,p.due_date,p.active,p.status,p.paid_at,p.notes,p.created_at,p.updated_at,s.active,s.status
 from public.icom_bank_payables p left join public.icom_bank_stock_vehicles s on s.id=p.stock_id
 where p.active and p.scope='LOJA' and p.due_date is not null and (p.stock_id is null or s.active and s.status<>'PREVISTO');
end $$;

