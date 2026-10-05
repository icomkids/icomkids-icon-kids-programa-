create table public.icom_bank_admin_entries (
 id uuid primary key,kind text not null check(kind in ('VENDA','ENTRADA','CUSTO','RETORNO','TROCA','MENSAL','PESSOAL')),
 scope text not null check(scope in ('LOJA','PESSOAL')),entry_date date not null check(entry_date between date '2000-01-01' and date '2100-12-31'),
 description text not null check(length(description) between 2 and 160),category text not null default '' check(length(category)<=80),
 status text not null check(status in ('PREVISTO','REALIZADO')),amount_cents bigint check(amount_cents between 0 and 1000000000),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=6000),
 active boolean not null default true,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp(),
 check((kind='PESSOAL' and scope='PESSOAL') or kind='MENSAL' or (kind not in ('MENSAL','PESSOAL') and scope='LOJA')),
 check(amount_cents is not null or kind in ('MENSAL','TROCA'))
);
create index icom_bank_admin_entries_period on public.icom_bank_admin_entries(entry_date,id);
create unique index icom_bank_admin_monthly_unique on public.icom_bank_admin_entries(scope,lower(description),(date_trunc('month',entry_date::timestamp))) where kind='MENSAL' and active;
create index icom_bank_admin_entries_actor on public.icom_bank_admin_entries(created_by);
create table public.icom_bank_admin_history (
 id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.icom_bank_admin_entries(id),actor_id uuid not null references auth.users(id),action text not null,
 previous jsonb,next jsonb not null,created_at timestamptz not null default now()
);
create index icom_bank_admin_history_entry on public.icom_bank_admin_history(entry_id,created_at);
create index icom_bank_admin_history_actor on public.icom_bank_admin_history(actor_id);
create table public.icom_bank_admin_references (id integer primary key check(id=1),content jsonb not null check(jsonb_typeof(content)='object'),created_at timestamptz not null default now());
alter table public.icom_bank_admin_entries enable row level security;
alter table public.icom_bank_admin_history enable row level security;
alter table public.icom_bank_admin_references enable row level security;
revoke all on public.icom_bank_admin_entries,public.icom_bank_admin_history,public.icom_bank_admin_references from anon,authenticated;
grant select on public.icom_bank_admin_entries,public.icom_bank_admin_history,public.icom_bank_admin_references to authenticated;
create policy bank_admin_owner_read on public.icom_bank_admin_entries for select to authenticated using ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_admin_owner_history on public.icom_bank_admin_history for select to authenticated using ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_admin_owner_references on public.icom_bank_admin_references for select to authenticated using ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');

create function public.icom_bank_save_admin_entry(p_payload jsonb,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_kind text;v_scope text;v_date date;v_amount bigint;v_description text;v_category text;v_status text;v_details jsonb;v_keys text[];v_key text;v_money text[]:=array['purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','financed_cents','tax_cents','manager_cents','seller_cents','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents'];v_before public.icom_bank_admin_entries;v_after public.icom_bank_admin_entries;v_found boolean;v_action text;
begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>8000 then raise exception 'BANK_ADMIN_INVALID';end if;
 begin
  v_id:=(p_payload->>'id')::uuid;v_kind:=p_payload->>'kind';v_scope:=p_payload->>'scope';v_date:=(p_payload->>'entry_date')::date;
  v_description:=trim(p_payload->>'description');v_category:=coalesce(trim(p_payload->>'category'),'');v_status:=p_payload->>'status';v_details:=p_payload->'details';
  if p_payload->>'amount_cents' is not null then
   if jsonb_typeof(p_payload->'amount_cents')<>'number' or (p_payload->>'amount_cents')!~'^\d+$' then raise exception 'BANK_ADMIN_INVALID';end if;
   v_amount:=(p_payload->>'amount_cents')::bigint;
  end if;
 exception when others then raise exception 'BANK_ADMIN_INVALID';end;
 if v_id is null or v_kind is null or v_kind not in ('VENDA','ENTRADA','CUSTO','RETORNO','TROCA','MENSAL','PESSOAL') or v_scope is null or v_scope not in ('LOJA','PESSOAL') or
 (v_kind='PESSOAL' and v_scope<>'PESSOAL') or (v_kind not in ('MENSAL','PESSOAL') and v_scope<>'LOJA') or v_date is null or v_date<date '2000-01-01' or v_date>date '2100-12-31' or
 (p_payload->>'entry_date')!~'^\d{4}-\d{2}-\d{2}$' or to_char(v_date,'YYYY-MM-DD')<>p_payload->>'entry_date' or
 v_description is null or length(v_description)<2 or length(v_description)>160 or length(v_category)>80 or v_status is null or v_status not in ('PREVISTO','REALIZADO') or
 (v_amount is null and v_kind not in ('MENSAL','TROCA')) or v_amount<0 or v_amount>1000000000 or jsonb_typeof(v_details) is distinct from 'object' or octet_length(v_details::text)>6000 then raise exception 'BANK_ADMIN_INVALID';end if;
 v_keys:=case v_kind
 when 'VENDA' then array['vehicle','trade_vehicle','plate','seller','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','notes','payment_method']
 when 'RETORNO' then array['vehicle','plate','seller','bank','return_level','financed_cents','tax_cents','manager_cents','seller_cents','notes']
 when 'TROCA' then array['vehicle','plate','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents','notes']
 when 'CUSTO' then array['vehicle','plate','notes','payment_method']
 when 'MENSAL' then array['due_day','notes','payment_method'] else array['notes','payment_method'] end;
 for v_key in select jsonb_object_keys(v_details) loop
  if not (v_key=any(v_keys)) then raise exception 'BANK_ADMIN_INVALID';end if;
  if v_key=any(v_money) then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric>1000000000 then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key in ('due_day','return_level') then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric<1 or (v_details->>v_key)::numeric>(case when v_key='due_day' then 31 else 3 end) then raise exception 'BANK_ADMIN_INVALID';end if;
  else
   if jsonb_typeof(v_details->v_key)<>'string' or length(v_details->>v_key)>(case when v_key='notes' then 2000 when v_key='plate' then 7 else 160 end) then raise exception 'BANK_ADMIN_INVALID';end if;
  end if;
 end loop;
 if coalesce(v_details->>'plate','')<>'' and (v_details->>'plate')!~'^[A-Z]{3}\d[A-Z0-9]\d{2}$' then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind in ('VENDA','RETORNO','TROCA') and length(trim(coalesce(v_details->>'vehicle','')))<1 then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind='VENDA' and not (v_details ?& array['purchase_cents','vehicle_cost_cents','commission_cents','sale_cents']) then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind='RETORNO' and coalesce((v_details->>'tax_cents')::bigint,0)+coalesce((v_details->>'manager_cents')::bigint,0)+coalesce((v_details->>'seller_cents')::bigint,0)>v_amount then raise exception 'BANK_ADMIN_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text,0));
 select * into v_before from public.icom_bank_admin_entries where id=v_id for update;v_found:=found;
 if v_found then
  if p_expected is null then
   if v_before.created_by=auth.uid() and v_before.active and v_before.kind=v_kind and v_before.scope=v_scope and v_before.entry_date=v_date and v_before.description=v_description and v_before.category=v_category and v_before.status=v_status and v_before.amount_cents is not distinct from v_amount and v_before.details=v_details then return to_jsonb(v_before);end if;
   raise exception 'BANK_ADMIN_CHANGED';
  end if;
  if not v_before.active or v_before.updated_at is distinct from p_expected then raise exception 'BANK_ADMIN_CHANGED';end if;
  update public.icom_bank_admin_entries set kind=v_kind,scope=v_scope,entry_date=v_date,description=v_description,category=v_category,status=v_status,amount_cents=v_amount,details=v_details,updated_at=clock_timestamp() where id=v_id returning * into v_after;v_action:='EDITADO';
 else
  if p_expected is not null then raise exception 'BANK_ADMIN_CHANGED';end if;
  insert into public.icom_bank_admin_entries(id,kind,scope,entry_date,description,category,status,amount_cents,details,created_by) values(v_id,v_kind,v_scope,v_date,v_description,v_category,v_status,v_amount,v_details,auth.uid()) returning * into v_after;v_action:='CRIADO';
 end if;
 insert into public.icom_bank_admin_history(entry_id,actor_id,action,previous,next) values(v_id,auth.uid(),v_action,case when v_found then to_jsonb(v_before) else null end,to_jsonb(v_after));
 -- The general audit is visible to other administrative roles; private financial snapshots stay in the owner-only history.
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'ADMINISTRATIVO_'||v_action,v_id,'{"module":"ADMINISTRATIVO"}');
 return to_jsonb(v_after);
exception when unique_violation then raise exception 'BANK_ADMIN_DUPLICATE';
end $$;
revoke all on function public.icom_bank_save_admin_entry(jsonb,timestamptz) from public,anon;
grant execute on function public.icom_bank_save_admin_entry(jsonb,timestamptz) to authenticated;

create function public.icom_bank_archive_admin_entry(p_id uuid,p_active boolean,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_before public.icom_bank_admin_entries;v_after public.icom_bank_admin_entries;v_action text;
begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_active is null or p_expected is null then raise exception 'BANK_ADMIN_INVALID';end if;
 select * into v_before from public.icom_bank_admin_entries where id=p_id for update;
 if not found then raise exception 'BANK_ADMIN_CHANGED';end if;
 if v_before.active=p_active then return to_jsonb(v_before);end if;
 if v_before.updated_at is distinct from p_expected then raise exception 'BANK_ADMIN_CHANGED';end if;
 update public.icom_bank_admin_entries set active=p_active,updated_at=clock_timestamp() where id=p_id returning * into v_after;
 v_action:=case when p_active then 'RESTAURADO' else 'ARQUIVADO' end;
 insert into public.icom_bank_admin_history(entry_id,actor_id,action,previous,next) values(p_id,auth.uid(),v_action,to_jsonb(v_before),to_jsonb(v_after));
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'ADMINISTRATIVO_'||v_action,p_id,'{"module":"ADMINISTRATIVO"}');
 return to_jsonb(v_after);
exception when unique_violation then raise exception 'BANK_ADMIN_DUPLICATE';
end $$;
revoke all on function public.icom_bank_archive_admin_entry(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.icom_bank_archive_admin_entry(uuid,boolean,timestamptz) to authenticated;
notify pgrst,'reload schema';
