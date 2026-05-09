-- Icon Kids — Module 5 (Vendas online + Stripe Checkout)

create type public.ticket_order_status as enum (
  'pending',
  'paid',
  'canceled',
  'expired',
  'refunded'
);

-- ============================================================================
-- ticket_offers — catalogo da loja online
-- ============================================================================

create table public.ticket_offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  /** Stripe Price ID pre-criado no painel Stripe (recomendado). Se vazio,
   *  a edge function cria um price_data inline na hora do checkout. */
  stripe_price_id text,
  active boolean not null default true,
  display_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ticket_offers_active_idx on public.ticket_offers(active, display_order)
  where active;

create trigger ticket_offers_set_updated_at
  before update on public.ticket_offers
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- ticket_orders — pedidos
-- ============================================================================

create table public.ticket_orders (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.ticket_offers(id) on delete set null,
  /** Snapshot do nome do offer no momento da compra. */
  offer_name text not null,
  offer_duration_minutes integer,
  guardian_name text not null,
  guardian_phone text,
  guardian_email text,
  child_name text,
  amount_cents integer not null check (amount_cents >= 0),
  status public.ticket_order_status not null default 'pending',
  stripe_session_id text unique,
  stripe_payment_intent text,
  paid_at timestamptz,
  /** Se a sessao no parque ja foi gerada a partir desse pedido. */
  redeemed_session_id uuid references public.sessions(id) on delete set null,
  /** QR token unico para o cliente apresentar na entrada. */
  qr_code_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ticket_orders_status_idx on public.ticket_orders(status, created_at desc);
create index ticket_orders_paid_idx on public.ticket_orders(paid_at desc nulls last)
  where status = 'paid';
create index ticket_orders_session_idx on public.ticket_orders(stripe_session_id)
  where stripe_session_id is not null;

create trigger ticket_orders_set_updated_at
  before update on public.ticket_orders
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.ticket_offers enable row level security;
alter table public.ticket_orders enable row level security;

create policy "ticket_offers_owner_all" on public.ticket_offers for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

-- Lojinha publica le offers ativos.
create policy "ticket_offers_public_read_active" on public.ticket_offers for select
  using (active);

create policy "ticket_orders_staff_owner_all" on public.ticket_orders for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.ticket_orders;
alter publication supabase_realtime add table public.ticket_offers;

-- ============================================================================
-- RPC publica — busca pedido pelo QR token (cliente ve confirmacao + QR).
-- ============================================================================

create or replace function public.get_ticket_order_by_token(p_token text)
returns table (
  id uuid,
  offer_name text,
  offer_duration_minutes integer,
  guardian_name text,
  child_name text,
  amount_cents integer,
  status public.ticket_order_status,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, offer_name, offer_duration_minutes, guardian_name, child_name,
         amount_cents, status, paid_at
    from public.ticket_orders
   where qr_code_token = p_token
$$;

grant execute on function public.get_ticket_order_by_token(text) to anon, authenticated;
