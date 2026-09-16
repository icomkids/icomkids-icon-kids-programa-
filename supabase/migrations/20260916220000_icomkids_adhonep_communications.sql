create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.adh_leads (
  id uuid primary key default gen_random_uuid(), chapter_id uuid references public.adh_chapters(id) on delete set null,
  name text not null, email text not null, whatsapp text not null, company text, city text, interest text,
  source_page text, utm_source text, utm_medium text, utm_campaign text, consent_at timestamptz not null,
  status text not null default 'new', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.adh_notification_subscriptions (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.adh_leads(id) on delete cascade,
  chapter_id uuid references public.adh_chapters(id) on delete set null, email text not null unique, name text,
  events_enabled boolean not null default true, businesses_enabled boolean not null default true,
  active boolean not null default true, unsubscribe_token uuid not null default gen_random_uuid() unique,
  confirmed_at timestamptz not null default now(), unsubscribed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.adh_email_outbox (
  id bigint generated always as identity primary key, subscription_id uuid not null references public.adh_notification_subscriptions(id) on delete cascade,
  kind text not null, entity_id uuid, subject text not null, payload jsonb not null default '{}', send_after timestamptz not null default now(),
  status text not null default 'pending', attempts integer not null default 0, provider_message_id text, last_error text, sent_at timestamptz, created_at timestamptz not null default now(),
  unique(subscription_id,kind,entity_id)
);
create index if not exists adh_email_outbox_due_idx on public.adh_email_outbox(status,send_after);
alter table public.adh_leads enable row level security;
alter table public.adh_notification_subscriptions enable row level security;
alter table public.adh_email_outbox enable row level security;
revoke all on public.adh_leads, public.adh_notification_subscriptions, public.adh_email_outbox from anon, authenticated;
grant all on public.adh_leads, public.adh_notification_subscriptions, public.adh_email_outbox to service_role;
grant usage, select on sequence public.adh_email_outbox_id_seq to service_role;

create or replace function public.adh_queue_updates() returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text; v_subject text; v_chapter uuid; v_payload jsonb;
begin
  if tg_table_name='adh_events' then
    if not new.published or (tg_op='UPDATE' and old.published) then return new; end if;
    v_kind:='event_published'; v_subject:='Novo encontro ADHONEP: '||new.title; v_chapter:=new.chapter_id;
    v_payload:=jsonb_build_object('title',new.title,'description',new.description,'starts_at',new.starts_at,'venue_name',new.location_name,'address',new.address,'image_url',new.image_url);
  else
    if new.status::text<>'active' or (tg_op='UPDATE' and old.status::text='active') then return new; end if;
    v_kind:=case when new.featured then 'sponsor_published' else 'company_published' end;
    v_subject:=case when new.featured then 'Novo patrocinador da ADHONEP Expansão' else 'Uma nova empresa chegou à comunidade ADHONEP' end;
    v_chapter:=new.chapter_id; v_payload:=jsonb_build_object('name',new.name,'description',coalesce(new.short_description,new.description),'segment',new.segment,'logo_url',new.logo_url,'website_url',new.website_url);
  end if;
  insert into public.adh_email_outbox(subscription_id,kind,entity_id,subject,payload)
  select s.id,v_kind,new.id,v_subject,v_payload from public.adh_notification_subscriptions s
  where s.active and (s.chapter_id is null or s.chapter_id=v_chapter) and (v_kind like 'event_%' and s.events_enabled or v_kind not like 'event_%' and s.businesses_enabled)
  on conflict do nothing; return new;
end $$;
revoke all on function public.adh_queue_updates() from public,anon,authenticated;
drop trigger if exists adh_queue_event_email on public.adh_events;
create trigger adh_queue_event_email after insert or update of published on public.adh_events for each row execute function public.adh_queue_updates();
drop trigger if exists adh_queue_business_email on public.adh_businesses;
create trigger adh_queue_business_email after insert or update of status on public.adh_businesses for each row execute function public.adh_queue_updates();

create or replace function public.adh_queue_event_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.adh_email_outbox(subscription_id,kind,entity_id,subject,payload)
 select s.id,case when e.starts_at<=now()+interval '25 hours' then 'event_reminder_1d' else 'event_reminder_7d' end,e.id,
 case when e.starts_at<=now()+interval '25 hours' then 'É amanhã: ' else 'Falta uma semana: ' end||e.title,
 jsonb_build_object('title',e.title,'description',e.description,'starts_at',e.starts_at,'venue_name',e.location_name,'address',e.address,'image_url',e.image_url)
 from public.adh_events e join public.adh_notification_subscriptions s on s.active and s.events_enabled and (s.chapter_id is null or s.chapter_id=e.chapter_id)
 where e.published and (e.starts_at between now()+interval '23 hours' and now()+interval '25 hours' or e.starts_at between now()+interval '167 hours' and now()+interval '169 hours') on conflict do nothing;
end $$;
revoke all on function public.adh_queue_event_reminders() from public,anon,authenticated;

select vault.create_secret('https://swsfwthjxtqtkloexyjs.supabase.co','adhonep_project_url','URL do cron ADHONEP Ecomkids') where not exists(select 1 from vault.decrypted_secrets where name='adhonep_project_url');
select vault.create_secret('sb_publishable_UCpt5UUIheImRldncvyseg_8pDQixDy','adhonep_publishable_key','Chave pública do cron ADHONEP Ecomkids') where not exists(select 1 from vault.decrypted_secrets where name='adhonep_publishable_key');
select cron.schedule('adhonep-event-reminders','0 * * * *',$$select public.adh_queue_event_reminders();$$) where not exists(select 1 from cron.job where jobname='adhonep-event-reminders');
select cron.schedule('adhonep-process-emails','*/5 * * * *',$$select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='adhonep_project_url')||'/functions/v1/process-notifications',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='adhonep_publishable_key')),body:='{}'::jsonb);$$) where not exists(select 1 from cron.job where jobname='adhonep-process-emails');
