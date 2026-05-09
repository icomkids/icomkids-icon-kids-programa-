-- Icon Kids — Module 14 (Fidelidade / Pontos)
-- Programa de pontos por visita / compra + catalogo de recompensas.

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cost_points integer not null check (cost_points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loyalty_rewards_active_idx on public.loyalty_rewards(active)
  where active;

create trigger loyalty_rewards_set_updated_at
  before update on public.loyalty_rewards
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- loyalty_accounts — uma conta por responsavel (guardian)
-- ============================================================================

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null unique references public.guardians(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  total_redeemed integer not null default 0 check (total_redeemed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loyalty_accounts_balance_idx on public.loyalty_accounts(points_balance desc);

create trigger loyalty_accounts_set_updated_at
  before update on public.loyalty_accounts
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- loyalty_transactions — log de credito/debito
-- ============================================================================

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  /** positivo = creditado (visita, compra); negativo = resgatado em recompensa. */
  delta integer not null,
  reason text not null,
  session_id uuid references public.sessions(id) on delete set null,
  product_sale_id uuid references public.product_sales(id) on delete set null,
  reward_id uuid references public.loyalty_rewards(id) on delete set null,
  created_at timestamptz not null default now()
);

create index loyalty_transactions_account_idx on public.loyalty_transactions(account_id, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;

create policy "loyalty_rewards_owner_all" on public.loyalty_rewards for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "loyalty_rewards_read_active" on public.loyalty_rewards for select
  using (active);

create policy "loyalty_accounts_staff_owner_all" on public.loyalty_accounts for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

create policy "loyalty_transactions_staff_owner_all" on public.loyalty_transactions for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.loyalty_accounts;
alter publication supabase_realtime add table public.loyalty_transactions;

-- ============================================================================
-- RPCs
-- ============================================================================

-- Cria a conta se nao existir e devolve o id.
create or replace function public.ensure_loyalty_account(p_guardian_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.loyalty_accounts where guardian_id = p_guardian_id;
  if v_id is null then
    insert into public.loyalty_accounts (guardian_id) values (p_guardian_id)
      returning id into v_id;
  end if;
  return v_id;
end;
$$;

grant execute on function public.ensure_loyalty_account(uuid) to authenticated;

-- Credita pontos. Se conta nao existir, cria.
create or replace function public.award_loyalty_points(
  p_guardian_id uuid,
  p_points integer,
  p_reason text,
  p_session_id uuid default null,
  p_product_sale_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  if p_points is null or p_points <= 0 then
    raise exception 'p_points must be > 0';
  end if;
  v_account := public.ensure_loyalty_account(p_guardian_id);

  insert into public.loyalty_transactions (
    account_id, delta, reason, session_id, product_sale_id
  ) values (
    v_account, p_points, p_reason, p_session_id, p_product_sale_id
  );

  update public.loyalty_accounts
     set points_balance = points_balance + p_points,
         total_earned = total_earned + p_points
   where id = v_account;
end;
$$;

grant execute on function public.award_loyalty_points(uuid, integer, text, uuid, uuid) to authenticated;

-- Resgate de recompensa. Subtrai pontos e gera transacao.
create or replace function public.redeem_loyalty_reward(
  p_account_id uuid,
  p_reward_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_balance integer;
  v_active boolean;
  v_name text;
begin
  select cost_points, active, name into v_cost, v_active, v_name
    from public.loyalty_rewards where id = p_reward_id for update;
  if not found then
    raise exception 'reward not found';
  end if;
  if not v_active then
    raise exception 'reward is not active';
  end if;

  select points_balance into v_balance
    from public.loyalty_accounts where id = p_account_id for update;
  if not found then
    raise exception 'account not found';
  end if;
  if v_balance < v_cost then
    raise exception 'insufficient balance';
  end if;

  insert into public.loyalty_transactions (
    account_id, delta, reason, reward_id
  ) values (
    p_account_id, -v_cost, 'Resgate: ' || v_name, p_reward_id
  );

  update public.loyalty_accounts
     set points_balance = points_balance - v_cost,
         total_redeemed = total_redeemed + v_cost
   where id = p_account_id;
end;
$$;

grant execute on function public.redeem_loyalty_reward(uuid, uuid) to authenticated;
