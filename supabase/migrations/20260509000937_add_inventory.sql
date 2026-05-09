-- Icon Kids — Module 15 (Inventario de Ativos)
-- Cadastro de brinquedos/equipamentos + manutencao preventiva.

create type public.asset_condition as enum ('good', 'attention', 'broken');
create type public.maintenance_type as enum ('preventive', 'corrective');
create type public.maintenance_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'overdue',
  'canceled'
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,                                  -- ex: 'brinquedo', 'mobiliario', 'eletronico'
  location text,                                  -- ex: 'sala azul', 'piscina de bolinhas'
  serial_number text,
  purchase_date date,
  condition public.asset_condition not null default 'good',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_active_idx on public.assets(active) where active;
create index assets_condition_idx on public.assets(condition);

create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- asset_maintenance — agendamentos e historico
-- ============================================================================

create table public.asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  type public.maintenance_type not null default 'preventive',
  scheduled_date date not null,
  status public.maintenance_status not null default 'scheduled',
  completed_at timestamptz,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  performed_by text,                              -- nome do tecnico/empresa
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index asset_maintenance_asset_idx on public.asset_maintenance(asset_id, scheduled_date);
create index asset_maintenance_pending_idx on public.asset_maintenance(scheduled_date)
  where status in ('scheduled', 'overdue', 'in_progress');

create trigger asset_maintenance_set_updated_at
  before update on public.asset_maintenance
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.assets enable row level security;
alter table public.asset_maintenance enable row level security;

create policy "assets_owner_all" on public.assets for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "assets_staff_read" on public.assets for select
  using (public.auth_user_role() = 'staff');

create policy "asset_maintenance_owner_all" on public.asset_maintenance for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "asset_maintenance_staff_read" on public.asset_maintenance for select
  using (public.auth_user_role() = 'staff');

alter publication supabase_realtime add table public.assets;
alter publication supabase_realtime add table public.asset_maintenance;
