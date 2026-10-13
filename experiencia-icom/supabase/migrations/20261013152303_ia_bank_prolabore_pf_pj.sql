-- Internal PJ -> PF records: no new revenue or expense is added to the consolidated ledger.
create table public.icom_bank_prolabore (
 id uuid primary key, owner_id uuid not null default auth.uid(),
 reference_month text not null check(reference_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 paid_at date not null check(paid_at>=date '2000-01-01'),
 amount_cents bigint not null check(amount_cents between 1 and 1000000000),
 source_account_id uuid not null references public.icom_bank_accounts(id),
 target_account_id uuid not null references public.icom_bank_accounts(id),
 notes text not null default '' check(length(notes)<=1000),
 status text not null default 'REALIZADO' check(status in('REALIZADO','CANCELADO')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check(source_account_id<>target_account_id)
);
create index bank_prolabore_owner_date on public.icom_bank_prolabore(owner_id,paid_at desc,id);
create index bank_prolabore_source on public.icom_bank_prolabore(source_account_id);
create index bank_prolabore_target on public.icom_bank_prolabore(target_account_id);
alter table public.icom_bank_prolabore enable row level security;
revoke all on public.icom_bank_prolabore from public,anon,authenticated;
grant select,insert,update on public.icom_bank_prolabore to authenticated;
create policy owner_read on public.icom_bank_prolabore for select to authenticated using(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');
create policy owner_insert on public.icom_bank_prolabore for insert to authenticated with check(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');
create policy owner_update on public.icom_bank_prolabore for update to authenticated using(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER') with check(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');

create function icom_bank_internal.guard_prolabore() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' or new.owner_id<>auth.uid() then raise exception 'BANK_FORBIDDEN';end if;
 if tg_op='INSERT' then
  if new.status<>'REALIZADO' or new.paid_at>(clock_timestamp() at time zone 'America/Sao_Paulo')::date or new.reference_month<'2000-01' or new.reference_month>to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM') then raise exception 'BANK_PROLABORE_INVALID';end if;
  perform 1 from public.icom_bank_accounts where id in(new.source_account_id,new.target_account_id) order by id for update;
  if not exists(select 1 from public.icom_bank_accounts where id=new.source_account_id and owner_id=auth.uid() and active and scope='LOJA') or not exists(select 1 from public.icom_bank_accounts where id=new.target_account_id and owner_id=auth.uid() and active and scope='PESSOAL') then raise exception 'BANK_PROLABORE_ACCOUNTS';end if;
  new.created_at:=clock_timestamp();
 else
  if (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at') or old.status<>'REALIZADO' or new.status<>'CANCELADO' then raise exception 'BANK_PROLABORE_CHANGED';end if;
  perform icom_bank_internal.require_deletion('cancel_prolabore',old.id);
 end if;
 new.updated_at:=clock_timestamp();
 insert into icom_bank_internal.account_history(actor_id,entity,entity_id,old_data,new_data) values(auth.uid(),tg_table_name,new.id,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
revoke all on function icom_bank_internal.guard_prolabore() from public,anon,authenticated;
create trigger guard_prolabore before insert or update on public.icom_bank_prolabore for each row execute function icom_bank_internal.guard_prolabore();

create function icom_bank_internal.prolabore_account_scope() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.scope<>old.scope and exists(select 1 from public.icom_bank_prolabore where source_account_id=old.id or target_account_id=old.id) then raise exception 'BANK_PROLABORE_ACCOUNTS';end if;return new;
end $$;
revoke all on function icom_bank_internal.prolabore_account_scope() from public,anon,authenticated;
create trigger prolabore_account_scope before update on public.icom_bank_accounts for each row execute function icom_bank_internal.prolabore_account_scope();

create function public.icom_bank_save_prolabore(p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_prolabore;identifier uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>4000 then raise exception 'BANK_PROLABORE_INVALID';end if;
 identifier:=(p_payload->>'id')::uuid;if identifier is null then raise exception 'BANK_PROLABORE_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(identifier::text,19));
 select * into r from public.icom_bank_prolabore where id=identifier for update;
 if found then
  if r.status='REALIZADO' and r.reference_month=p_payload->>'reference_month' and r.paid_at=(p_payload->>'paid_at')::date and r.amount_cents=(p_payload->>'amount_cents')::bigint and r.source_account_id=(p_payload->>'source_account_id')::uuid and r.target_account_id=(p_payload->>'target_account_id')::uuid and r.notes=coalesce(p_payload->>'notes','') then return to_jsonb(r);end if;
  raise exception 'BANK_PROLABORE_CHANGED';
 end if;
 insert into public.icom_bank_prolabore(id,reference_month,paid_at,amount_cents,source_account_id,target_account_id,notes) values(identifier,p_payload->>'reference_month',(p_payload->>'paid_at')::date,(p_payload->>'amount_cents')::bigint,(p_payload->>'source_account_id')::uuid,(p_payload->>'target_account_id')::uuid,coalesce(p_payload->>'notes','')) returning * into r;
 return to_jsonb(r);
end $$;
create function public.icom_bank_cancel_prolabore(p_id uuid,p_expected timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_prolabore;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 select * into r from public.icom_bank_prolabore where id=p_id for update;
 if not found or r.owner_id<>auth.uid() or r.status<>'REALIZADO' or p_expected is distinct from r.updated_at then raise exception 'BANK_PROLABORE_CHANGED';end if;
 update public.icom_bank_prolabore set status='CANCELADO' where id=p_id returning * into r;return to_jsonb(r);
end $$;
revoke all on function public.icom_bank_save_prolabore(jsonb),public.icom_bank_cancel_prolabore(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.icom_bank_save_prolabore(jsonb),public.icom_bank_cancel_prolabore(uuid,timestamptz) to authenticated;
CREATE OR REPLACE FUNCTION public.icom_bank_authorize_deletion(p_password text, p_operation text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid();r text:=icom_bank_internal.role();a icom_bank_internal.deletion_attempts;h text;approval uuid;
begin
 if actor is null or r is null or p_id is null or p_operation is null or p_operation not in ('archive_admin','archive_expense','archive_receivable','archive_wealth','archive_account','cancel_prolabore','archive_investor','reverse_payable','reverse_receipt','reverse_payment','cancel_contract') or (r<>'OWNER' and not (r='ADMIN' and p_operation in ('reverse_payment','cancel_contract'))) then return jsonb_build_object('error','FORBIDDEN');end if;
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
end $function$;
notify pgrst,'reload schema';
