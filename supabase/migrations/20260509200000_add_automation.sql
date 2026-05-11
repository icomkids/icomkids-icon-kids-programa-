-- Icon Kids — Automacao de mensagens (WhatsApp + Email)
--
-- 2 tabelas:
--   automation_rules    : regras configuraveis (gatilho -> template/canal)
--   scheduled_messages  : fila de mensagens agendadas (manual ou via regra)
--
-- 1 trigger no sessions: ao encerrar uma sessao, enfileira mensagens das
-- regras ativas com trigger_type = 'session_ended'.
--
-- 1 funcao diaria: enfileira mensagens de aniversario ('child_birthday').
--
-- 1 cron por minuto chama a edge function dispatch-scheduled, que despacha
-- as mensagens cuja scheduled_for ja chegou.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================================
-- automation_rules
-- ============================================================================

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null check (trigger_type in (
    'session_ended', 'child_birthday'
  )),
  trigger_config jsonb not null default '{}'::jsonb,
  channel text not null check (channel in ('whatsapp', 'email')),
  template_key text not null references public.message_templates(key) on delete restrict,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger automation_rules_set_updated_at
  before update on public.automation_rules
  for each row execute function public.tg_set_updated_at();

create index automation_rules_trigger_idx
  on public.automation_rules(trigger_type, active);

alter table public.automation_rules enable row level security;

create policy "automation_rules_staff_owner_all" on public.automation_rules
  for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.automation_rules;

-- ============================================================================
-- scheduled_messages
-- ============================================================================

create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'email')),
  -- whatsapp: phone (raw, sera normalizado pela edge function); email: endereco
  recipient text not null,
  recipient_name text,
  template_key text references public.message_templates(key) on delete set null,
  body_override text,
  subject_override text,
  variables jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'canceled')),
  rule_id uuid references public.automation_rules(id) on delete set null,
  context jsonb,
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scheduled_messages_set_updated_at
  before update on public.scheduled_messages
  for each row execute function public.tg_set_updated_at();

create index scheduled_messages_due_idx
  on public.scheduled_messages(scheduled_for)
  where status = 'pending';

create index scheduled_messages_status_idx
  on public.scheduled_messages(status, created_at desc);

-- evita duplicar a mesma regra para o mesmo contexto no mesmo dia
create unique index scheduled_messages_rule_dedupe_idx
  on public.scheduled_messages(rule_id, (context->>'session_id'))
  where rule_id is not null and context ? 'session_id';

create unique index scheduled_messages_birthday_dedupe_idx
  on public.scheduled_messages(
    rule_id,
    (context->>'child_id'),
    (((scheduled_for at time zone 'UTC')::date))
  )
  where rule_id is not null and context ? 'child_id' and not (context ? 'session_id');

alter table public.scheduled_messages enable row level security;

create policy "scheduled_messages_staff_owner_all" on public.scheduled_messages
  for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.scheduled_messages;

-- ============================================================================
-- Trigger: enfileira mensagens quando uma sessao termina
-- ============================================================================

create or replace function public.enqueue_session_end_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  guardian_row record;
  child_row record;
  recipient_value text;
  delay_minutes int;
  variables jsonb;
begin
  if NEW.status <> 'ended' then return NEW; end if;
  if OLD is not null and OLD.status = 'ended' then return NEW; end if;

  select g.* into guardian_row from public.guardians g where g.id = NEW.guardian_id;
  select c.* into child_row from public.children c where c.id = NEW.child_id;
  if guardian_row is null then return NEW; end if;

  for r in
    select * from public.automation_rules
    where active and trigger_type = 'session_ended'
  loop
    if r.channel = 'whatsapp' then
      recipient_value := guardian_row.phone;
    else
      recipient_value := guardian_row.email;
    end if;
    if recipient_value is null or recipient_value = '' then continue; end if;

    delay_minutes := coalesce((r.trigger_config->>'delay_minutes')::int, 0);
    variables := jsonb_build_object(
      'nome', guardian_row.full_name,
      'crianca', coalesce(child_row.full_name, ''),
      'tempo', NEW.contracted_minutes::text
    );

    begin
      insert into public.scheduled_messages
        (channel, recipient, recipient_name, template_key, variables,
         scheduled_for, rule_id, context)
      values
        (r.channel, recipient_value, guardian_row.full_name, r.template_key,
         variables,
         now() + (delay_minutes || ' minutes')::interval,
         r.id,
         jsonb_build_object('session_id', NEW.id::text, 'child_id', NEW.child_id::text));
    exception when unique_violation then
      -- ja enfileirado para esta regra+sessao, ignora
      null;
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists session_end_enqueue on public.sessions;
create trigger session_end_enqueue
  after update on public.sessions
  for each row execute function public.enqueue_session_end_messages();

-- ============================================================================
-- Funcao: enfileira mensagens de aniversario (chamada uma vez por dia pelo cron)
-- ============================================================================

create or replace function public.enqueue_birthday_messages_for_today()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  child_row record;
  guardian_row record;
  recipient_value text;
  days_before int;
  send_hour int;
  scheduled timestamptz;
  variables jsonb;
begin
  for r in
    select * from public.automation_rules
    where active and trigger_type = 'child_birthday'
  loop
    days_before := coalesce((r.trigger_config->>'days_before')::int, 0);
    send_hour := coalesce((r.trigger_config->>'send_hour_local')::int, 9);

    for child_row in
      select c.*
      from public.children c
      where c.birth_date is not null
        and to_char(c.birth_date + (days_before || ' days')::interval, 'MM-DD')
            = to_char(current_date, 'MM-DD')
    loop
      -- pega o ultimo guardian conhecido da criança via sessions
      select g.* into guardian_row
      from public.sessions s
      join public.guardians g on g.id = s.guardian_id
      where s.child_id = child_row.id
      order by s.created_at desc
      limit 1;
      if guardian_row is null then continue; end if;

      if r.channel = 'whatsapp' then
        recipient_value := guardian_row.phone;
      else
        recipient_value := guardian_row.email;
      end if;
      if recipient_value is null or recipient_value = '' then continue; end if;

      scheduled := (current_date::timestamp + (send_hour || ' hours')::interval)
                   at time zone 'America/Sao_Paulo';
      variables := jsonb_build_object(
        'nome', guardian_row.full_name,
        'crianca', child_row.full_name,
        'idade',
          extract(year from age(current_date, child_row.birth_date))::text
      );

      begin
        insert into public.scheduled_messages
          (channel, recipient, recipient_name, template_key, variables,
           scheduled_for, rule_id, context)
        values
          (r.channel, recipient_value, guardian_row.full_name, r.template_key,
           variables, scheduled, r.id,
           jsonb_build_object('child_id', child_row.id::text));
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;
end;
$$;

-- ============================================================================
-- Templates seed (gatilhos comuns)
-- ============================================================================

insert into public.message_templates (key, name, body) values
  (
    'wa_post_visit_thanks',
    '[WA] Obrigado pela visita',
    E'Oi {{nome}}! Obrigado por trazer a {{crianca}} no iCOM Kids 💙 Volte sempre!'
  ),
  (
    'email_post_visit_thanks',
    '[Email] Obrigado pela visita',
    E'<h2>Ola, {{nome}}! 💙</h2>\n<p>Obrigado por trazer a <strong>{{crianca}}</strong> hoje no iCOM Kids. Foi otimo te receber!</p>\n<p>Conta pra gente como foi a experiencia respondendo nossa pesquisa rapida.</p>'
  ),
  (
    'wa_birthday_kid',
    '[WA] Aniversario da crianca',
    E'Oi {{nome}}! 🎂 A {{crianca}} esta de aniversario — todo mundo no iCOM Kids manda um abraco!'
  ),
  (
    'email_birthday_kid',
    '[Email] Aniversario da crianca',
    E'<h2>Feliz aniversario, {{crianca}}! 🎉</h2>\n<p>O time do iCOM Kids deseja muita alegria. Que tal comemorar com a gente? Entre em contato pra montar uma festa especial.</p>'
  )
on conflict (key) do nothing;

-- ============================================================================
-- Cron: dispara dispatch-scheduled a cada minuto e
-- enqueue_birthday_messages_for_today uma vez por dia (07:00 UTC = 04:00 BRT).
-- O usuario configura url + secret rodando setup_dispatch_cron uma vez.
-- ============================================================================

create or replace function public.setup_dispatch_cron(
  p_project_url text,
  p_cron_secret text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dispatch_cmd text;
begin
  -- valores embutidos no comando do cron (Supabase nao permite ALTER DATABASE
  -- na role postgres do projeto gerenciado).
  dispatch_cmd := format(
    'select net.http_post(url := %L, headers := jsonb_build_object(%L, %L, %L, %L), body := %L::jsonb, timeout_milliseconds := 30000);',
    rtrim(p_project_url, '/') || '/functions/v1/dispatch-scheduled',
    'Content-Type', 'application/json',
    'x-cron-secret', p_cron_secret,
    '{}'
  );

  if exists (select 1 from cron.job where jobname = 'dispatch-scheduled-every-minute') then
    perform cron.unschedule('dispatch-scheduled-every-minute');
  end if;
  if exists (select 1 from cron.job where jobname = 'enqueue-birthdays-daily') then
    perform cron.unschedule('enqueue-birthdays-daily');
  end if;

  perform cron.schedule(
    'dispatch-scheduled-every-minute',
    '* * * * *',
    dispatch_cmd
  );

  perform cron.schedule(
    'enqueue-birthdays-daily',
    '0 7 * * *',
    'select public.enqueue_birthday_messages_for_today();'
  );
end;
$$;

revoke all on function public.setup_dispatch_cron(text, text) from public;
grant execute on function public.setup_dispatch_cron(text, text) to postgres;
