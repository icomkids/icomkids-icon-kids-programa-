-- Icon Kids — Module 7 extension: per-child detail on appointments
-- Eventos (festas) tipicamente tem varias criancas com idades diferentes;
-- agora cada agendamento pode ter uma lista detalhada.

create type public.gender as enum ('boy', 'girl');

create table public.appointment_children (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  full_name text not null,
  age integer check (age is null or (age >= 0 and age <= 18)),
  gender public.gender,
  notes text,
  created_at timestamptz not null default now()
);

create index appointment_children_appointment_idx
  on public.appointment_children(appointment_id);

-- ============================================================================
-- RLS — same scope as appointments (owner/staff full)
-- ============================================================================

alter table public.appointment_children enable row level security;

create policy "appointment_children_staff_owner_all"
  on public.appointment_children for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.appointment_children;
