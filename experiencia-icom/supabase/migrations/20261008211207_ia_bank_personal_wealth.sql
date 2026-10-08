-- Additive personal module. No updates to the store ledger or cash functions.
create table public.icom_bank_personal_wealth(
 id uuid primary key,
 owner_id uuid not null default auth.uid(),
 kind text not null check(kind in ('ATIVO','RENDA','APORTE','RESGATE')),
 category text not null check(category in ('Imóvel / aluguel','Veículo pessoal','Poupança','Renda fixa / CDB / Tesouro','Fundos de investimento','Ações / dividendos','Empréstimo particular / juros','Salário / serviços','Aposentadoria / pensão','Participação em outros negócios','Royalties / direitos','Outros bens e rendas')),
 name text not null check(length(name) between 2 and 160 and name=btrim(name)),
 record_date date not null check(record_date>='2000-01-01'),
 amount_cents bigint not null check(amount_cents between 0 and 1000000000),
 debt_cents bigint not null default 0 check(debt_cents between 0 and 1000000000),
 invested_cents bigint not null default 0 check(invested_cents between 0 and 1000000000),
 rate_percent numeric(7,4) check(rate_percent between 0 and 100),
 rate_period text not null default 'MENSAL' check(rate_period in ('MENSAL','ANUAL')),
 source_id uuid references public.icom_bank_personal_wealth(id),
 notes text not null default '' check(length(notes)<=2000),
 active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((kind='ATIVO' and source_id is null) or (kind<>'ATIVO' and amount_cents>0 and debt_cents=0 and invested_cents=0 and rate_percent is null))
);
create index bank_wealth_owner_date on public.icom_bank_personal_wealth(owner_id,record_date desc,id);
create index bank_wealth_source on public.icom_bank_personal_wealth(source_id) where source_id is not null;
alter table public.icom_bank_personal_wealth enable row level security;
revoke all on public.icom_bank_personal_wealth from public,anon,authenticated;
grant select,insert,update on public.icom_bank_personal_wealth to authenticated;
create policy bank_wealth_read on public.icom_bank_personal_wealth for select to authenticated using(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');
create policy bank_wealth_insert on public.icom_bank_personal_wealth for insert to authenticated with check(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');
create policy bank_wealth_update on public.icom_bank_personal_wealth for update to authenticated using(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER') with check(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');
create table icom_bank_internal.wealth_history(id bigint generated always as identity primary key,record_id uuid not null,actor_id uuid not null,recorded_at timestamptz not null default now(),old_data jsonb,new_data jsonb not null);
create index bank_wealth_history_record on icom_bank_internal.wealth_history(record_id);
alter table icom_bank_internal.wealth_history enable row level security;
revoke all on icom_bank_internal.wealth_history from public,anon,authenticated;
create function icom_bank_internal.guard_wealth() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' or new.owner_id is distinct from auth.uid() then raise exception 'BANK_FORBIDDEN';end if;
 if new.record_date>(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'BANK_WEALTH_INVALID';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.owner_id<>old.owner_id or new.kind<>old.kind then raise exception 'BANK_WEALTH_INVALID';end if;
  new.created_at:=old.created_at;
 else new.created_at:=clock_timestamp();end if;
 if new.source_id is not null and not exists(select 1 from public.icom_bank_personal_wealth w where w.id=new.source_id and w.owner_id=new.owner_id and w.kind='ATIVO') then raise exception 'BANK_WEALTH_INVALID';end if;
 new.updated_at:=clock_timestamp();
 insert into icom_bank_internal.wealth_history(record_id,actor_id,old_data,new_data) values(new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
revoke all on function icom_bank_internal.guard_wealth() from public,anon,authenticated;
create trigger bank_wealth_guard before insert or update on public.icom_bank_personal_wealth for each row execute function icom_bank_internal.guard_wealth();
create function public.icom_bank_save_personal_wealth(p_payload jsonb,p_expected timestamptz default null) returns public.icom_bank_personal_wealth language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_personal_wealth;identifier uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>6000 or coalesce(p_payload->>'id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'BANK_WEALTH_INVALID';end if;
 identifier:=(p_payload->>'id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(identifier::text,0));
 select * into r from public.icom_bank_personal_wealth where id=identifier for update;
 if found then
  if p_expected is null then
   if r.active=(p_payload->>'active')::boolean and r.name=btrim(p_payload->>'name') and r.kind=p_payload->>'kind' and r.category=p_payload->>'category' and r.record_date=(p_payload->>'record_date')::date and r.amount_cents=(p_payload->>'amount_cents')::bigint and r.debt_cents=(p_payload->>'debt_cents')::bigint and r.invested_cents=(p_payload->>'invested_cents')::bigint and r.rate_percent is not distinct from (p_payload->>'rate_percent')::numeric and r.rate_period=p_payload->>'rate_period' and r.source_id is not distinct from (p_payload->>'source_id')::uuid and r.notes=btrim(p_payload->>'notes') then return r;end if;
   raise exception 'BANK_WEALTH_CHANGED';
  end if;
  if r.updated_at<>p_expected or r.kind<>p_payload->>'kind' then raise exception 'BANK_WEALTH_CHANGED';end if;
  update public.icom_bank_personal_wealth set name=btrim(p_payload->>'name'),category=p_payload->>'category',record_date=(p_payload->>'record_date')::date,amount_cents=(p_payload->>'amount_cents')::bigint,debt_cents=(p_payload->>'debt_cents')::bigint,invested_cents=(p_payload->>'invested_cents')::bigint,rate_percent=(p_payload->>'rate_percent')::numeric,rate_period=p_payload->>'rate_period',source_id=(p_payload->>'source_id')::uuid,notes=btrim(p_payload->>'notes'),active=(p_payload->>'active')::boolean where id=identifier returning * into r;
 else
  if p_expected is not null then raise exception 'BANK_WEALTH_CHANGED';end if;
  insert into public.icom_bank_personal_wealth(id,owner_id,kind,category,name,record_date,amount_cents,debt_cents,invested_cents,rate_percent,rate_period,source_id,notes,active) values(identifier,auth.uid(),p_payload->>'kind',p_payload->>'category',btrim(p_payload->>'name'),(p_payload->>'record_date')::date,(p_payload->>'amount_cents')::bigint,(p_payload->>'debt_cents')::bigint,(p_payload->>'invested_cents')::bigint,(p_payload->>'rate_percent')::numeric,p_payload->>'rate_period',(p_payload->>'source_id')::uuid,btrim(p_payload->>'notes'),(p_payload->>'active')::boolean) returning * into r;
 end if;return r;
end $$;
revoke all on function public.icom_bank_save_personal_wealth(jsonb,timestamptz) from public,anon;
grant execute on function public.icom_bank_save_personal_wealth(jsonb,timestamptz) to authenticated;
