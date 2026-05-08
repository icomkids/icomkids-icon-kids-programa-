-- Icon Kids — Module 6 (Assinaturas / Mensalidades)
-- Plans, active subscriptions, and payment ledger.

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.subscription_status as enum ('active', 'paused', 'canceled', 'expired');

-- ============================================================================
-- subscription_plans — owner-defined plan catalog
-- ============================================================================

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  monthly_cents integer not null check (monthly_cents >= 0),
  /** minutes that come bundled with the plan per month (0 = no bundle). */
  included_minutes integer not null default 0 check (included_minutes >= 0),
  /** discount applied on a la carte purchases for active subscribers (0..100). */
  discount_pct numeric(5, 2) not null default 0
    check (discount_pct >= 0 and discount_pct <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscription_plans_active_idx on public.subscription_plans(active)
  where active;

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- subscriptions — one row per active subscriber relationship
-- ============================================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  status public.subscription_status not null default 'active',
  starts_on date not null default current_date,
  /** date of the next charge; staff renews manually for now. */
  next_billing_on date not null,
  canceled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_status_idx on public.subscriptions(status);
create index subscriptions_guardian_idx on public.subscriptions(guardian_id);
create index subscriptions_next_billing_idx on public.subscriptions(next_billing_on);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- subscription_payments — append-only ledger of subscription charges
-- ============================================================================

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  paid_at timestamptz not null default now(),
  payment_method text,
  /** the billing period this payment covers (first day of the month). */
  covers_period date,
  notes text,
  created_at timestamptz not null default now()
);

create index subscription_payments_sub_idx on public.subscription_payments(subscription_id, paid_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

-- Plans: owner manages, everyone can read active plans (for the public sales
-- page later). Customers see plans, staff sees plans, partners ignore.
create policy "subscription_plans_owner_all" on public.subscription_plans for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "subscription_plans_read_active" on public.subscription_plans for select
  using (active);

-- Subscriptions: owner/staff full
create policy "subscriptions_staff_owner_all" on public.subscriptions for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- Customer (when they have a profile linked via guardian.profile_id) reads
-- only their own subscriptions.
create policy "subscriptions_customer_self_read" on public.subscriptions for select
  using (
    public.auth_user_role() = 'customer'
    and guardian_id in (
      select id from public.guardians where profile_id = auth.uid()
    )
  );

-- Subscription payments: owner/staff full; customer self-read of their payments
create policy "subscription_payments_staff_owner_all"
  on public.subscription_payments for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

create policy "subscription_payments_customer_self_read"
  on public.subscription_payments for select
  using (
    public.auth_user_role() = 'customer'
    and subscription_id in (
      select s.id from public.subscriptions s
      join public.guardians g on g.id = s.guardian_id
      where g.profile_id = auth.uid()
    )
  );

-- ============================================================================
-- REALTIME — keep the management page in sync
-- ============================================================================

alter publication supabase_realtime add table public.subscription_plans;
alter publication supabase_realtime add table public.subscriptions;
