-- Icon Kids — Module 4 (Portal de Parceiros)
-- Add partners table, link sessions to a partner, and RLS so partner-role
-- users only see their own attribution data.

-- ============================================================================
-- PARTNERS table
-- ============================================================================

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,                              -- school / partner name
  contact_name text,
  contact_phone text,
  contact_email text,
  commission_pct numeric(5, 2) not null default 0  -- 0..100, e.g. 15.00
    check (commission_pct >= 0 and commission_pct <= 100),
  active boolean not null default true,
  -- when a partner has a login on the system, link to their profile
  profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index partners_active_idx on public.partners(active) where active;
create index partners_profile_id_idx on public.partners(profile_id) where profile_id is not null;

create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- SESSIONS — add partner attribution
-- ============================================================================

alter table public.sessions
  add column partner_id uuid references public.partners(id) on delete set null;

create index sessions_partner_id_idx on public.sessions(partner_id)
  where partner_id is not null;

-- Refresh the sessions_with_timing view to include the new column.
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
-- ROW LEVEL SECURITY for partners
-- ============================================================================

alter table public.partners enable row level security;

-- Owner manages everything
create policy "partners_owner_all" on public.partners for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

-- Staff can read partners (e.g. to assign sessions)
create policy "partners_staff_read" on public.partners for select
  using (public.auth_user_role() = 'staff');

-- Partner-role users can read their own row only
create policy "partners_self_read" on public.partners for select
  using (public.auth_user_role() = 'partner' and profile_id = auth.uid());

-- ============================================================================
-- Extend session policies so partners can read sessions attributed to them
-- ============================================================================

create policy "sessions_partner_read_own" on public.sessions for select
  using (
    public.auth_user_role() = 'partner'
    and partner_id in (
      select id from public.partners where profile_id = auth.uid()
    )
  );

-- ============================================================================
-- REALTIME — keep partners synced for the management page
-- ============================================================================

alter publication supabase_realtime add table public.partners;
