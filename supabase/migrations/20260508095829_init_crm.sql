-- Icon Kids — Module 1 (CRM Simples) initial schema
-- Multi-role profiles + children + guardians + sessions + webhook event log + RLS.

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.user_role as enum ('owner', 'staff', 'partner', 'customer');
create type public.session_status as enum ('active', 'paused', 'ended');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Returns the role of the currently authenticated user (or null if not in profiles yet).
-- security definer + locked search_path so RLS policies can call it safely.
create or replace function public.auth_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- updated_at touch trigger
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- PROFILES — 1:1 with auth.users
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Auto-create a profile row when a new auth.users row is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- GUARDIANS — parents/responsible adults
-- ============================================================================

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  document text,
  notes text,
  -- optional link to a customer profile (when responsavel has online account)
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guardians_phone_idx on public.guardians(phone);
create index guardians_full_name_idx on public.guardians(full_name);

create trigger guardians_set_updated_at
  before update on public.guardians
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- CHILDREN
-- ============================================================================

create table public.children (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index children_full_name_idx on public.children(full_name);

create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- CHILD <-> GUARDIAN (many-to-many)
-- ============================================================================

create table public.child_guardians (
  child_id uuid not null references public.children(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (child_id, guardian_id)
);

create index child_guardians_guardian_idx on public.child_guardians(guardian_id);

-- ============================================================================
-- SESSIONS — kid's playtime session (the core of the CRM)
-- ============================================================================

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete set null,
  contracted_minutes integer not null check (contracted_minutes > 0),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  paused_total_seconds integer not null default 0 check (paused_total_seconds >= 0),
  ended_at timestamptz,
  status public.session_status not null default 'active',
  amount_paid_cents integer check (amount_paid_cents is null or amount_paid_cents >= 0),
  payment_method text,
  qr_code_token text unique,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_status_started_idx on public.sessions(status, started_at desc);
create index sessions_child_id_idx on public.sessions(child_id);
create index sessions_guardian_id_idx on public.sessions(guardian_id);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.tg_set_updated_at();

-- Helper view: expected_end_at and remaining_seconds computed on the fly.
create or replace view public.sessions_with_timing as
select
  s.*,
  s.started_at + make_interval(mins => s.contracted_minutes) as expected_end_at,
  greatest(
    0,
    extract(
      epoch from (
        s.started_at
        + make_interval(mins => s.contracted_minutes)
        + make_interval(secs => s.paused_total_seconds)
        - now()
      )
    )::integer
  ) as remaining_seconds
from public.sessions s;

-- ============================================================================
-- WEBHOOK EVENTS — audit log + retry queue for outbound integrations
-- ============================================================================

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  delivered_at timestamptz,
  delivery_status text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index webhook_events_undelivered_idx on public.webhook_events(created_at)
  where delivered_at is null;
create index webhook_events_type_idx on public.webhook_events(event_type, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.guardians enable row level security;
alter table public.children enable row level security;
alter table public.child_guardians enable row level security;
alter table public.sessions enable row level security;
alter table public.webhook_events enable row level security;

-- profiles
create policy "profiles_self_read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_owner_all"
  on public.profiles for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "profiles_staff_read"
  on public.profiles for select
  using (public.auth_user_role() in ('staff', 'owner'));

-- guardians: staff/owner full
create policy "guardians_staff_owner_all"
  on public.guardians for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- children: staff/owner full
create policy "children_staff_owner_all"
  on public.children for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- child_guardians: staff/owner full
create policy "child_guardians_staff_owner_all"
  on public.child_guardians for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- sessions: staff/owner full
create policy "sessions_staff_owner_all"
  on public.sessions for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- webhook_events: only owner can read/manage
create policy "webhook_events_owner_all"
  on public.webhook_events for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

-- ============================================================================
-- REALTIME — publish CRM tables for live updates on the active children panel
-- ============================================================================

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.children;
