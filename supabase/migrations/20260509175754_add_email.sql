-- Icon Kids — Resend Email integration (audit log + templates)

-- ============================================================================
-- email_log — auditoria de cada envio (sucesso e falha)
-- ============================================================================

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  template_key text references public.message_templates(key) on delete set null,
  to_email text not null,
  to_name text,
  reply_to text,
  subject text not null,
  body_html text,
  body_text text,
  status public.message_status not null default 'queued',
  context jsonb,
  provider_response jsonb,
  sent_at timestamptz,
  failed_at timestamptz,
  triggered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index email_log_created_idx on public.email_log(created_at desc);
create index email_log_event_idx on public.email_log(event_type, created_at desc)
  where event_type is not null;
create index email_log_to_idx on public.email_log(to_email, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.email_log enable row level security;

create policy "email_log_staff_owner_all" on public.email_log for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.email_log;

-- ============================================================================
-- Templates — adiciona alguns voltados a email (corpo HTML simples)
-- ============================================================================

insert into public.message_templates (key, name, body) values
  (
    'email_ticket_receipt',
    '[Email] Recibo de compra de ingresso',
    E'<h2>Obrigado, {{nome}}! 💙</h2>\n<p>Recebemos seu pagamento de <strong>{{valor}}</strong> para o pacote <strong>{{pacote}}</strong>.</p>\n<p>Apresente o QR Code abaixo na entrada do iCOM Kids:</p>\n<p><a href="{{link}}">Ver QR Code</a></p>\n<p>Ate ja!</p>'
  ),
  (
    'email_subscription_renewed',
    '[Email] Confirmacao de renovacao da assinatura',
    E'<h2>Mensalidade quitada, {{nome}}!</h2>\n<p>Sua assinatura <strong>{{plano}}</strong> foi renovada por mais um mes.</p>\n<p>Proxima cobranca: <strong>{{proxima_cobranca}}</strong>.</p>'
  ),
  (
    'email_term_signed',
    '[Email] Termo de responsabilidade assinado',
    E'<h2>Termo recebido — obrigado, {{nome}}!</h2>\n<p>Guardamos uma copia do termo assinado por voce. Boa visita ao iCOM Kids 💙</p>'
  )
on conflict (key) do nothing;
