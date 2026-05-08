-- Icon Kids — Module 7 (Agendamento e Eventos)

create type public.appointment_kind as enum ('visit', 'event');
create type public.appointment_status as enum (
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'no_show'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  kind public.appointment_kind not null default 'visit',
  /** Title shown in lists, e.g. 'Festa do Pedro (5 anos)'. Optional for visits. */
  title text,
  guardian_name text not null,
  guardian_phone text not null,
  child_name text,
  party_size integer not null default 1 check (party_size > 0),
  scheduled_date date not null,
  scheduled_start_time time not null,
  /** When null, the system assumes 60 minutes for visits and 3h for events. */
  scheduled_end_time time,
  total_cents integer not null default 0 check (total_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  status public.appointment_status not null default 'requested',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_date_idx on public.appointments(scheduled_date, scheduled_start_time);
create index appointments_status_idx on public.appointments(status);
create index appointments_upcoming_idx on public.appointments(scheduled_date)
  where status in ('requested', 'confirmed');

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.appointments enable row level security;

create policy "appointments_staff_owner_all" on public.appointments for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.appointments;

-- ============================================================================
-- WhatsApp template seed (uses {{nome}}, {{tipo}}, {{data}}, {{hora}})
-- ============================================================================

insert into public.message_templates (key, name, body) values (
  'appointment_confirmed',
  'Confirmacao de agendamento',
  E'Oi {{nome}}! Seu {{tipo}} no iCOM Kids esta confirmado para {{data}} as {{hora}}. Te esperamos! 💙'
) on conflict (key) do nothing;
