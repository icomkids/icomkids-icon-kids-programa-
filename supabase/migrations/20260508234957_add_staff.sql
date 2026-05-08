-- Icon Kids — Module 17 (Equipe)
-- Cadastro de funcionarios, escalas e calculo de comissao.

create type public.shift_status as enum ('scheduled', 'completed', 'no_show', 'canceled');

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_label text,                                  -- ex.: 'Atendente', 'Supervisor', 'Caixa'
  phone text,
  email text,
  commission_pct numeric(5, 2) not null default 0
    check (commission_pct >= 0 and commission_pct <= 100),
  active boolean not null default true,
  /** Optional link to an auth profile for staff that have login. */
  profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_members_active_idx on public.staff_members(active) where active;
create index staff_members_profile_idx on public.staff_members(profile_id)
  where profile_id is not null;

create trigger staff_members_set_updated_at
  before update on public.staff_members
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- staff_shifts — escalas
-- ============================================================================

create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.staff_members(id) on delete cascade,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  status public.shift_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_shifts_member_date_idx on public.staff_shifts(member_id, scheduled_date);
create index staff_shifts_date_idx on public.staff_shifts(scheduled_date);

create trigger staff_shifts_set_updated_at
  before update on public.staff_shifts
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.staff_members enable row level security;
alter table public.staff_shifts enable row level security;

-- Owner manages everything; staff can read members + their own shifts.
create policy "staff_members_owner_all" on public.staff_members for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "staff_members_staff_read" on public.staff_members for select
  using (public.auth_user_role() = 'staff');

create policy "staff_shifts_owner_all" on public.staff_shifts for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "staff_shifts_staff_read_own" on public.staff_shifts for select
  using (
    public.auth_user_role() = 'staff'
    and member_id in (
      select id from public.staff_members where profile_id = auth.uid()
    )
  );

-- Realtime so the schedule and team page update live.
alter publication supabase_realtime add table public.staff_members;
alter publication supabase_realtime add table public.staff_shifts;

-- ============================================================================
-- RPC: staff_commissions_for_period — calcula comissao no banco para
-- evitar puxar tudo no client. Soma sessions.amount_paid_cents +
-- product_sales.total_cents linkados ao profile_id do staff member, dentro
-- do periodo, e multiplica pela commission_pct.
-- ============================================================================

create or replace function public.staff_commissions_for_period(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  member_id uuid,
  full_name text,
  role_label text,
  commission_pct numeric,
  attributed_cents bigint,
  commission_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with member_sales as (
    select
      sm.id as member_id,
      sm.full_name,
      sm.role_label,
      sm.commission_pct,
      coalesce(
        (
          select sum(amount_paid_cents)
            from public.sessions s
           where s.created_by = sm.profile_id
             and s.created_at >= p_from
             and s.created_at < p_to
        ),
        0
      )
      + coalesce(
        (
          select sum(total_cents)
            from public.product_sales ps
           where ps.created_by = sm.profile_id
             and ps.created_at >= p_from
             and ps.created_at < p_to
        ),
        0
      ) as attributed_cents
    from public.staff_members sm
   where sm.active
  )
  select
    member_id,
    full_name,
    role_label,
    commission_pct,
    attributed_cents,
    floor(attributed_cents * commission_pct / 100)::bigint as commission_cents
    from member_sales
   order by commission_cents desc, full_name
$$;

grant execute on function public.staff_commissions_for_period(timestamptz, timestamptz)
  to authenticated;
