-- Icon Kids — settings globais do sistema (key-value).
-- Por enquanto: apenas 'telao_child_seconds' (tempo de cada crianca no telao).
-- Leitura: anon (telao publico precisa). Escrita: staff/owner.

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger system_settings_set_updated_at
  before update on public.system_settings
  for each row execute function public.tg_set_updated_at();

alter table public.system_settings enable row level security;

create policy "system_settings_public_read" on public.system_settings
  for select using (true);

create policy "system_settings_staff_write" on public.system_settings
  for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.system_settings;

insert into public.system_settings (key, value) values
  ('telao_child_seconds', to_jsonb(8))
on conflict (key) do nothing;
