-- Financial staff can see only collection contacts for overdue active contracts.
create function public.icom_bank_collection_contacts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if icom_bank_internal.role() is null or icom_bank_internal.role() not in ('OWNER','ADMIN','GERENTE','FINANCEIRO') then raise exception 'BANK_FORBIDDEN';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'cpf_masked','***.'||substring(a.cpf from 4 for 3)||'.***-'||right(a.cpf,2),'phone',a.phone)) from public.icom_bank_customers a where exists(select 1 from public.icom_bank_contracts c join public.icom_bank_installments i on i.contract_id=c.id where c.customer_id=a.id and c.status='ATIVO' and i.status not in ('PAGO','CANCELADO','RENEGOCIADO') and i.due_date<(now() at time zone 'America/Sao_Paulo')::date and i.updated_cents>i.paid_cents)),'[]'::jsonb);
end $$;
revoke all on function public.icom_bank_collection_contacts() from public,anon;
grant execute on function public.icom_bank_collection_contacts() to authenticated;
