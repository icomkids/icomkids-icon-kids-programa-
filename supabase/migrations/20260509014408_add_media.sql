-- Icon Kids — Module 8 (Midia / Anuncios para o Telao)
-- Upload de imagens e videos + agendamento de campanhas.

create type public.media_kind as enum ('image', 'video');

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.media_kind not null,
  /** Caminho relativo dentro do bucket 'media'. Ex.: 'campaigns/abc-123.png'. */
  storage_path text not null,
  /** Tempo de exibicao no telao em segundos. */
  duration_seconds integer not null default 8 check (duration_seconds > 0),
  /** Peso para o algoritmo de rotacao do telao (mais alto = aparece mais). */
  display_weight integer not null default 1 check (display_weight > 0),
  active boolean not null default true,
  /** Janela de exibicao opcional (campanhas com prazo). */
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_items_active_idx on public.media_items(active) where active;
create index media_items_window_idx on public.media_items(starts_on, ends_on)
  where active;

create trigger media_items_set_updated_at
  before update on public.media_items
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.media_items enable row level security;

create policy "media_items_owner_all" on public.media_items for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

-- Staff/everyone reads active items so the telao can play without auth
-- (the telao route is public).
create policy "media_items_read_active" on public.media_items for select
  using (active);

alter publication supabase_realtime add table public.media_items;

-- ============================================================================
-- Storage bucket — public read so the telao (anonymous) can stream the files.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Owner uploads. Policies below scope to the 'media' bucket.
drop policy if exists "media_storage_owner_insert" on storage.objects;
create policy "media_storage_owner_insert" on storage.objects for insert
  with check (
    bucket_id = 'media'
    and public.auth_user_role() = 'owner'
  );

drop policy if exists "media_storage_owner_update" on storage.objects;
create policy "media_storage_owner_update" on storage.objects for update
  using (
    bucket_id = 'media'
    and public.auth_user_role() = 'owner'
  );

drop policy if exists "media_storage_owner_delete" on storage.objects;
create policy "media_storage_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'media'
    and public.auth_user_role() = 'owner'
  );

drop policy if exists "media_storage_public_read" on storage.objects;
create policy "media_storage_public_read" on storage.objects for select
  using (bucket_id = 'media');
