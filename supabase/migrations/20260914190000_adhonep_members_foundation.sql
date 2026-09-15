-- ADHONEP: membership, chapters, businesses, events and referrals.
create type public.adh_member_role as enum ('member', 'business', 'chapter_admin', 'super_admin');
create type public.adh_business_status as enum ('pending', 'active', 'suspended');
create type public.adh_referral_status as enum ('clicked', 'registered', 'contacted', 'converted', 'cancelled');

create schema if not exists adh_private;
revoke all on schema adh_private from public, anon;
grant usage on schema adh_private to authenticated;

create table public.adh_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  role public.adh_member_role not null default 'member',
  referral_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adh_chapters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state char(2) not null default 'SP',
  description text,
  leader_name text,
  venue_name text,
  address text,
  meeting_schedule text,
  cover_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city, state)
);

create table public.adh_chapter_admins (
  chapter_id uuid not null references public.adh_chapters(id) on delete cascade,
  user_id uuid not null references public.adh_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chapter_id, user_id)
);

create table public.adh_businesses (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.adh_chapters(id) on delete restrict,
  owner_id uuid references public.adh_profiles(id) on delete set null,
  name text not null,
  segment text not null,
  description text not null default '',
  logo_url text,
  cover_url text,
  website_url text,
  instagram_url text,
  whatsapp text,
  address text,
  status public.adh_business_status not null default 'pending',
  featured boolean not null default false,
  average_rating numeric(2,1) not null default 0 check (average_rating between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  created_by uuid references public.adh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adh_events (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.adh_chapters(id) on delete cascade,
  title text not null,
  description text not null default '',
  speaker_name text,
  image_url text,
  location_name text,
  address text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  registration_url text,
  published boolean not null default false,
  created_by uuid references public.adh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.adh_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.adh_profiles(id) on delete cascade,
  business_id uuid not null references public.adh_businesses(id) on delete cascade,
  visitor_id uuid references public.adh_profiles(id) on delete set null,
  visitor_name text,
  visitor_contact text,
  status public.adh_referral_status not null default 'clicked',
  converted_value numeric(12,2),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adh_feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.adh_businesses(id) on delete cascade,
  author_id uuid not null references public.adh_profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  message text,
  requires_attention boolean not null default false,
  handled_at timestamptz,
  handled_by uuid references public.adh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, author_id)
);

create or replace function adh_private.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.adh_profiles where id = (select auth.uid()) and role = 'super_admin');
$$;
create or replace function adh_private.manages_chapter(target_chapter uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select adh_private.is_super_admin() or exists (
    select 1 from public.adh_chapter_admins where chapter_id = target_chapter and user_id = (select auth.uid())
  );
$$;
revoke all on function adh_private.is_super_admin() from public, anon;
revoke all on function adh_private.manages_chapter(uuid) from public, anon;
grant execute on function adh_private.is_super_admin() to authenticated;
grant execute on function adh_private.manages_chapter(uuid) to authenticated;

create or replace function adh_private.protect_member_role()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.role is distinct from old.role and not adh_private.is_super_admin() then
    raise exception 'Somente um administrador geral pode alterar funções de acesso';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function adh_private.protect_member_role() from public, anon, authenticated;
create trigger protect_adh_member_role before update on public.adh_profiles
for each row execute function adh_private.protect_member_role();

insert into public.adh_chapters (name, city, state, description, leader_name, venue_name, address, meeting_schedule, cover_url)
values ('Capítulo ADHONEP Taubaté', 'Taubaté', 'SP', 'Capítulo oficial responsável pelo desenvolvimento desta plataforma.', 'Wander Carvalho', 'HITT — Hub de Inovação Tecnológica de Taubaté', 'Av. Dom Pedro I, 7181 - Lj 235 - Res. Estoril, Taubaté - SP, 12091-000', 'Encontros das 19h às 21h', 'assets/capitulo-taubate-original.jpg')
on conflict (city, state) do update set name=excluded.name, description=excluded.description, leader_name=excluded.leader_name, venue_name=excluded.venue_name, address=excluded.address, meeting_schedule=excluded.meeting_schedule, cover_url=excluded.cover_url;

alter table public.adh_profiles enable row level security;
alter table public.adh_chapters enable row level security;
alter table public.adh_chapter_admins enable row level security;
alter table public.adh_businesses enable row level security;
alter table public.adh_events enable row level security;
alter table public.adh_referrals enable row level security;
alter table public.adh_feedback enable row level security;

create policy adh_profiles_select on public.adh_profiles for select to authenticated using (id = (select auth.uid()) or adh_private.is_super_admin());
create policy adh_profiles_insert on public.adh_profiles for insert to authenticated with check (id = (select auth.uid()) and role = 'member');
create policy adh_profiles_update on public.adh_profiles for update to authenticated using (id = (select auth.uid()) or adh_private.is_super_admin()) with check (id = (select auth.uid()) or adh_private.is_super_admin());
create policy adh_chapters_public_select on public.adh_chapters for select to anon, authenticated using (active);
create policy adh_chapters_admin_select on public.adh_chapters for select to authenticated using (adh_private.manages_chapter(id));
create policy adh_chapters_admin_insert on public.adh_chapters for insert to authenticated with check (adh_private.is_super_admin());
create policy adh_chapters_admin_update on public.adh_chapters for update to authenticated using (adh_private.manages_chapter(id)) with check (adh_private.manages_chapter(id));
create policy adh_chapters_admin_delete on public.adh_chapters for delete to authenticated using (adh_private.is_super_admin());
create policy adh_chapter_admins_select on public.adh_chapter_admins for select to authenticated using (user_id = (select auth.uid()) or adh_private.is_super_admin());
create policy adh_chapter_admins_manage on public.adh_chapter_admins for all to authenticated using (adh_private.is_super_admin()) with check (adh_private.is_super_admin());
create policy adh_businesses_public_select on public.adh_businesses for select to anon, authenticated using (status = 'active');
create policy adh_businesses_private_select on public.adh_businesses for select to authenticated using (owner_id = (select auth.uid()) or adh_private.manages_chapter(chapter_id));
create policy adh_businesses_insert on public.adh_businesses for insert to authenticated with check (adh_private.manages_chapter(chapter_id));
create policy adh_businesses_update on public.adh_businesses for update to authenticated using (owner_id = (select auth.uid()) or adh_private.manages_chapter(chapter_id)) with check (owner_id = (select auth.uid()) or adh_private.manages_chapter(chapter_id));
create policy adh_businesses_delete on public.adh_businesses for delete to authenticated using (adh_private.manages_chapter(chapter_id));
create policy adh_events_public_select on public.adh_events for select to anon, authenticated using (published);
create policy adh_events_private_select on public.adh_events for select to authenticated using (adh_private.manages_chapter(chapter_id));
create policy adh_events_insert on public.adh_events for insert to authenticated with check (adh_private.manages_chapter(chapter_id));
create policy adh_events_update on public.adh_events for update to authenticated using (adh_private.manages_chapter(chapter_id)) with check (adh_private.manages_chapter(chapter_id));
create policy adh_events_delete on public.adh_events for delete to authenticated using (adh_private.manages_chapter(chapter_id));
create policy adh_referrals_select on public.adh_referrals for select to authenticated using (referrer_id = (select auth.uid()) or visitor_id = (select auth.uid()) or exists (select 1 from public.adh_businesses b where b.id = business_id and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))));
create policy adh_referrals_insert on public.adh_referrals for insert to authenticated with check (referrer_id = (select auth.uid()));
create policy adh_referrals_update on public.adh_referrals for update to authenticated using (exists (select 1 from public.adh_businesses b where b.id = business_id and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id)))) with check (exists (select 1 from public.adh_businesses b where b.id = business_id and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))));
create policy adh_feedback_insert on public.adh_feedback for insert to authenticated with check (author_id = (select auth.uid()));
create policy adh_feedback_author_select on public.adh_feedback for select to authenticated using (author_id = (select auth.uid()) or exists (select 1 from public.adh_businesses b where b.id = business_id and adh_private.manages_chapter(b.chapter_id)));
create policy adh_feedback_chapter_update on public.adh_feedback for update to authenticated using (exists (select 1 from public.adh_businesses b where b.id = business_id and adh_private.manages_chapter(b.chapter_id))) with check (exists (select 1 from public.adh_businesses b where b.id = business_id and adh_private.manages_chapter(b.chapter_id)));

grant select on public.adh_chapters, public.adh_businesses, public.adh_events to anon;
grant select, insert, update, delete on public.adh_profiles, public.adh_chapters, public.adh_chapter_admins, public.adh_businesses, public.adh_events, public.adh_referrals, public.adh_feedback to authenticated;

create index adh_chapter_admins_user_idx on public.adh_chapter_admins(user_id);
create index adh_businesses_chapter_idx on public.adh_businesses(chapter_id, status);
create index adh_events_chapter_date_idx on public.adh_events(chapter_id, starts_at);
create index adh_referrals_referrer_idx on public.adh_referrals(referrer_id, created_at desc);
create index adh_feedback_business_idx on public.adh_feedback(business_id, created_at desc);
