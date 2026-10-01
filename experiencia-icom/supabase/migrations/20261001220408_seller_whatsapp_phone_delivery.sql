alter table public.customer_experiences add column whatsapp_status text not null default 'not_sent' check(whatsapp_status in ('not_sent','sending','accepted','failed','unknown'));
alter table public.customer_experiences add column whatsapp_provider_id text;
alter table public.customer_experiences add column whatsapp_attempted_at timestamptz;
alter table public.customer_experiences add column whatsapp_accepted_at timestamptz;

create function public.experience_seller_create_with_phone(p_user uuid,p_customer text,p_vehicle text,p_plate text,p_request uuid,p_phone text) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_token uuid; v_customer uuid; v_existing boolean;
begin
 if p_phone is null or p_phone !~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' then raise exception 'Invalid phone'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 v_existing:=exists(select 1 from public.customer_experiences where seller_request_id=p_request);
 v_token:=public.experience_seller_create(p_user,p_customer,p_vehicle,p_plate,p_request);
 select customer_id into v_customer from public.customer_experiences where token=v_token;
 if v_existing then
  if not exists(select 1 from public.customers where id=v_customer and phone=p_phone) then raise exception 'Request already used'; end if;
 else
  update public.customers set phone=p_phone where id=v_customer;
 end if;
 return v_token;
end $$;

create function public.experience_whatsapp_claim(p_user uuid,p_experience uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_seller uuid; affected integer;
begin
 select salesperson_id into v_seller from public.experience_users where id=p_user and active and role='seller' for share;
 if v_seller is null then raise exception 'Unauthorized'; end if;
 update public.customer_experiences set whatsapp_status='sending',whatsapp_attempted_at=now(),updated_at=now() where id=p_experience and salesperson_id=v_seller and not is_demo and completed_at is null and status<>'arquivada' and whatsapp_status in ('not_sent','failed');
 get diagnostics affected=row_count;
 if affected=1 then insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'seller_whatsapp_started',p_experience::text); end if;
 return affected=1;
end $$;

create function public.experience_whatsapp_result(p_user uuid,p_experience uuid,p_status text,p_provider text) returns void language plpgsql security invoker set search_path='' as $$
declare v_seller uuid; affected integer;
begin
 select salesperson_id into v_seller from public.experience_users where id=p_user and active and role='seller' for share;
 if v_seller is null then raise exception 'Unauthorized'; end if;
 if p_status is null or p_status not in ('accepted','failed','unknown') or (p_status='accepted' and coalesce(length(p_provider),0)=0) then raise exception 'Invalid result'; end if;
 update public.customer_experiences set whatsapp_status=p_status,whatsapp_provider_id=case when p_status='accepted' then p_provider else null end,whatsapp_accepted_at=case when p_status='accepted' then now() else null end,sent_at=case when p_status='accepted' then coalesce(sent_at,now()) else sent_at end,status=case when p_status='accepted' and status='criada' then 'enviada' else status end,updated_at=now() where id=p_experience and salesperson_id=v_seller and whatsapp_status='sending';
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Invalid sending state'; end if;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'seller_whatsapp_'||p_status,p_experience::text);
end $$;
revoke all on function public.experience_seller_create_with_phone(uuid,text,text,text,uuid,text),public.experience_whatsapp_claim(uuid,uuid),public.experience_whatsapp_result(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.experience_seller_create_with_phone(uuid,text,text,text,uuid,text),public.experience_whatsapp_claim(uuid,uuid),public.experience_whatsapp_result(uuid,uuid,text,text) to service_role;
