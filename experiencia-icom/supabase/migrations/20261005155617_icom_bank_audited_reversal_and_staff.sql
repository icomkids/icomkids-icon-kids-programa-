-- Audited reversals preserve the original payment and document.
alter table public.icom_bank_payments add column status text not null default 'CONFIRMADO' check(status in ('CONFIRMADO','ESTORNADO')),add column reversed_at timestamptz,add column reversed_by uuid references auth.users(id),add column reversal_reason text;
alter table public.icom_bank_payments add constraint bank_payment_reversal_consistent check ((status='CONFIRMADO' and reversed_at is null and reversed_by is null and reversal_reason is null) or (status='ESTORNADO' and reversed_at is not null and reversed_by is not null and length(btrim(reversal_reason)) between 3 and 1000));
alter table public.icom_bank_payments drop constraint icom_bank_payments_installment_id_key;
create unique index icom_bank_one_confirmed_payment on public.icom_bank_payments(installment_id) where status='CONFIRMADO';
create unique index icom_bank_one_payment_per_proof on public.icom_bank_payments(proof_id) where proof_id is not null;
create index icom_bank_payment_reverser_idx on public.icom_bank_payments(reversed_by);
alter table public.icom_bank_payment_proofs drop constraint icom_bank_payment_proofs_status_check;
alter table public.icom_bank_payment_proofs add constraint icom_bank_payment_proofs_status_check check(status in ('ARQUIVO_PENDENTE','UPLOAD_CANCELADO','COMPROVANTE_ENVIADO','APROVADO','RECUSADO','ESTORNADO'));
alter table public.icom_bank_payment_proofs drop constraint icom_bank_payment_proofs_review_check;
alter table public.icom_bank_payment_proofs add constraint icom_bank_payment_proofs_review_check check(status not in ('APROVADO','RECUSADO','ESTORNADO') or reviewed_by is not null);
create function public.icom_bank_reverse_payment(p_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=icom_bank_internal.role();v_p public.icom_bank_payments;v_i public.icom_bank_installments;v_c public.icom_bank_contracts;v_proof public.icom_bank_payment_proofs;v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if v_role is null or v_role not in ('OWNER','ADMIN') then raise exception 'BANK_FORBIDDEN';end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'BANK_REVERSAL_REASON';end if;
 select * into v_p from public.icom_bank_payments where id=p_id;if v_p.id is null then raise exception 'BANK_PAYMENT_MISSING';end if;
 select c.* into v_c from public.icom_bank_contracts c join public.icom_bank_installments i on i.contract_id=c.id where i.id=v_p.installment_id for update of c;
 select * into v_i from public.icom_bank_installments where id=v_p.installment_id for update;
 if v_p.proof_id is not null then select * into v_proof from public.icom_bank_payment_proofs where id=v_p.proof_id for update;end if;
 select * into v_p from public.icom_bank_payments where id=p_id for update;
 if v_p.status='ESTORNADO' then
  if v_p.reversal_reason<>btrim(p_reason) then raise exception 'BANK_PAYMENT_CHANGED';end if;
  return jsonb_build_object('id',v_p.id,'status',v_p.status);
 end if;
 if v_c.status not in ('ATIVO','QUITADO') or v_i.status<>'PAGO' or v_i.paid_cents<>v_p.amount_cents or (v_p.proof_id is not null and (v_proof.id is null or v_proof.status<>'APROVADO')) then raise exception 'BANK_PAYMENT_CHANGED';end if;
 update public.icom_bank_payments set status='ESTORNADO',reversed_at=clock_timestamp(),reversed_by=auth.uid(),reversal_reason=btrim(p_reason) where id=p_id;
 update public.icom_bank_installments set status=case when due_date<v_today then 'ATRASADO' when due_date=v_today then 'VENCE_HOJE' else 'A_VENCER' end,paid_cents=0,paid_at=null where id=v_i.id;
 if v_proof.id is not null then update public.icom_bank_payment_proofs set status='ESTORNADO',reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=v_proof.id;end if;
 if v_c.status='QUITADO' then update public.icom_bank_contracts set status='ATIVO' where id=v_c.id;end if;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'PAGAMENTO_ESTORNADO',p_id,jsonb_build_object('installment_id',v_i.id,'contract_id',v_c.id,'amount_cents',v_p.amount_cents,'paid_at',v_p.paid_at,'reason',btrim(p_reason)));
 return jsonb_build_object('id',p_id,'status','ESTORNADO');
end $$;
alter table public.icom_bank_user_access add column updated_at timestamptz not null default now();
create function public.icom_bank_list_staff() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if icom_bank_internal.role() is null or icom_bank_internal.role() not in ('OWNER','ADMIN') then raise exception 'BANK_FORBIDDEN';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',a.name,'email',u.email,'role',a.role,'active',a.active,'updated_at',a.updated_at) order by a.name) from public.icom_bank_user_access a join auth.users u on u.id=a.user_id),'[]'::jsonb);
end $$;
create function public.icom_bank_save_staff(p_email text,p_name text,p_role text,p_active boolean,p_expected timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;v_target uuid;v_before public.icom_bank_user_access;v_after public.icom_bank_user_access;
begin
 perform pg_advisory_xact_lock(hashtextextended('icom-bank-staff',0));
 v_role:=icom_bank_internal.role();if v_role is null or v_role not in ('OWNER','ADMIN') then raise exception 'BANK_FORBIDDEN';end if;
 if p_role is null or p_role not in ('ADMIN','GERENTE','FINANCEIRO','VENDEDOR') or p_active is null or length(btrim(coalesce(p_name,''))) not between 2 and 160 or length(coalesce(p_email,''))>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'BANK_STAFF_INVALID';end if;
 if v_role='ADMIN' and p_role='ADMIN' then raise exception 'BANK_FORBIDDEN';end if;
 select id into v_target from auth.users where lower(email)=lower(btrim(p_email));if v_target is null then raise exception 'BANK_USER_NOT_FOUND';end if;
 if v_target=auth.uid() then raise exception 'BANK_STAFF_SELF';end if;
 select * into v_before from public.icom_bank_user_access where user_id=v_target for update;
 if v_before.role='OWNER' or (v_role='ADMIN' and v_before.role='ADMIN') then raise exception 'BANK_FORBIDDEN';end if;
 if (v_before.user_id is not null and v_before.updated_at is distinct from p_expected) or (v_before.user_id is null and p_expected is not null) then raise exception 'BANK_STAFF_CHANGED';end if;
 insert into public.icom_bank_user_access(user_id,name,role,active,updated_at) values(v_target,btrim(p_name),p_role,p_active,clock_timestamp()) on conflict(user_id) do update set name=excluded.name,role=excluded.role,active=excluded.active,updated_at=excluded.updated_at returning * into v_after;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'ACESSO_BANK_ALTERADO',v_target,jsonb_build_object('previous_role',v_before.role,'previous_active',v_before.active,'role',v_after.role,'active',v_after.active));
 return jsonb_build_object('user_id',v_after.user_id,'name',v_after.name,'email',lower(btrim(p_email)),'role',v_after.role,'active',v_after.active,'updated_at',v_after.updated_at);
end $$;
revoke all on function public.icom_bank_reverse_payment(uuid,text),public.icom_bank_list_staff(),public.icom_bank_save_staff(text,text,text,boolean,timestamptz) from public,anon;
grant execute on function public.icom_bank_reverse_payment(uuid,text),public.icom_bank_list_staff(),public.icom_bank_save_staff(text,text,text,boolean,timestamptz) to authenticated;
