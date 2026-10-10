-- Reconcile only the fee of a manual settled charge. Monetary history stays fixed.
drop policy platform_update on public.ia_bank_saas_charges;
create policy platform_update on public.ia_bank_saas_charges for update to authenticated using((select ia_bank_platform_internal.is_owner()) and source='MANUAL' and status<>'ESTORNADO') with check((select ia_bank_platform_internal.is_owner()) and source='MANUAL' and external_payment_id is null and environment='PRODUCTION' and refunded_cents=0);
create or replace function ia_bank_platform_internal.audit_write() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='ia_bank_saas_charges' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_setting('request.jwt.claim.role',true))='authenticated' then
  if new.source<>'MANUAL' or new.external_payment_id is not null or new.environment<>'PRODUCTION' or new.refunded_cents<>0 or new.status in('ESTORNADO','REVISAO') then raise exception 'PLATFORM_CHARGE_LOCKED';end if;
  if tg_op='UPDATE' and old.status in('CONFIRMADO','RECEBIDO','ESTORNADO') and (old.source<>'MANUAL' or new.fee_cents is null or (to_jsonb(new)-'fee_cents'-'updated_at')<>(to_jsonb(old)-'fee_cents'-'updated_at')) then raise exception 'PLATFORM_CHARGE_LOCKED';end if;
 end if;
 new.updated_at=clock_timestamp();
 insert into public.ia_bank_saas_audit(actor,entity,record_id,action) values(auth.uid(),tg_table_name,case when tg_table_name='ia_bank_saas_settings' then null else new.id::text::uuid end,tg_op);
 return new;
end $$;
revoke all on function ia_bank_platform_internal.audit_write() from public,anon,authenticated,service_role;
