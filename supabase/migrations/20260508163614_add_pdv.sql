-- Icon Kids — Module 11 (PDV / Lanchonete)
-- Product catalog, sales, line items, stock movement, low-stock alerts.

-- ============================================================================
-- products — catalog managed by the owner
-- ============================================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,                                -- bebida, lanche, brinquedo, etc.
  price_cents integer not null check (price_cents >= 0),
  stock_qty integer not null default 0,
  low_stock_threshold integer not null default 5
    check (low_stock_threshold >= 0),
  active boolean not null default true,
  sku text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_active_idx on public.products(active) where active;
create index products_category_idx on public.products(category) where category is not null;
create index products_low_stock_idx on public.products(stock_qty)
  where active and stock_qty <= low_stock_threshold;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- product_sales — header
-- ============================================================================

create table public.product_sales (
  id uuid primary key default gen_random_uuid(),
  /** optionally tied to a kid's session (snack add-on during play) */
  session_id uuid references public.sessions(id) on delete set null,
  total_cents integer not null check (total_cents >= 0),
  payment_method text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index product_sales_created_at_idx on public.product_sales(created_at desc);
create index product_sales_session_idx on public.product_sales(session_id)
  where session_id is not null;

-- ============================================================================
-- product_sale_items — line items
-- ============================================================================

create table public.product_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.product_sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  /** snapshot the product name at sale time so a renamed/deleted product
   *  still reads correctly on the receipt. */
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  subtotal_cents integer generated always as (unit_price_cents * quantity) stored,
  created_at timestamptz not null default now()
);

create index product_sale_items_sale_idx on public.product_sale_items(sale_id);
create index product_sale_items_product_idx on public.product_sale_items(product_id)
  where product_id is not null;

-- ============================================================================
-- Stock movement trigger — on insert of a sale item, decrement product stock.
-- ============================================================================

create or replace function public.tg_apply_stock_movement()
returns trigger
language plpgsql
as $$
begin
  if new.product_id is not null then
    update public.products
       set stock_qty = stock_qty - new.quantity
     where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger product_sale_items_apply_stock
  after insert on public.product_sale_items
  for each row execute function public.tg_apply_stock_movement();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.products enable row level security;
alter table public.product_sales enable row level security;
alter table public.product_sale_items enable row level security;

-- Products: owner manages, staff/owner read all (for POS), customer can read
-- active items (catalog browsing later).
create policy "products_owner_all" on public.products for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "products_staff_read" on public.products for select
  using (public.auth_user_role() in ('staff', 'owner'));

create policy "products_customer_read_active" on public.products for select
  using (active and public.auth_user_role() = 'customer');

-- Sales: owner/staff full
create policy "product_sales_staff_owner_all" on public.product_sales for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- Items: owner/staff full
create policy "product_sale_items_staff_owner_all" on public.product_sale_items for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.product_sales;
