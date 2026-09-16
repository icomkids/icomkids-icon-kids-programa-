-- ADHONEP: affiliate offers, affiliations and chapter-managed commissions.
create type public.adh_commission_type as enum ('percentage', 'fixed');
create type public.adh_affiliation_status as enum ('active', 'paused', 'cancelled');
create type public.adh_financial_status as enum ('pending', 'validated', 'payable', 'paid', 'cancelled');

create table public.adh_affiliate_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.adh_businesses(id) on delete cascade,
  title text not null,
  description text not null default '',
  commission_type public.adh_commission_type not null,
  commission_value numeric(12,2) not null check (commission_value > 0),
  active boolean not null default true,
  created_by uuid references public.adh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (commission_type <> 'percentage' or commission_value <= 100)
);

create table public.adh_affiliations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.adh_affiliate_offers(id) on delete cascade,
  affiliate_id uuid not null references public.adh_profiles(id) on delete cascade,
  status public.adh_affiliation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, affiliate_id)
);

alter table public.adh_referrals
  add column if not exists offer_id uuid references public.adh_affiliate_offers(id) on delete set null,
  add column if not exists affiliation_id uuid references public.adh_affiliations(id) on delete set null,
  add column if not exists referrer_name text,
  add column if not exists tracking_code text unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  add column if not exists commission_type public.adh_commission_type,
  add column if not exists commission_rate numeric(12,2),
  add column if not exists commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  add column if not exists financial_status public.adh_financial_status not null default 'pending',
  add column if not exists validated_by uuid references public.adh_profiles(id) on delete set null,
  add column if not exists validated_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists manager_notes text;

alter table public.adh_affiliate_offers enable row level security;
alter table public.adh_affiliations enable row level security;

create policy adh_affiliate_offers_select on public.adh_affiliate_offers
for select to authenticated using (
  active or exists (
    select 1 from public.adh_businesses b where b.id = business_id
    and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
);
create policy adh_affiliate_offers_insert on public.adh_affiliate_offers
for insert to authenticated with check (exists (
  select 1 from public.adh_businesses b where b.id = business_id
  and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
));
create policy adh_affiliate_offers_update on public.adh_affiliate_offers
for update to authenticated using (exists (
  select 1 from public.adh_businesses b where b.id = business_id
  and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
)) with check (exists (
  select 1 from public.adh_businesses b where b.id = business_id
  and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
));
create policy adh_affiliate_offers_delete on public.adh_affiliate_offers
for delete to authenticated using (exists (
  select 1 from public.adh_businesses b where b.id = business_id
  and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
));

create policy adh_affiliations_select on public.adh_affiliations
for select to authenticated using (
  affiliate_id = (select auth.uid()) or exists (
    select 1 from public.adh_affiliate_offers o join public.adh_businesses b on b.id = o.business_id
    where o.id = offer_id and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
);
create policy adh_affiliations_insert on public.adh_affiliations
for insert to authenticated with check (
  affiliate_id = (select auth.uid()) and exists (select 1 from public.adh_affiliate_offers o where o.id = offer_id and o.active)
);
create policy adh_affiliations_update on public.adh_affiliations
for update to authenticated using (
  affiliate_id = (select auth.uid()) or exists (
    select 1 from public.adh_affiliate_offers o join public.adh_businesses b on b.id = o.business_id
    where o.id = offer_id and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
) with check (
  affiliate_id = (select auth.uid()) or exists (
    select 1 from public.adh_affiliate_offers o join public.adh_businesses b on b.id = o.business_id
    where o.id = offer_id and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
);

create or replace function adh_private.prepare_affiliate_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_offer public.adh_affiliate_offers%rowtype;
  v_affiliation public.adh_affiliations%rowtype;
begin
  if new.offer_id is null then return new; end if;
  select * into v_offer from public.adh_affiliate_offers where id = new.offer_id and active;
  if v_offer.id is null then raise exception 'Oferta de afiliação indisponível'; end if;
  select * into v_affiliation from public.adh_affiliations
    where id = new.affiliation_id and offer_id = new.offer_id and affiliate_id = new.referrer_id and status = 'active';
  if v_affiliation.id is null then raise exception 'Afiliação ativa não encontrada'; end if;
  new.business_id := v_offer.business_id;
  new.commission_type := v_offer.commission_type;
  new.commission_rate := v_offer.commission_value;
  select full_name into new.referrer_name from public.adh_profiles where id = new.referrer_id;
  return new;
end;
$$;
revoke all on function adh_private.prepare_affiliate_referral() from public, anon, authenticated;
create trigger prepare_adh_affiliate_referral before insert on public.adh_referrals
for each row execute function adh_private.prepare_affiliate_referral();

create or replace function adh_private.calculate_affiliate_commission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_chapter uuid;
begin
  select chapter_id into v_chapter from public.adh_businesses where id = new.business_id;
  if (new.financial_status, new.validated_by, new.validated_at, new.paid_at, new.manager_notes)
     is distinct from (old.financial_status, old.validated_by, old.validated_at, old.paid_at, old.manager_notes)
     and not adh_private.manages_chapter(v_chapter) then
    raise exception 'Somente o líder do capítulo pode validar ou pagar comissões';
  end if;
  if new.converted_value is distinct from old.converted_value or new.financial_status is distinct from old.financial_status then
    new.commission_amount := case
      when new.financial_status in ('cancelled', 'pending') or new.converted_value is null then 0
      when new.commission_type = 'percentage' then round(new.converted_value * new.commission_rate / 100, 2)
      when new.commission_type = 'fixed' then new.commission_rate
      else 0 end;
  end if;
  if new.financial_status in ('validated', 'payable', 'paid') and new.validated_at is null then
    new.validated_at := now(); new.validated_by := (select auth.uid());
  end if;
  if new.financial_status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function adh_private.calculate_affiliate_commission() from public, anon, authenticated;
create trigger calculate_adh_affiliate_commission before update on public.adh_referrals
for each row execute function adh_private.calculate_affiliate_commission();

grant select, insert, update, delete on public.adh_affiliate_offers to authenticated;
grant select, insert, update on public.adh_affiliations to authenticated;

create index adh_affiliate_offers_business_idx on public.adh_affiliate_offers(business_id, active);
create index adh_affiliations_affiliate_idx on public.adh_affiliations(affiliate_id, status);
create index adh_referrals_finance_idx on public.adh_referrals(business_id, financial_status, created_at desc);
