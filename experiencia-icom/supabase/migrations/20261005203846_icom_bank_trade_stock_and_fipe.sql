-- Trade inventory is part of the owner's private administrative ledger.
create table public.icom_bank_stock_vehicles(
 id uuid primary key default gen_random_uuid(),origin_entry_id uuid not null unique references public.icom_bank_admin_entries(id),sold_entry_id uuid unique references public.icom_bank_admin_entries(id),
 plate text not null check(plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),vehicle jsonb not null check(jsonb_typeof(vehicle)='object'),source_details jsonb not null,
 purchase_cents bigint not null check(purchase_cents between 1 and 1000000000),debt_cents bigint not null check(debt_cents between 0 and purchase_cents),entry_date date not null,
 status text not null check(status in('PREVISTO','AGUARDANDO_QUITACAO','EM_PREPARACAO','DISPONIVEL','VENDIDO')),active boolean not null default true,notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp()
);
create unique index bank_stock_active_plate on public.icom_bank_stock_vehicles(plate) where active and status<>'VENDIDO';
create index bank_stock_sold on public.icom_bank_stock_vehicles(sold_entry_id);
create table public.icom_bank_stock_history(id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.icom_bank_stock_vehicles(id),actor_id uuid references auth.users(id),previous jsonb,next jsonb not null,created_at timestamptz not null default now());
create index bank_stock_history_vehicle on public.icom_bank_stock_history(vehicle_id,created_at);
create index bank_stock_history_actor on public.icom_bank_stock_history(actor_id);
alter table public.icom_bank_stock_vehicles enable row level security;
alter table public.icom_bank_stock_history enable row level security;
revoke all on public.icom_bank_stock_vehicles,public.icom_bank_stock_history from anon,authenticated;
grant select on public.icom_bank_stock_vehicles,public.icom_bank_stock_history to authenticated;
create policy bank_stock_owner on public.icom_bank_stock_vehicles for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_stock_history_owner on public.icom_bank_stock_history for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');

create function icom_bank_internal.valid_vehicle_spec(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>4000 then return false;end if;
 foreach k in array array['brand','model','version'] loop if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>160 then return false;end if;end loop;
 if length(trim(v->>'brand'))<2 or length(trim(v->>'model'))<1 then return false;end if;
 if v->'year' is distinct from 'null'::jsonb then if coalesce(v->>'year','')!~'^(19|20)[0-9]{2}$|^2100$' then return false;end if;end if;
 if v ? 'selection' then
  if coalesce(v->'selection'->>'brand_id','')!~'^[0-9]{1,6}$' or coalesce(v->'selection'->>'model_id','')!~'^[0-9]{1,6}$' or coalesce(v->'selection'->>'year_id','')!~'^(19[0-9]{2}|20[0-9]{2}|32000)-[1-9]$' then return false;end if;
 end if;
 if v ? 'fipe' then
  if jsonb_typeof(v->'fipe') is distinct from 'object' or coalesce(v->'fipe'->>'price_cents','')!~'^[0-9]{1,10}$' then return false;end if;
  if (v->'fipe'->>'price_cents')::bigint not between 1 and 1000000000 or coalesce(v->'fipe'->>'code','')!~'^[0-9]{6}-[0-9]$' or coalesce(v->'fipe'->>'provider','')<>'Parallelum' or length(coalesce(v->'fipe'->>'reference','')) not between 4 and 80 or length(coalesce(v->'fipe'->>'consulted_at','')) not between 20 and 40 or not(v ? 'selection') then return false;end if;
  foreach k in array array['brand_id','model_id','year_id'] loop if v->'selection'->>k is distinct from v->'fipe'->>k then return false;end if;end loop;
 end if;
 return true;
end $$;
revoke all on function icom_bank_internal.valid_vehicle_spec(jsonb) from public,anon,authenticated;

create function icom_bank_internal.audit_stock() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.icom_bank_stock_history(vehicle_id,actor_id,previous,next) values(new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end $$;
revoke all on function icom_bank_internal.audit_stock() from public,anon,authenticated;
create trigger bank_stock_audit after insert or update on public.icom_bank_stock_vehicles for each row execute function icom_bank_internal.audit_stock();

create function icom_bank_internal.guard_stock_entry() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.icom_bank_stock_vehicles;v_cost bigint;begin
 if tg_op='UPDATE' and old.details ? 'stock_id' and old.details->>'stock_id' is distinct from new.details->>'stock_id' then raise exception 'BANK_STOCK_LOCKED';end if;
 if not(new.details ? 'stock_id') then return new;end if;
 if coalesce(new.details->>'stock_id','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'BANK_STOCK_INVALID';end if;
 select * into s from public.icom_bank_stock_vehicles where id=(new.details->>'stock_id')::uuid for update;
 if not found or not s.active or s.origin_entry_id=new.id or new.kind not in('VENDA','CUSTO') then raise exception 'BANK_STOCK_INVALID';end if;
 if new.kind='VENDA' and not new.active and s.sold_entry_id is distinct from new.id then return new;end if;
 if new.entry_date<s.entry_date then raise exception 'BANK_STOCK_INVALID';end if;
 if new.kind='CUSTO' then
  if s.status in('VENDIDO','PREVISTO') then raise exception 'BANK_STOCK_LOCKED';end if;
 else
  if s.status<>'DISPONIVEL' and s.sold_entry_id is distinct from new.id then raise exception 'BANK_STOCK_NOT_READY';end if;
  select coalesce(sum(amount_cents),0) into v_cost from public.icom_bank_admin_entries where active and kind='CUSTO' and status='REALIZADO' and details->>'stock_id'=s.id::text;
  if (new.details->>'purchase_cents')::bigint<>s.purchase_cents or (new.details->>'vehicle_cost_cents')::bigint<>v_cost or new.details->>'plate' is distinct from s.plate then raise exception 'BANK_STOCK_COST_CHANGED';end if;
 end if;
 return new;
end $$;
revoke all on function icom_bank_internal.guard_stock_entry() from public,anon,authenticated;
create trigger bank_stock_entry_guard before insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_stock_entry();

create function icom_bank_internal.sync_stock_entry() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.icom_bank_stock_vehicles;has_activity boolean;gross bigint;debt bigint;v_vehicle jsonb;initial_status text;begin
 if new.kind='VENDA' then
  select * into s from public.icom_bank_stock_vehicles where origin_entry_id=new.id for update;
  if found then
   select exists(select 1 from public.icom_bank_admin_entries where active and id<>new.id and details->>'stock_id'=s.id::text) into has_activity;
   if has_activity and (new.entry_date is distinct from s.entry_date or not new.active or new.status<>'REALIZADO' or new.details->>'trade_in' is distinct from 'true' or s.plate is distinct from new.details->>'trade_plate' or s.purchase_cents is distinct from (new.details->>'trade_value_cents')::bigint or (s.source_details-array['vehicle_spec','trade_spec','vehicle','trade_vehicle','notes','payment_method','payment_bank','payment_bank_other']) is distinct from (new.details-array['vehicle_spec','trade_spec','vehicle','trade_vehicle','notes','payment_method','payment_bank','payment_bank_other'])) then raise exception 'BANK_STOCK_LOCKED';end if;
  end if;
  if new.details->>'trade_in'='true' then
   gross:=(new.details->>'trade_value_cents')::bigint;
   debt:=case when new.details->>'trade_has_debts'='true' then coalesce((new.details->>'trade_ipva_cents')::bigint,0)+coalesce((new.details->>'trade_fines_cents')::bigint,0)+case when new.details->>'trade_has_payoff'='true' then coalesce((new.details->>'trade_payoff_cents')::bigint,0) else 0 end else 0 end;
   v_vehicle:=coalesce(new.details->'trade_spec',jsonb_build_object('brand','','model',new.details->>'trade_vehicle','version','','year',(new.details->>'trade_year')::integer));
   initial_status:=case when new.status='PREVISTO' then 'PREVISTO' when debt>0 then 'AGUARDANDO_QUITACAO' else 'EM_PREPARACAO' end;
   if s.id is null then
    insert into public.icom_bank_stock_vehicles(origin_entry_id,plate,vehicle,source_details,purchase_cents,debt_cents,entry_date,status,active) values(new.id,new.details->>'trade_plate',v_vehicle,new.details,gross,debt,new.entry_date,initial_status,new.active);
   else
    update public.icom_bank_stock_vehicles set plate=new.details->>'trade_plate',vehicle=v_vehicle,source_details=new.details,purchase_cents=gross,debt_cents=debt,entry_date=new.entry_date,active=new.active,status=case when new.status='PREVISTO' or s.status='PREVISTO' or s.plate<>new.details->>'trade_plate' or s.purchase_cents<>gross or s.debt_cents<>debt then initial_status else s.status end,updated_at=clock_timestamp() where id=s.id;
   end if;
  elsif s.id is not null then update public.icom_bank_stock_vehicles set active=false,updated_at=clock_timestamp() where id=s.id;end if;
 end if;
 if new.details ? 'stock_id' then
  if new.kind='VENDA' then
   update public.icom_bank_stock_vehicles set sold_entry_id=case when new.active and new.status='REALIZADO' then new.id else null end,status=case when new.active and new.status='REALIZADO' then 'VENDIDO' else 'DISPONIVEL' end,updated_at=clock_timestamp() where id=(new.details->>'stock_id')::uuid and (sold_entry_id is null or sold_entry_id=new.id);
  else update public.icom_bank_stock_vehicles set updated_at=clock_timestamp() where id=(new.details->>'stock_id')::uuid;end if;
 end if;
 return new;
end $$;
revoke all on function icom_bank_internal.sync_stock_entry() from public,anon,authenticated;
create trigger bank_stock_entry_sync after insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.sync_stock_entry();

create function public.icom_bank_update_stock(p_id uuid,p_status text,p_notes text,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.icom_bank_stock_vehicles;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_expected is null or p_status not in('AGUARDANDO_QUITACAO','EM_PREPARACAO','DISPONIVEL') or p_status is null or p_notes is null or length(p_notes)>2000 then raise exception 'BANK_STOCK_INVALID';end if;
 select * into s from public.icom_bank_stock_vehicles where id=p_id for update;
 if not found or not s.active or s.status in('VENDIDO','PREVISTO') then raise exception 'BANK_STOCK_LOCKED';end if;
 if s.updated_at is distinct from p_expected then raise exception 'BANK_STOCK_CHANGED';end if;
 update public.icom_bank_stock_vehicles set status=p_status,notes=trim(p_notes),updated_at=clock_timestamp() where id=p_id returning * into s;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'ESTOQUE_ATUALIZADO',s.id,'{"module":"ESTOQUE_TROCAS"}');
 return to_jsonb(s);
end $$;
revoke all on function public.icom_bank_update_stock(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.icom_bank_update_stock(uuid,text,text,timestamptz) to authenticated;
create or replace function public.icom_bank_save_admin_entry(p_payload jsonb,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_kind text;v_scope text;v_date date;v_amount bigint;v_description text;v_category text;v_status text;v_details jsonb;v_keys text[];v_key text;v_money text[]:=array['trade_value_cents','trade_ipva_cents','trade_fines_cents','trade_payoff_cents','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','financed_cents','tax_cents','manager_cents','seller_cents','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents'];v_before public.icom_bank_admin_entries;v_after public.icom_bank_admin_entries;v_found boolean;v_action text;v_trade bigint:=0;v_debt bigint:=0;v_remaining bigint;v_banks text[]:=array['Banco do Brasil','Bradesco','BV','C6 Bank','Caixa','Cresol','Itaú','Pan','Porto Bank','Safra','Santander','Sicoob','Sicredi','OUTRO'];
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
 when 'VENDA' then array['stock_id','vehicle_spec','trade_spec','trade_in','trade_has_debts','trade_has_payoff','trade_plate','trade_year','trade_value_cents','trade_ipva_cents','trade_fines_cents','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other','payment_bank','payment_bank_other','vehicle','trade_vehicle','plate','seller','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','notes','payment_method']
 when 'RETORNO' then array['vehicle_spec','vehicle','plate','seller','bank','return_level','financed_cents','tax_cents','manager_cents','seller_cents','notes']
 when 'TROCA' then array['vehicle_spec','vehicle','plate','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents','notes']
 when 'CUSTO' then array['stock_id','vehicle_spec','vehicle','plate','notes','payment_method']
 when 'MENSAL' then array['due_day','notes','payment_method'] else array['notes','payment_method'] end;
 for v_key in select jsonb_object_keys(v_details) loop
  if not (v_key=any(v_keys)) then raise exception 'BANK_ADMIN_INVALID';end if;
  if v_key in('vehicle_spec','trade_spec') then
   if not icom_bank_internal.valid_vehicle_spec(v_details->v_key) then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key='stock_id' then
   if jsonb_typeof(v_details->v_key) is distinct from 'string' or (v_details->>v_key)!~'^[0-9a-fA-F-]{36}$' then raise exception 'BANK_STOCK_INVALID';end if;
  elsif v_key=any(v_money) then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric>1000000000 then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key in ('trade_in','trade_has_debts','trade_has_payoff') then
   if jsonb_typeof(v_details->v_key)<>'boolean' then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key='trade_year' then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric<1900 or (v_details->>v_key)::numeric>2100 then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key in ('due_day','return_level') then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric<1 or (v_details->>v_key)::numeric>(case when v_key='due_day' then 31 else 3 end) then raise exception 'BANK_ADMIN_INVALID';end if;
  else
   if jsonb_typeof(v_details->v_key)<>'string' or length(v_details->>v_key)>(case when v_key='notes' then 2000 when v_key='plate' then 7 else 160 end) then raise exception 'BANK_ADMIN_INVALID';end if;
  end if;
 end loop;
 if coalesce(v_details->>'plate','')<>'' and (v_details->>'plate')!~'^[A-Z]{3}\d[A-Z0-9]\d{2}$' then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind in ('VENDA','RETORNO','TROCA') and length(trim(coalesce(v_details->>'vehicle','')))<1 then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind='VENDA' and not (v_details ?& array['purchase_cents','vehicle_cost_cents','commission_cents','sale_cents']) then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind='VENDA' and v_details ? 'trade_in' then
  if (v_details->>'trade_in')::boolean then
   if length(trim(coalesce(v_details->>'trade_vehicle','')))=0 or coalesce(v_details->>'trade_plate','')!~'^[A-Z]{3}\d[A-Z0-9]\d{2}$' or not(v_details ?& array['trade_year','trade_value_cents','trade_has_debts']) then raise exception 'BANK_ADMIN_INVALID';end if;
   v_trade:=(v_details->>'trade_value_cents')::bigint;if v_trade<=0 then raise exception 'BANK_ADMIN_INVALID';end if;
   if (v_details->>'trade_has_debts')::boolean then
    if not(v_details ?& array['trade_ipva_cents','trade_fines_cents','trade_has_payoff']) then raise exception 'BANK_ADMIN_INVALID';end if;
    v_debt:=(v_details->>'trade_ipva_cents')::bigint+(v_details->>'trade_fines_cents')::bigint;
    if (v_details->>'trade_has_payoff')::boolean then
     if coalesce((v_details->>'trade_payoff_cents')::bigint,0)<=0 or coalesce(v_details->>'trade_payoff_bank','')<>all(v_banks) or (v_details->>'trade_payoff_bank'='OUTRO' and length(trim(coalesce(v_details->>'trade_payoff_bank_other','')))=0) then raise exception 'BANK_ADMIN_INVALID';end if;
     v_debt:=v_debt+(v_details->>'trade_payoff_cents')::bigint;
     if v_details->>'trade_payoff_bank'<>'OUTRO' then v_details:=v_details-'trade_payoff_bank_other';end if;
    else v_details:=v_details-array['trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other'];end if;
    if v_debt=0 then raise exception 'BANK_ADMIN_INVALID';end if;
   else v_details:=v_details-array['trade_ipva_cents','trade_fines_cents','trade_has_payoff','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other'];end if;
  else v_details:=v_details-array['trade_spec','trade_vehicle','trade_plate','trade_year','trade_value_cents','trade_has_debts','trade_ipva_cents','trade_fines_cents','trade_has_payoff','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other'];end if;
  v_remaining:=(v_details->>'sale_cents')::bigint-v_trade+v_debt;
  if v_debt>v_trade or v_remaining<0 or v_amount>v_remaining then raise exception 'BANK_ADMIN_INVALID';end if;
  if coalesce(v_details->>'payment_method','') not in ('PIX','DINHEIRO','CARTAO','FINANCIAMENTO','SEM_DIFERENCA') or (v_details->>'payment_method'='SEM_DIFERENCA' and v_remaining<>0) then raise exception 'BANK_ADMIN_INVALID';end if;
  if v_details->>'payment_method'='FINANCIAMENTO' then
   if coalesce(v_details->>'payment_bank','')<>all(v_banks) or (v_details->>'payment_bank'='OUTRO' and length(trim(coalesce(v_details->>'payment_bank_other','')))=0) then raise exception 'BANK_ADMIN_INVALID';end if;
   if v_details->>'payment_bank'<>'OUTRO' then v_details:=v_details-'payment_bank_other';end if;
  else v_details:=v_details-array['payment_bank','payment_bank_other'];end if;
 end if;
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

notify pgrst,'reload schema';

-- Import structured trades already saved, without inventing brands, prices or expenses.
insert into public.icom_bank_stock_vehicles(origin_entry_id,plate,vehicle,source_details,purchase_cents,debt_cents,entry_date,status,active)
select e.id,e.details->>'trade_plate',coalesce(e.details->'trade_spec',jsonb_build_object('brand','','model',e.details->>'trade_vehicle','version','','year',(e.details->>'trade_year')::integer)),e.details,(e.details->>'trade_value_cents')::bigint,
case when e.details->>'trade_has_debts'='true' then coalesce((e.details->>'trade_ipva_cents')::bigint,0)+coalesce((e.details->>'trade_fines_cents')::bigint,0)+case when e.details->>'trade_has_payoff'='true' then coalesce((e.details->>'trade_payoff_cents')::bigint,0) else 0 end else 0 end,
e.entry_date,case when e.status='PREVISTO' then 'PREVISTO' when e.details->>'trade_has_debts'='true' then 'AGUARDANDO_QUITACAO' else 'EM_PREPARACAO' end,e.active
from public.icom_bank_admin_entries e where e.kind='VENDA' and e.details->>'trade_in'='true';
notify pgrst,'reload schema';
