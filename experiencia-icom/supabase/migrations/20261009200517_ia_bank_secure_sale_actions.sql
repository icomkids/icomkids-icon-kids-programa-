
create table icom_bank_internal.deletion_secret(singleton boolean primary key default true check(singleton),password_hash text not null,updated_by uuid not null,updated_at timestamptz not null default now());
create table icom_bank_internal.deletion_attempts(actor_id uuid primary key,failed integer not null default 0,window_start timestamptz not null default now());
create table icom_bank_internal.deletion_approvals(id uuid primary key default gen_random_uuid(),actor_id uuid not null,operation text not null,target_id uuid not null,expires_at timestamptz not null,used_txid bigint);
revoke all on icom_bank_internal.deletion_secret,icom_bank_internal.deletion_attempts,icom_bank_internal.deletion_approvals from public,anon,authenticated;
alter table icom_bank_internal.deletion_secret enable row level security;
alter table icom_bank_internal.deletion_attempts enable row level security;
alter table icom_bank_internal.deletion_approvals enable row level security;
create or replace function public.icom_bank_deletion_status() returns boolean language sql security definer set search_path='' as $$ select icom_bank_internal.role() is not null and exists(select 1 from icom_bank_internal.deletion_secret); $$;
revoke all on function public.icom_bank_deletion_status() from public,anon;grant execute on function public.icom_bank_deletion_status() to authenticated;
create or replace function public.icom_bank_set_deletion_password(p_actor uuid,p_password text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.icom_bank_user_access where user_id=p_actor and active and role='OWNER') then raise exception 'BANK_FORBIDDEN';end if;
 if length(p_password) not between 8 and 64 or octet_length(p_password)>72 then raise exception 'BANK_INVALID';end if;
 insert into icom_bank_internal.deletion_secret(singleton,password_hash,updated_by) values(true,extensions.crypt(p_password,extensions.gen_salt('bf',10)),p_actor) on conflict(singleton) do update set password_hash=excluded.password_hash,updated_by=p_actor,updated_at=clock_timestamp();
 delete from icom_bank_internal.deletion_approvals;delete from icom_bank_internal.deletion_attempts;
 insert into public.icom_bank_audit_logs(actor_id,action,details) values(p_actor,'SENHA_EXCLUSAO_ALTERADA','{}');
 return true;
end $$;
revoke all on function public.icom_bank_set_deletion_password(uuid,text) from public,anon,authenticated;grant execute on function public.icom_bank_set_deletion_password(uuid,text) to service_role;

create or replace function public.icom_bank_authorize_deletion(p_password text,p_operation text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r text:=icom_bank_internal.role();a icom_bank_internal.deletion_attempts;h text;approval uuid;
begin
 if actor is null or r is null or p_id is null or p_operation is null or p_operation not in ('archive_admin','archive_expense','archive_receivable','archive_wealth','archive_account','archive_investor','reverse_payable','reverse_receipt','reverse_payment','cancel_contract') or (r<>'OWNER' and not (r='ADMIN' and p_operation in ('reverse_payment','cancel_contract'))) then return jsonb_build_object('error','FORBIDDEN');end if;
 perform pg_advisory_xact_lock(hashtextextended('bank-delete:'||actor::text,3));
 select password_hash into h from icom_bank_internal.deletion_secret where singleton;
 if h is null then return jsonb_build_object('error','NOT_CONFIGURED');end if;
 insert into icom_bank_internal.deletion_attempts(actor_id) values(actor) on conflict do nothing;
 select * into a from icom_bank_internal.deletion_attempts where actor_id=actor for update;
 if a.window_start<clock_timestamp()-interval '15 minutes' then update icom_bank_internal.deletion_attempts set failed=0,window_start=clock_timestamp() where actor_id=actor;a.failed:=0;end if;
 if a.failed>=5 then return jsonb_build_object('error','LOCKED');end if;
 if p_password is null or length(p_password) not between 8 and 64 or octet_length(p_password)>72 or extensions.crypt(p_password,h)<>h then
 update icom_bank_internal.deletion_attempts set failed=failed+1 where actor_id=actor;return jsonb_build_object('error','INVALID');
 end if;
 update icom_bank_internal.deletion_attempts set failed=0 where actor_id=actor;
 delete from icom_bank_internal.deletion_approvals where expires_at<clock_timestamp()-interval '5 minutes';
 insert into icom_bank_internal.deletion_approvals(actor_id,operation,target_id,expires_at) values(actor,p_operation,p_id,clock_timestamp()+interval '60 seconds') returning id into approval;
 return jsonb_build_object('approval',approval);
end $$;
revoke all on function public.icom_bank_authorize_deletion(text,text,uuid) from public,anon;grant execute on function public.icom_bank_authorize_deletion(text,text,uuid) to authenticated;

create or replace function icom_bank_internal.require_deletion(p_operation text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;a icom_bank_internal.deletion_approvals;
begin
 begin v_id:=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-bank-delete-approval')::uuid;exception when others then raise exception 'BANK_DELETE_REQUIRED';end;
 select * into a from icom_bank_internal.deletion_approvals where id=v_id for update;
 if a.id is null or a.actor_id is distinct from auth.uid() or a.expires_at<clock_timestamp() then raise exception 'BANK_DELETE_REQUIRED';end if;
 -- A single authorized operation may archive its linked ledger rows in this transaction.
 if a.used_txid=txid_current() then return;end if;
 if a.used_txid is not null or a.operation<>p_operation or a.target_id<>p_id then raise exception 'BANK_DELETE_REQUIRED';end if;
 update icom_bank_internal.deletion_approvals set used_txid=txid_current() where id=v_id;
end $$;
revoke all on function icom_bank_internal.require_deletion(text,uuid) from public,anon,authenticated;

create or replace function icom_bank_internal.guard_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_argv[1]='active' then
  if old.active and not new.active then perform icom_bank_internal.require_deletion(tg_argv[0],new.id);end if;
 else
  if old.status is distinct from new.status and new.status=tg_argv[1] then perform icom_bank_internal.require_deletion(tg_argv[0],new.id);end if;
 end if;
 return new;
end $$;
revoke all on function icom_bank_internal.guard_deletion() from public,anon,authenticated;
create trigger bank_password_before_delete before update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_deletion('archive_admin','active');
create trigger bank_password_before_delete before update on public.icom_bank_personal_wealth for each row execute function icom_bank_internal.guard_deletion('archive_wealth','active');
create trigger bank_password_before_delete before update on public.icom_bank_accounts for each row execute function icom_bank_internal.guard_deletion('archive_account','active');
create trigger bank_password_before_delete before update on public.icom_bank_investors for each row execute function icom_bank_internal.guard_deletion('archive_investor','active');
create trigger bank_password_before_delete before update on public.icom_bank_payables for each row execute function icom_bank_internal.guard_deletion('archive_expense','active');
create trigger bank_password_before_delete before update on public.icom_bank_receivables for each row execute function icom_bank_internal.guard_deletion('archive_receivable','active');
create trigger bank_password_before_delete before update on public.icom_bank_receipts for each row execute function icom_bank_internal.guard_deletion('reverse_receipt','active');
create trigger bank_password_before_delete before update on public.icom_bank_payments for each row execute function icom_bank_internal.guard_deletion('reverse_payment','ESTORNADO');
create trigger bank_password_before_delete before update on public.icom_bank_payment_proofs for each row execute function icom_bank_internal.guard_deletion('reverse_payment','ESTORNADO');
create trigger bank_password_before_delete before update on public.icom_bank_contracts for each row execute function icom_bank_internal.guard_deletion('cancel_contract','CANCELADO');
CREATE OR REPLACE FUNCTION public.icom_bank_reverse_payable(p_id uuid, p_reason text, p_expected timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare p public.icom_bank_payables;s public.icom_bank_stock_vehicles;e public.icom_bank_admin_entries;begin

 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;

 if p_id is null or p_expected is null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'BANK_PAYABLE_INVALID';end if;

 select v.* into s from public.icom_bank_stock_vehicles v join public.icom_bank_payables q on q.stock_id=v.id where q.id=p_id for update of v;

 select * into p from public.icom_bank_payables where id=p_id for update;

 if p.id is null or not p.active then raise exception 'BANK_PAYABLE_CLOSED';end if;

 if p.status='PENDENTE' then return to_jsonb(p);end if;

 if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;

 select * into strict e from public.icom_bank_admin_entries where id=p.ledger_entry_id for update;

 update icom_bank_internal.payable_ledger_links set reversed=true where ledger_entry_id=e.id;

 update public.icom_bank_payables set status='PENDENTE',paid_at=null,method=null,ledger_entry_id=null,receipt_id=null,updated_at=clock_timestamp() where id=p_id returning * into p;

 perform public.icom_bank_archive_admin_entry(e.id,false,e.updated_at);

 if p.stock_id is not null and s.status<>'VENDIDO' then update public.icom_bank_stock_vehicles set status='AGUARDANDO_QUITACAO',updated_at=clock_timestamp() where id=s.id;end if;

 insert into public.icom_bank_payable_history(payable_id,actor_id,previous,next) values(p.id,auth.uid(),null,jsonb_build_object('action','BAIXA_DESFEITA','reason',trim(p_reason),'ledger_entry_id',e.id));

 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'BAIXA_DESFEITA',p.id,'{"module":"CONTAS_A_PAGAR"}');return to_jsonb(p);

end $function$
;

CREATE OR REPLACE FUNCTION public.icom_bank_reverse_payment(p_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text:=icom_bank_internal.role();v_p public.icom_bank_payments;v_i public.icom_bank_installments;v_c public.icom_bank_contracts;v_proof public.icom_bank_payment_proofs;v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 perform icom_bank_internal.require_deletion('reverse_payment',p_id);
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
end $function$
;

CREATE OR REPLACE FUNCTION public.icom_bank_reverse_receipt(p_id uuid, p_receipt uuid, p_reason text, p_expected timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.icom_bank_receivables;s public.icom_bank_admin_entries;e public.icom_bank_admin_entries;p public.icom_bank_receipts;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_receipt is null or p_expected is null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 select a.* into s from public.icom_bank_admin_entries a join public.icom_bank_receivables q on q.source_entry_id=a.id where q.id=p_id for update of a;
 select * into r from public.icom_bank_receivables where id=p_id for update;
 if not found or not r.active then raise exception 'BANK_RECEIVABLE_CLOSED';end if;
 select * into p from public.icom_bank_receipts where id=p_receipt and receivable_id=p_id for update;
 if not found then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 if not p.active then return to_jsonb(r);end if;
 if r.updated_at is distinct from p_expected then raise exception 'BANK_RECEIVABLE_CHANGED';end if;
 select * into strict e from public.icom_bank_admin_entries where id=p.ledger_entry_id for update;
 update public.icom_bank_receipts set active=false,reason=trim(p_reason),updated_at=clock_timestamp() where id=p_receipt;
 perform public.icom_bank_archive_admin_entry(e.id,false,e.updated_at);
 update public.icom_bank_receivables set received_cents=received_cents-p.amount_cents,updated_at=clock_timestamp() where id=p_id returning * into r;
 insert into public.icom_bank_receivable_history(receivable_id,actor_id,next) values(p_id,auth.uid(),jsonb_build_object('action','RECEBIMENTO_DESFEITO','receipt_id',p_receipt,'reason',trim(p_reason)));
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'RECEBIMENTO_DESFEITO',p_id,'{"module":"CONTAS_A_RECEBER"}');return to_jsonb(r);
end $function$
;

alter table public.icom_bank_contracts add column updated_at timestamptz not null default now();
create or replace function icom_bank_internal.contract_updated() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=clock_timestamp();return new;end $$;
create trigger bank_contract_updated before update on public.icom_bank_contracts for each row execute function icom_bank_internal.contract_updated();

create or replace function public.icom_bank_update_contract(p_id uuid,p_expected timestamptz,p_vehicle jsonb,p_finance jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();role_name text:=icom_bank_internal.role();existing public.icom_bank_contracts;p_customer uuid;price bigint;entry bigint;principal bigint;installment bigint;amount bigint;qty integer;sold date;first_due date;due date;period text;v_plate text;fingerprint text;today date:=(now() at time zone 'America/Sao_Paulo')::date;i integer;anchor integer;
begin
 if actor is null or role_name is null or role_name not in('OWNER','ADMIN','GERENTE','VENDEDOR') then raise exception 'BANK_FORBIDDEN';end if;
 select * into existing from public.icom_bank_contracts where id=p_id for update;
 if not found or role_name='VENDEDOR' and existing.seller_id is distinct from actor then raise exception 'BANK_FORBIDDEN';end if;
 if existing.status<>'ATIVO' then raise exception 'BANK_CONTRACT_LOCKED';end if;
 if p_expected is null or existing.updated_at<>p_expected then raise exception 'BANK_CONTRACT_CHANGED';end if;
 if jsonb_typeof(p_vehicle) is distinct from 'object' or jsonb_typeof(p_finance) is distinct from 'object' then raise exception 'BANK_INVALID';end if;
 if exists(select 1 from public.icom_bank_installments i where i.contract_id=p_id and i.paid_cents>0) or exists(select 1 from public.icom_bank_payments p join public.icom_bank_installments i on i.id=p.installment_id where i.contract_id=p_id and p.status<>'ESTORNADO') or exists(select 1 from public.icom_bank_payment_proofs p join public.icom_bank_installments i on i.id=p.installment_id where i.contract_id=p_id and p.status not in ('RECUSADO','REJEITADO','EXPIRADO','UPLOAD_CANCELADO','ESTORNADO')) then raise exception 'BANK_CONTRACT_LOCKED';end if;
 p_customer:=existing.customer_id;
  if (p_vehicle ? 'brand' and jsonb_typeof(p_vehicle->'brand') is distinct from 'string') or (p_vehicle ? 'model' and jsonb_typeof(p_vehicle->'model') is distinct from 'string') or length(trim(coalesce(p_vehicle->>'brand',''))) not between 0 and 160 or length(trim(coalesce(p_vehicle->>'model',''))) not between 0 and 160 or length(trim(coalesce(p_vehicle->>'brand','')))=1 or length(trim(coalesce(p_vehicle->>'model','')))=1 then raise exception 'BANK_VEHICLE_INVALID';end if;
 v_plate:=upper(trim(coalesce(p_vehicle->>'plate','')));if (p_vehicle ? 'plate' and jsonb_typeof(p_vehicle->'plate') is distinct from 'string') or (v_plate<>'' and v_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$') then raise exception 'BANK_PLATE_INVALID';end if;
 if octet_length(p_vehicle::text)>10000 or octet_length(p_finance::text)>8000 then raise exception 'BANK_INVALID';end if;
 -- Strict integer validation also applies to direct RPC callers.
 if coalesce(p_finance->>'vehicle_cents','') !~ '^[0-9]+$' or coalesce(p_finance->>'down_payment_cents','') !~ '^[0-9]+$' or coalesce(p_finance->>'installment_cents','') !~ '^[0-9]+$' or coalesce(p_finance->>'count','') !~ '^[0-9]+$' then raise exception 'BANK_AMOUNTS_INVALID';end if;
 price:=(p_finance->>'vehicle_cents')::bigint; entry:=(p_finance->>'down_payment_cents')::bigint; installment:=(p_finance->>'installment_cents')::bigint;qty:=(p_finance->>'count')::integer;
 if price not between 1 and 1000000000 or entry<0 or entry>=price or installment not between 1 and 1000000000 or qty not between 1 and 120 then raise exception 'BANK_AMOUNTS_INVALID';end if;
 principal:=price-entry;amount:=installment*qty;if amount<principal then raise exception 'BANK_TOTAL_INVALID';end if;
 if coalesce(p_finance->>'sale_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_finance->>'first_due','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'BANK_DATE_INVALID';end if;
 sold:=(p_finance->>'sale_date')::date;first_due:=(p_finance->>'first_due')::date;period:=p_finance->>'period';
 if sold>today or first_due<sold or period is null or period not in('MENSAL','QUINZENAL','SEMANAL') then raise exception 'BANK_DATE_INVALID';end if;
 if coalesce(p_finance->>'interest_bps','') !~ '^[0-9]+$' or coalesce(p_finance->>'fine_bps','') !~ '^[0-9]+$' or coalesce(p_finance->>'late_interest_bps','') !~ '^[0-9]+$' then raise exception 'BANK_RATE_INVALID';end if;
 if (p_finance->>'interest_bps')::integer not between 0 and 10000 or (p_finance->>'fine_bps')::integer not between 0 and 10000 or (p_finance->>'late_interest_bps')::integer not between 0 and 10000 then raise exception 'BANK_RATE_INVALID';end if;
 if v_plate<>'' and exists(select 1 from public.icom_bank_contracts c join public.icom_bank_vehicles v on v.id=c.vehicle_id where c.id<>p_id and c.status='ATIVO' and v.plate=v_plate) then raise exception 'BANK_PLATE_ACTIVE';end if;
 -- Serialize concurrent submissions for the same plate before rechecking.
 if v_plate<>'' then perform pg_advisory_xact_lock(hashtextextended(v_plate,1));end if;
 if v_plate<>'' and exists(select 1 from public.icom_bank_contracts c join public.icom_bank_vehicles v on v.id=c.vehicle_id where c.id<>p_id and c.status='ATIVO' and v.plate=v_plate) then raise exception 'BANK_PLATE_ACTIVE';end if;

 fingerprint:=md5(jsonb_build_object('customer',p_customer,'vehicle',p_vehicle,'finance',p_finance)::text);
 update public.icom_bank_vehicles set brand=trim(coalesce(p_vehicle->>'brand','')),model=trim(coalesce(p_vehicle->>'model','')),plate=v_plate,details=p_vehicle-'brand'-'model'-'plate' where id=existing.vehicle_id;
 update public.icom_bank_contracts set principal_cents=principal,down_payment_cents=entry,total_cents=amount,sale_date=sold,terms=p_finance||jsonb_build_object('created_by',existing.terms->>'created_by','request_hash',fingerprint) where id=p_id;
 update public.icom_bank_installments set status='CANCELADO' where contract_id=p_id and number>qty;
 anchor:=extract(day from first_due)::integer;
 for i in 0..qty-1 loop
 if period='MENSAL' then due:=(date_trunc('month',first_due)+make_interval(months=>i))::date;due:=due+(least(anchor,extract(day from (due+interval '1 month - 1 day'))::integer)-1);else due:=first_due+i*(case when period='SEMANAL' then 7 else 15 end);end if;
 insert into public.icom_bank_installments(contract_id,number,due_date,original_cents,updated_cents,status) values(p_id,i+1,due,installment,installment,case when due<today then 'ATRASADO' when due=today then 'VENCE_HOJE' else 'A_VENCER' end)
 on conflict(contract_id,number) do update set due_date=excluded.due_date,original_cents=excluded.original_cents,updated_cents=excluded.updated_cents,status=excluded.status;
 end loop;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(actor,'PEDIDO_EDITADO',p_id,jsonb_build_object('before',to_jsonb(existing),'finance',p_finance,'vehicle',p_vehicle));
 return jsonb_build_object('id',p_id,'number',existing.number);
end $$;
revoke all on function public.icom_bank_update_contract(uuid,timestamptz,jsonb,jsonb) from public,anon;grant execute on function public.icom_bank_update_contract(uuid,timestamptz,jsonb,jsonb) to authenticated;

create or replace function public.icom_bank_cancel_contract(p_id uuid,p_expected timestamptz,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.icom_bank_contracts;r text:=icom_bank_internal.role();
begin
 if r is null or r not in ('OWNER','ADMIN') then raise exception 'BANK_FORBIDDEN';end if;
 perform icom_bank_internal.require_deletion('cancel_contract',p_id);
 select * into c from public.icom_bank_contracts where id=p_id for update;
 if not found or p_expected is null or c.updated_at<>p_expected then raise exception 'BANK_CONTRACT_CHANGED';end if;
 if c.status<>'ATIVO' then raise exception 'BANK_CONTRACT_LOCKED';end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'BANK_REVERSAL_REASON';end if;
 if exists(select 1 from public.icom_bank_installments i where i.contract_id=p_id and i.paid_cents>0) or exists(select 1 from public.icom_bank_payments p join public.icom_bank_installments i on i.id=p.installment_id where i.contract_id=p_id and p.status<>'ESTORNADO') or exists(select 1 from public.icom_bank_payment_proofs p join public.icom_bank_installments i on i.id=p.installment_id where i.contract_id=p_id and p.status not in ('RECUSADO','REJEITADO','EXPIRADO','UPLOAD_CANCELADO','ESTORNADO')) then raise exception 'BANK_CONTRACT_LOCKED';end if;
 update public.icom_bank_contracts set status='CANCELADO' where id=p_id;
 update public.icom_bank_installments set status='CANCELADO' where contract_id=p_id;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'VENDA_CANCELADA',p_id,jsonb_build_object('reason',btrim(p_reason),'before',to_jsonb(c)));
 return jsonb_build_object('id',p_id,'status','CANCELADO');
end $$;
revoke all on function public.icom_bank_cancel_contract(uuid,timestamptz,text) from public,anon;grant execute on function public.icom_bank_cancel_contract(uuid,timestamptz,text) to authenticated;
notify pgrst, 'reload schema';
