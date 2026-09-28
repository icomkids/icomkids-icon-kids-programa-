-- Identity is verified by Auth.getUser in the Edge Function. The service-only
-- invoker RPC must not read auth.users, which service_role cannot SELECT.
create or replace function public.adh_save_expansion_registration(actor_id uuid, verified_email text, payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare chapter uuid; registered public.adh_leads; saved_id uuid; fingerprint text;
begin
  if actor_id is null or nullif(verified_email,'') is null or (payload->>'email') is distinct from verified_email then
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
