-- Icon Kids — Module 10 (Termo de Responsabilidade Digital)

create table public.term_templates (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  title text not null default 'Termo de Responsabilidade',
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- only one active template at a time
create unique index term_templates_active_unique on public.term_templates(active)
  where active;

create trigger term_templates_set_updated_at
  before update on public.term_templates
  for each row execute function public.tg_set_updated_at();

-- seed v1
insert into public.term_templates (version, title, body) values (
  1,
  'Termo de Responsabilidade — iCOM Kids',
  E'Eu, responsavel legal pela crianca abaixo identificada, declaro que:\n\n1. Autorizo a permanencia da crianca no espaco de recreacao iCOM Kids pelo periodo contratado.\n2. Estou ciente de que a equipe do iCOM Kids zelara pela seguranca da crianca, mas recreacao envolve riscos inerentes.\n3. Confirmo que a crianca esta em boas condicoes de saude e nao apresenta restricoes que impecam atividades fisicas leves.\n4. Autorizo o registro de imagens da crianca para uso interno (telao do parque) durante a permanencia.\n5. Comprometo-me a buscar a crianca pessoalmente ou autorizar saida via QR Code recebido por WhatsApp.\n\nAo assinar abaixo, declaro estar de acordo com os termos.'
);

-- ============================================================================
-- term_signatures — uma linha por solicitacao + assinatura
-- ============================================================================

create table public.term_signatures (
  id uuid primary key default gen_random_uuid(),
  /** Random opaque token usado na URL publica de assinatura. */
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  template_id uuid references public.term_templates(id) on delete set null,
  template_version integer,
  guardian_name text not null,
  guardian_phone text,
  guardian_document text,
  child_name text,
  /** PNG da assinatura em data-URL (base64). */
  signature_data_url text,
  signed_at timestamptz,
  ip text,
  user_agent text,
  notes text,
  created_at timestamptz not null default now()
);

create index term_signatures_signed_idx on public.term_signatures(signed_at desc nulls last);
create index term_signatures_pending_idx on public.term_signatures(created_at desc)
  where signed_at is null;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.term_templates enable row level security;
alter table public.term_signatures enable row level security;

create policy "term_templates_owner_all" on public.term_templates for all
  using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

create policy "term_templates_staff_read_active" on public.term_templates for select
  using (active);

create policy "term_signatures_staff_owner_all" on public.term_signatures for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.term_signatures;

-- ============================================================================
-- RPCs publicas para a pagina /termo/sign/:token
-- ============================================================================

create or replace function public.get_term_signature_by_token(p_token text)
returns table (
  id uuid,
  guardian_name text,
  guardian_phone text,
  child_name text,
  signed_at timestamptz,
  template_title text,
  template_body text,
  template_version integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ts.id,
    ts.guardian_name,
    ts.guardian_phone,
    ts.child_name,
    ts.signed_at,
    coalesce(tt.title, 'Termo de Responsabilidade') as template_title,
    coalesce(tt.body, '') as template_body,
    coalesce(tt.version, ts.template_version, 1) as template_version
    from public.term_signatures ts
    left join public.term_templates tt on tt.id = ts.template_id
   where ts.token = p_token
$$;

grant execute on function public.get_term_signature_by_token(text) to anon, authenticated;

create or replace function public.submit_term_signature(
  p_token text,
  p_signature_data_url text,
  p_user_agent text default null,
  p_guardian_document text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
begin
  if p_signature_data_url is null or length(p_signature_data_url) < 100 then
    raise exception 'signature is empty or too small';
  end if;

  select id, signed_at into v_existing
    from public.term_signatures where token = p_token
   for update;

  if not found then
    raise exception 'signature request not found';
  end if;
  if v_existing.signed_at is not null then
    raise exception 'this term was already signed';
  end if;

  update public.term_signatures
     set signature_data_url = p_signature_data_url,
         signed_at = now(),
         user_agent = coalesce(p_user_agent, user_agent),
         guardian_document = coalesce(p_guardian_document, guardian_document)
   where token = p_token;
end;
$$;

grant execute on function public.submit_term_signature(text, text, text, text)
  to anon, authenticated;

-- Template do WhatsApp para enviar o link da assinatura.
insert into public.message_templates (key, name, body) values (
  'term_sign_link',
  'Link para assinar termo',
  E'Oi {{nome}}, antes da visita ao iCOM Kids, leia e assine nosso termo de responsabilidade:\n\n👉 {{link}}\n\nLeva 1 minuto. 💙'
) on conflict (key) do nothing;
