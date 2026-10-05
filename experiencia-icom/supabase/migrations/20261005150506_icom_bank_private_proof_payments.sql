-- ICOM Bank: private, immutable proofs and atomic full-installment review.
alter table public.icom_bank_payment_proofs drop constraint icom_bank_payment_proofs_status_check;
alter table public.icom_bank_payment_proofs drop constraint icom_bank_payment_proofs_check1;
alter table public.icom_bank_payment_proofs add constraint icom_bank_payment_proofs_status_check check (status in ('ARQUIVO_PENDENTE','UPLOAD_CANCELADO','COMPROVANTE_ENVIADO','APROVADO','RECUSADO'));
alter table public.icom_bank_payment_proofs add constraint icom_bank_payment_proofs_review_check check (status not in ('APROVADO','RECUSADO') or reviewed_by is not null);
alter table public.icom_bank_payment_proofs add column upload_expires_at timestamptz, add column file_sha256 text, add column reviewed_at timestamptz;
alter table public.icom_bank_payment_proofs add constraint icom_bank_proof_hash_check check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$');
create unique index icom_bank_one_pending_proof on public.icom_bank_payment_proofs(installment_id) where status in ('ARQUIVO_PENDENTE','COMPROVANTE_ENVIADO');
create index icom_bank_proofs_submitter_idx on public.icom_bank_payment_proofs(submitted_by);
create index icom_bank_proofs_reviewer_idx on public.icom_bank_payment_proofs(reviewed_by);
create policy bank_proofs_submitter_read on public.icom_bank_payment_proofs for select to authenticated using (submitted_by=(select auth.uid()) and icom_bank_internal.role() is not null and exists(select 1 from public.icom_bank_installments i where i.id=installment_id));
create policy bank_private_proofs_upload on storage.objects for insert to authenticated with check (
 bucket_id='icom-bank-documents' and exists(select 1 from public.icom_bank_payment_proofs p where p.object_path=objects.name and p.submitted_by=(select auth.uid()) and p.status='ARQUIVO_PENDENTE' and p.upload_expires_at>now())
);
create function public.icom_bank_reserve_proof(p_id uuid,p_installment uuid,p_amount bigint,p_mime text,p_size bigint,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=icom_bank_internal.role(); v_i public.icom_bank_installments; v_c public.icom_bank_contracts; v_p public.icom_bank_payment_proofs; v_path text;
begin
 if v_role is null then raise exception 'BANK_FORBIDDEN'; end if;
 select c.* into v_c from public.icom_bank_contracts c join public.icom_bank_installments i on i.contract_id=c.id where i.id=p_installment for update of c;
 if v_c.id is null or (v_role='VENDEDOR' and v_c.seller_id is distinct from auth.uid()) then raise exception 'BANK_FORBIDDEN'; end if;
 select * into v_i from public.icom_bank_installments where id=p_installment for update;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount>100000000000 or p_mime is null or p_mime not in ('image/jpeg','image/png','application/pdf') or p_size is null or p_size not between 1 and 10485760 or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'BANK_PROOF_INVALID'; end if;
 select * into v_p from public.icom_bank_payment_proofs where id=p_id;
 if v_p.id is not null then
  if v_p.installment_id<>p_installment or v_p.submitted_by<>auth.uid() or v_p.informed_cents<>p_amount or v_p.mime_type<>p_mime or v_p.size_bytes<>p_size or v_p.file_sha256 is distinct from p_hash then raise exception 'BANK_PROOF_CHANGED'; end if;
  if v_p.status='UPLOAD_CANCELADO' then raise exception 'BANK_PROOF_EXPIRED'; end if;
  if v_p.status='ARQUIVO_PENDENTE' and v_p.upload_expires_at<=now() then raise exception 'BANK_PROOF_EXPIRED'; end if;
  return to_jsonb(v_p);
 end if;
 if v_c.status<>'ATIVO' or v_i.status in ('PAGO','CANCELADO','RENEGOCIADO') then raise exception 'BANK_INSTALLMENT_CLOSED'; end if;
 update public.icom_bank_payment_proofs set status='UPLOAD_CANCELADO' where installment_id=p_installment and status='ARQUIVO_PENDENTE' and upload_expires_at<=now();
 if exists(select 1 from public.icom_bank_payment_proofs where installment_id=p_installment and status in ('ARQUIVO_PENDENTE','COMPROVANTE_ENVIADO')) then raise exception 'BANK_PROOF_PENDING'; end if;
 v_path:=auth.uid()::text||'/'||p_id::text||case p_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.pdf' end;
 insert into public.icom_bank_payment_proofs(id,installment_id,object_path,mime_type,size_bytes,informed_cents,status,submitted_by,upload_expires_at,file_sha256)
 values(p_id,p_installment,v_path,p_mime,p_size,p_amount,'ARQUIVO_PENDENTE',auth.uid(),now()+interval '15 minutes',p_hash) returning * into v_p;
 return to_jsonb(v_p);
end $$;
create function public.icom_bank_submit_proof(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.icom_bank_payment_proofs; v_i public.icom_bank_installments; v_c public.icom_bank_contracts;
begin
 select * into v_p from public.icom_bank_payment_proofs where id=p_id;
 if v_p.id is null or v_p.submitted_by is distinct from auth.uid() or icom_bank_internal.role() is null then raise exception 'BANK_FORBIDDEN'; end if;
 select c.* into v_c from public.icom_bank_contracts c join public.icom_bank_installments i on i.contract_id=c.id where i.id=v_p.installment_id for update of c;
 if icom_bank_internal.role()='VENDEDOR' and v_c.seller_id is distinct from auth.uid() then raise exception 'BANK_FORBIDDEN'; end if;
 select * into v_i from public.icom_bank_installments where id=v_p.installment_id for update;
 select * into v_p from public.icom_bank_payment_proofs where id=p_id for update;
 if v_p.status in ('COMPROVANTE_ENVIADO','APROVADO','RECUSADO') then return to_jsonb(v_p); end if;
 if v_p.status<>'ARQUIVO_PENDENTE' or v_p.upload_expires_at<=now() then raise exception 'BANK_PROOF_EXPIRED'; end if;
 if v_c.status<>'ATIVO' or v_i.status in ('PAGO','CANCELADO','RENEGOCIADO') then raise exception 'BANK_INSTALLMENT_CLOSED'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='icom-bank-documents' and o.name=v_p.object_path and (o.metadata->>'size')::bigint=v_p.size_bytes and o.metadata->>'mimetype'=v_p.mime_type) then raise exception 'BANK_PROOF_MISSING'; end if;
 update public.icom_bank_payment_proofs set status='COMPROVANTE_ENVIADO' where id=p_id returning * into v_p;
 update public.icom_bank_installments set status='COMPROVANTE_ENVIADO' where id=v_i.id;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'COMPROVANTE_ENVIADO',p_id,jsonb_build_object('installment_id',v_i.id,'informed_cents',v_p.informed_cents));
 return to_jsonb(v_p);
end $$;
create function public.icom_bank_review_proof(p_id uuid,p_decision text,p_paid_at date,p_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.icom_bank_payment_proofs; v_i public.icom_bank_installments; v_c public.icom_bank_contracts; v_payment public.icom_bank_payments; v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if icom_bank_internal.role() is null or icom_bank_internal.role() not in ('OWNER','ADMIN','GERENTE','FINANCEIRO') then raise exception 'BANK_FORBIDDEN'; end if;
 if p_decision is null or p_decision not in ('APROVADO','RECUSADO') then raise exception 'BANK_PROOF_INVALID'; end if;
 select * into v_p from public.icom_bank_payment_proofs where id=p_id;
 if v_p.id is null then raise exception 'BANK_PROOF_MISSING'; end if;
 select c.* into v_c from public.icom_bank_contracts c join public.icom_bank_installments i on i.contract_id=c.id where i.id=v_p.installment_id for update of c;
 select * into v_i from public.icom_bank_installments where id=v_p.installment_id for update;
 select * into v_p from public.icom_bank_payment_proofs where id=p_id for update;
 if v_p.status=p_decision then
  if p_decision='APROVADO' then select * into v_payment from public.icom_bank_payments where proof_id=p_id; if v_payment.paid_at is distinct from p_paid_at then raise exception 'BANK_PROOF_CHANGED'; end if;
  elsif v_p.rejection_reason is distinct from btrim(coalesce(p_reason,'')) then raise exception 'BANK_PROOF_CHANGED'; end if;
  return jsonb_build_object('status',v_p.status,'payment_id',v_payment.id);
 end if;
 if v_p.status<>'COMPROVANTE_ENVIADO' then raise exception 'BANK_PROOF_REVIEWED'; end if;
 if v_c.status<>'ATIVO' or v_i.status in ('PAGO','CANCELADO','RENEGOCIADO') then raise exception 'BANK_INSTALLMENT_CLOSED'; end if;
 if p_decision='RECUSADO' then
  if length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'BANK_PROOF_REASON'; end if;
  update public.icom_bank_payment_proofs set status='RECUSADO',reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),rejection_reason=btrim(p_reason) where id=p_id;
  update public.icom_bank_installments set status=case when due_date<v_today then 'ATRASADO' when due_date=v_today then 'VENCE_HOJE' else 'A_VENCER' end where id=v_i.id;
 else
  if p_paid_at is null or p_paid_at>v_today or p_paid_at<v_c.sale_date then raise exception 'BANK_PAYMENT_DATE'; end if;
  if v_p.informed_cents<>v_i.updated_cents-v_i.paid_cents then raise exception 'BANK_PAYMENT_AMOUNT'; end if;
  insert into public.icom_bank_payments(installment_id,proof_id,paid_at,amount_cents,approved_by) values(v_i.id,p_id,p_paid_at,v_p.informed_cents,auth.uid()) returning * into v_payment;
  update public.icom_bank_installments set status='PAGO',paid_at=p_paid_at,paid_cents=updated_cents where id=v_i.id;
  update public.icom_bank_payment_proofs set status='APROVADO',reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=p_id;
  insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'PAGAMENTO_CONFIRMADO',v_payment.id,jsonb_build_object('installment_id',v_i.id,'proof_id',p_id,'amount_cents',v_payment.amount_cents,'paid_at',p_paid_at));
  if not exists(select 1 from public.icom_bank_installments where contract_id=v_c.id and status not in ('PAGO','CANCELADO','RENEGOCIADO')) then
   update public.icom_bank_contracts set status='QUITADO' where id=v_c.id;
   insert into public.icom_bank_audit_logs(actor_id,action,entity_id) values(auth.uid(),'CONTRATO_QUITADO',v_c.id);
  end if;
 end if;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'COMPROVANTE_'||p_decision,p_id,jsonb_build_object('installment_id',v_i.id));
 return jsonb_build_object('status',p_decision,'payment_id',v_payment.id);
end $$;
revoke all on function public.icom_bank_reserve_proof(uuid,uuid,bigint,text,bigint,text),public.icom_bank_submit_proof(uuid),public.icom_bank_review_proof(uuid,text,date,text) from public,anon;
grant execute on function public.icom_bank_reserve_proof(uuid,uuid,bigint,text,bigint,text),public.icom_bank_submit_proof(uuid),public.icom_bank_review_proof(uuid,text,date,text) to authenticated;
