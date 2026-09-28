-- Reuse the existing ADHONEP contacts and membership. No changes to other apps.
alter table public.adh_leads
  add column if not exists user_id uuid references public.adh_profiles(id) on delete set null,
  add column if not exists job_title text,
  add column if not exists business_sector text,
  add column if not exists business_sector_other text,
  add column if not exists whatsapp_normalized text,
  add column if not exists instagram text,
  add column if not exists main_product_service text,
  add column if not exists average_ticket text,
  add column if not exists networking_goals text[],
  add column if not exists desired_connections text[],
  add column if not exists marketing_opt_in boolean,
  add column if not exists business_description text,
  add column if not exists origin text,
  add column if not exists submission_fingerprint text;

alter table public.adh_leads add constraint adh_expansion_values check (
  source_page is distinct from 'adhonep_expansao_form' or (
    length(name) between 3 and 120 and length(company) between 2 and 160
    and length(job_title) between 2 and 100 and length(city) between 2 and 100
    and length(email) between 3 and 254 and email = lower(email)
    and whatsapp_normalized ~ '^[1-9]{2}(9[0-9]{8}|[2-5][0-9]{7})$'
    and business_sector = any(array['Agronegócio','Alimentação','Arquitetura','Automotivo','Beleza e Estética','Comércio','Comunicação','Construção Civil','Consultoria','Contabilidade','Educação','Engenharia','Eventos','Finanças','Imobiliário','Indústria','Jurídico','Logística','Marketing','Moda','Saúde','Seguros','Serviços','Tecnologia','Turismo','Varejo','Outro'])
    and (business_sector <> 'Outro' or length(business_sector_other) between 2 and 100)
    and length(main_product_service) between 3 and 500
    and average_ticket in ('up_to_100','101_500','501_2000','2001_10000','over_10000')
    and cardinality(networking_goals) between 1 and 5
    and networking_goals <@ array['Fazer parcerias','Gerar mais vendas','Encontrar fornecedores','Aprender com outros empresários','Expandir minha rede de contatos']
    and cardinality(desired_connections) between 1 and 5
    and desired_connections <@ array['Clientes','Parceiros','Fornecedores','Investidores','Mentores / conselheiros']
    and marketing_opt_in is not null and length(coalesce(business_description,'')) <= 1500
    and status in ('new','contacted','qualified','closed')
  ) is true
);
create unique index adh_expansion_user_uidx on public.adh_leads(user_id) where source_page='adhonep_expansao_form';
create unique index adh_expansion_email_uidx on public.adh_leads(lower(email)) where source_page='adhonep_expansao_form';
create unique index adh_expansion_phone_uidx on public.adh_leads(whatsapp_normalized) where source_page='adhonep_expansao_form';
create index adh_expansion_chapter_date_idx on public.adh_leads(chapter_id,created_at desc) where source_page='adhonep_expansao_form';
create index adh_expansion_status_idx on public.adh_leads(status,created_at desc) where source_page='adhonep_expansao_form';

alter table public.adh_leads enable row level security;
grant select on public.adh_leads to authenticated;
grant update(status) on public.adh_leads to authenticated;
create policy adh_expansion_read on public.adh_leads for select to authenticated
  using (source_page='adhonep_expansao_form' and (user_id=(select auth.uid()) or adh_private.manages_chapter(chapter_id)));
create policy adh_expansion_admin_status on public.adh_leads for update to authenticated
  using (source_page='adhonep_expansao_form' and adh_private.manages_chapter(chapter_id))
  with check (source_page='adhonep_expansao_form' and adh_private.manages_chapter(chapter_id));

-- Only the verified Edge Function can call this atomic write. SECURITY INVOKER
-- preserves the caller's privileges; no anonymous or authenticated RPC access.
create function public.adh_save_expansion_registration(actor_id uuid, verified_email text, payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare chapter uuid; registered public.adh_leads; saved_id uuid; fingerprint text;
begin
  if not exists(select 1 from auth.users where id=actor_id and lower(email)=verified_email and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
    raise exception 'Verified identity required' using errcode='42501';
  end if;
  select id into strict chapter from public.adh_chapters where city='Taubaté' and state='SP' and active;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text,0));
  fingerprint := md5(payload::text);
  select * into registered from public.adh_leads where user_id=actor_id and source_page='adhonep_expansao_form' for update;
  if registered.submission_fingerprint=fingerprint then return registered.id; end if;
  if registered.updated_at > now()-interval '1 minute' then raise exception 'Please wait before updating'; end if;
  -- A phone is not proof of identity. Do not merge someone else's account.
  if exists(select 1 from public.adh_profiles where id<>actor_id and nullif(regexp_replace(phone,'[^0-9]','','g'),'') in (payload->>'whatsapp_normalized','55'||(payload->>'whatsapp_normalized'))) then
    raise exception 'Contact needs account review' using errcode='23505';
  end if;
  insert into public.adh_profiles(id,full_name,phone)
    values(actor_id,payload->>'full_name',payload->>'whatsapp_normalized') on conflict(id) do nothing;
  insert into public.adh_leads(user_id,chapter_id,name,email,whatsapp,company,city,job_title,business_sector,business_sector_other,whatsapp_normalized,instagram,main_product_service,average_ticket,networking_goals,desired_connections,marketing_opt_in,business_description,source_page,origin,consent_at,submission_fingerprint)
    values(actor_id,chapter,payload->>'full_name',verified_email,payload->>'whatsapp',payload->>'company_name',payload->>'city',payload->>'job_title',payload->>'business_sector',nullif(payload->>'business_sector_other',''),payload->>'whatsapp_normalized',nullif(payload->>'instagram',''),payload->>'main_product_service',payload->>'average_ticket',array(select jsonb_array_elements_text(payload->'networking_goals')),array(select jsonb_array_elements_text(payload->'desired_connections')),(payload->>'marketing_opt_in')::boolean,nullif(payload->>'business_description',''),'adhonep_expansao_form','ADHONEP Expansão Taubaté',now(),fingerprint)
    on conflict(user_id) where source_page='adhonep_expansao_form' do update set
      name=excluded.name,email=excluded.email,whatsapp=excluded.whatsapp,company=excluded.company,city=excluded.city,job_title=excluded.job_title,business_sector=excluded.business_sector,business_sector_other=excluded.business_sector_other,whatsapp_normalized=excluded.whatsapp_normalized,instagram=excluded.instagram,main_product_service=excluded.main_product_service,average_ticket=excluded.average_ticket,networking_goals=excluded.networking_goals,desired_connections=excluded.desired_connections,marketing_opt_in=excluded.marketing_opt_in,business_description=excluded.business_description,consent_at=excluded.consent_at,submission_fingerprint=excluded.submission_fingerprint,updated_at=now()
    returning id into saved_id;
  if (payload->>'marketing_opt_in')::boolean then
    insert into public.adh_notification_subscriptions(email,name,lead_id,chapter_id,active,events_enabled,businesses_enabled,confirmed_at)
      values(verified_email,payload->>'full_name',saved_id,chapter,true,true,true,now())
      on conflict(email) do update set name=excluded.name,lead_id=excluded.lead_id,chapter_id=excluded.chapter_id,active=true,events_enabled=true,businesses_enabled=true,confirmed_at=now(),unsubscribed_at=null;
  else
    update public.adh_notification_subscriptions set active=false,events_enabled=false,businesses_enabled=false,unsubscribed_at=now() where email=verified_email;
  end if;
  return saved_id;
end $$;
revoke all on function public.adh_save_expansion_registration(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.adh_save_expansion_registration(uuid,text,jsonb) to service_role;
grant select,insert on public.adh_profiles to service_role;
-- Existing service permissions on adh_leads/subscriptions are retained.
