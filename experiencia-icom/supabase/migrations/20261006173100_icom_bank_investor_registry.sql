create table public.icom_bank_investors(
 id uuid primary key,
 name text not null check(length(name) between 2 and 160 and name=btrim(name)),
 email text not null default '' check(length(email)<=254 and (email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 phone text not null default '' check(length(phone)<=30),
 notes text not null default '' check(length(notes)<=2000),
 active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index bank_investor_name on public.icom_bank_investors(lower(name));
alter table public.icom_bank_investors enable row level security;
revoke all on public.icom_bank_investors from public,anon,authenticated;
grant select,insert,update on public.icom_bank_investors to authenticated;
create policy bank_investor_owner_read on public.icom_bank_investors for select to authenticated using ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_investor_owner_insert on public.icom_bank_investors for insert to authenticated with check ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_investor_owner_update on public.icom_bank_investors for update to authenticated using ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER') with check ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create table icom_bank_internal.investor_history(id bigint generated always as identity primary key,investor_id uuid not null references public.icom_bank_investors(id),actor_id uuid not null,recorded_at timestamptz not null default now(),old_data jsonb,new_data jsonb not null);
create index bank_investor_history_id on icom_bank_internal.investor_history(investor_id);
alter table icom_bank_internal.investor_history enable row level security;
revoke all on icom_bank_internal.investor_history from public,anon,authenticated;
create function icom_bank_internal.guard_investor() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or icom_bank_internal.role()<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 new.name:=regexp_replace(btrim(new.name),'\s+',' ','g');
 if tg_op='UPDATE' then
  if new.id<>old.id or new.name<>old.name or new.active<>old.active then raise exception 'BANK_INVESTOR_NAME_LOCKED';end if;
  new.created_at:=old.created_at;
 else new.active:=true;new.created_at:=clock_timestamp();end if;
 new.updated_at:=clock_timestamp();
 insert into icom_bank_internal.investor_history(investor_id,actor_id,old_data,new_data) values(new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;end $$;
-- The history FK is deferred until AFTER the investor row exists.
alter table icom_bank_internal.investor_history drop constraint investor_history_investor_id_fkey;
alter table icom_bank_internal.investor_history add constraint investor_history_investor_id_fkey foreign key(investor_id) references public.icom_bank_investors(id) deferrable initially deferred;
revoke all on function icom_bank_internal.guard_investor() from public,anon,authenticated;
create trigger bank_investor_guard before insert or update on public.icom_bank_investors for each row execute function icom_bank_internal.guard_investor();
create function public.icom_bank_save_investor(p_payload jsonb,p_expected timestamptz default null) returns public.icom_bank_investors language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_investors;identifier uuid;nm text;em text;ph text;nt text;begin
 if auth.uid() is null or icom_bank_internal.role()<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 if jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>6000 or coalesce(p_payload->>'id','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'BANK_INVESTOR_INVALID';end if;
 identifier:=(p_payload->>'id')::uuid;nm:=regexp_replace(btrim(coalesce(p_payload->>'name','')),'\s+',' ','g');em:=btrim(coalesce(p_payload->>'email',''));ph:=btrim(coalesce(p_payload->>'phone',''));nt:=btrim(coalesce(p_payload->>'notes',''));
 if length(nm) not between 2 and 160 or length(em)>254 or em<>'' and em!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(ph)>30 or length(nt)>2000 then raise exception 'BANK_INVESTOR_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(identifier::text,0));
 select * into r from public.icom_bank_investors where id=identifier for update;
 if found then
  if r.name=nm and r.email=em and r.phone=ph and r.notes=nt then return r;end if;
  if p_expected is null or p_expected<>r.updated_at then raise exception 'BANK_INVESTOR_CHANGED';end if;
  if r.name<>nm then raise exception 'BANK_INVESTOR_NAME_LOCKED';end if;
  update public.icom_bank_investors set email=em,phone=ph,notes=nt where id=identifier returning * into r;
 else
  if p_expected is not null then raise exception 'BANK_INVESTOR_CHANGED';end if;
  insert into public.icom_bank_investors(id,name,email,phone,notes) values(identifier,nm,em,ph,nt) returning * into r;
 end if;return r;
exception when unique_violation then raise exception 'BANK_INVESTOR_DUPLICATE';end $$;
revoke all on function public.icom_bank_save_investor(jsonb,timestamptz) from public,anon;
grant execute on function public.icom_bank_save_investor(jsonb,timestamptz) to authenticated;

do $patch$ declare s text;begin
 s:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 if position($a$when 'VENDA' then array['sale_owner',$a$ in s)=0 then raise exception 'Unexpected ledger definition';end if;
 s:=replace(s,$a$when 'VENDA' then array['sale_owner',$a$,$a$when 'VENDA' then array['investor_id','trade_investor_id','sale_owner',$a$);execute s;
end $patch$;
create function icom_bank_internal.guard_entry_investors() returns trigger language plpgsql security definer set search_path='' as $$
declare k text;nm text;i public.icom_bank_investors;begin
 foreach k in array array['investor_id','trade_investor_id'] loop
  if new.details ? k then
   if new.kind<>'VENDA' or coalesce(new.details->>k,'')!~'^[0-9a-fA-F-]{36}$' then raise exception 'BANK_INVESTOR_INVALID';end if;
   select * into i from public.icom_bank_investors where id=(new.details->>k)::uuid;
   nm:=case when k='investor_id' then 'investor_name' else 'trade_investor_name' end;
   if not found or not i.active or new.details->>nm is distinct from i.name then raise exception 'BANK_INVESTOR_INVALID';end if;
   if k='investor_id' and new.details->>'sale_owner'<>'INVESTIDOR' or k='trade_investor_id' and (new.details->>'trade_destination'<>'INVESTIDOR' or new.details->>'trade_in' is distinct from 'true') then raise exception 'BANK_INVESTOR_INVALID';end if;
  end if;
 end loop;return new;end $$;
revoke all on function icom_bank_internal.guard_entry_investors() from public,anon,authenticated;
create trigger bank_entry_investors_guard before insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_entry_investors();
