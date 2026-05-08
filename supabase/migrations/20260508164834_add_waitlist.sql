-- Icon Kids — Module 12 (Lista de Espera Digital)

create type public.waitlist_status as enum (
  'waiting',
  'called',
  'arrived',
  'no_show',
  'canceled'
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  guardian_full_name text not null,
  guardian_phone text not null,
  child_full_name text,
  party_size integer not null default 1 check (party_size > 0),
  notes text,
  status public.waitlist_status not null default 'waiting',
  called_at timestamptz,
  arrived_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index waitlist_status_idx on public.waitlist_entries(status, created_at);
create index waitlist_active_idx on public.waitlist_entries(created_at)
  where status in ('waiting', 'called');

create trigger waitlist_set_updated_at
  before update on public.waitlist_entries
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.waitlist_entries enable row level security;

create policy "waitlist_staff_owner_all" on public.waitlist_entries for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- Realtime so the page updates live as entries are added/called.
alter publication supabase_realtime add table public.waitlist_entries;
