-- Icon Kids — Messaging (WhatsApp via uazapi) audit log + templates

-- ============================================================================
-- message_templates — reusable templates with placeholder rendering
-- ============================================================================

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  /** Programmatic key used by triggers (e.g. 'waitlist_called',
   *  'session_thank_you', 'subscription_renewal_reminder'). */
  key text not null unique,
  name text not null,
  body text not null,
  /** When true, server-side triggers may use this template for automated
   *  follow-ups. False means it is only available for manual sends. */
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.tg_set_updated_at();

-- Seed the templates the system will use out of the box.
insert into public.message_templates (key, name, body) values
  (
    'waitlist_called',
    'Vaga liberada (lista de espera)',
    E'Oi {{nome}}! Sua vaga no iCOM Kids esta liberada{{crianca_sufix}}. Pode vir agora :)\n\nAte ja!'
  ),
  (
    'session_thank_you',
    'Agradecimento pos check-out',
    E'{{nome}}, obrigado por trazer {{crianca}} ao iCOM Kids hoje! Volte sempre. 💙'
  ),
  (
    'subscription_renewal_reminder',
    'Lembrete de renovacao de assinatura',
    E'Oi {{nome}}, sua mensalidade {{plano}} vence em {{dias}} dias. Qualquer duvida, e so responder esta mensagem.'
  );

-- ============================================================================
-- messages_log — audit of every send attempt (success and failure)
-- ============================================================================

create type public.message_status as enum ('queued', 'sent', 'failed');

create table public.messages_log (
  id uuid primary key default gen_random_uuid(),
  /** Optional event type for filtering ('waitlist_called', 'session_thank_you',
   *  'manual', etc.). */
  event_type text,
  template_key text references public.message_templates(key) on delete set null,
  /** The phone we tried to message in E.164-ish form (digits only). */
  phone text not null,
  /** The full text body sent (or attempted). */
  body text not null,
  status public.message_status not null default 'queued',
  /** Free-form context links: { session_id?, waitlist_id?, subscription_id?, ... } */
  context jsonb,
  /** Provider response payload (or error string). */
  provider_response jsonb,
  sent_at timestamptz,
  failed_at timestamptz,
  /** Who triggered the send. Null for system-automated sends. */
  triggered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index messages_log_created_at_idx on public.messages_log(created_at desc);
create index messages_log_event_idx on public.messages_log(event_type, created_at desc)
  where event_type is not null;
create index messages_log_phone_idx on public.messages_log(phone, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.message_templates enable row level security;
alter table public.messages_log enable row level security;

-- Templates: owner manages, staff reads.
create policy "message_templates_owner_all" on public.message_templates for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "message_templates_staff_read" on public.message_templates for select
  using (public.auth_user_role() in ('staff', 'owner'));

-- Log: owner/staff full (the edge function uses the service-role key, which
-- bypasses RLS, so it can also insert)
create policy "messages_log_staff_owner_all" on public.messages_log for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- Realtime so the settings page log refreshes live.
alter publication supabase_realtime add table public.messages_log;
