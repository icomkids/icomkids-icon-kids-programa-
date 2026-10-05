-- Manual labels only. No score lookup, rate calculation, or eligibility decision.
alter table public.icom_bank_customers add column risk_profile text;
alter table public.icom_bank_customers add constraint bank_customer_risk_profile check(risk_profile is null or risk_profile in ('A','B','C','D'));
alter table public.icom_bank_contracts add constraint bank_contract_risk_profile check(
 terms->'risk_profile' is null or terms->'risk_profile'='null'::jsonb or
 (jsonb_typeof(terms->'risk_profile')='string' and terms->>'risk_profile' in ('A','B','C','D'))
);

create or replace function icom_bank_internal.audit_customer() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Missing actor';end if;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details)
 values(auth.uid(),'CLIENTE_CRIADO',new.id,jsonb_build_object('status',new.status,'risk_profile',new.risk_profile));
 return new;
end $$;
revoke all on function icom_bank_internal.audit_customer() from public,anon,authenticated;

create function public.icom_bank_update_customer_profile(p_customer uuid,p_profile text,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=icom_bank_internal.role();v_before public.icom_bank_customers;v_after public.icom_bank_customers;
begin
 if auth.uid() is null or v_role is null or v_role not in ('OWNER','ADMIN','GERENTE','VENDEDOR') then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_customer is null or p_expected is null or (p_profile is not null and p_profile not in ('A','B','C','D')) then raise exception 'BANK_PROFILE_INVALID';end if;
 select * into v_before from public.icom_bank_customers where id=p_customer for update;
 if not found or (v_role='VENDEDOR' and v_before.assigned_to is distinct from auth.uid()) then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if v_before.updated_at is distinct from p_expected then raise exception 'BANK_PROFILE_CHANGED';end if;
 if v_before.risk_profile is not distinct from p_profile then return jsonb_build_object('risk_profile',v_before.risk_profile,'updated_at',v_before.updated_at);end if;
 update public.icom_bank_customers set risk_profile=p_profile,updated_at=clock_timestamp() where id=p_customer returning * into v_after;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details)
 values(auth.uid(),'PERFIL_CLIENTE_ALTERADO',p_customer,jsonb_build_object('previous_profile',v_before.risk_profile,'risk_profile',p_profile));
 return jsonb_build_object('risk_profile',v_after.risk_profile,'updated_at',v_after.updated_at);
end $$;
revoke all on function public.icom_bank_update_customer_profile(uuid,text,timestamptz) from public,anon;
grant execute on function public.icom_bank_update_customer_profile(uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
