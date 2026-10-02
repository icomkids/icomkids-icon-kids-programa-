create or replace function public.experience_seller_create_scheduled(p_user uuid,p_customer text,p_vehicle text,p_plate text,p_request uuid,p_phone text,p_due timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_token uuid; v_existing boolean; begin
 if p_due is not null and (p_due<=now() or p_due>now()+interval '30 days') then raise exception 'Invalid schedule'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
 v_existing:=exists(select 1 from public.customer_experiences where seller_request_id=p_request);
 v_token:=public.experience_seller_create_with_phone(p_user,p_customer,p_vehicle,p_plate,p_request,p_phone);
 if not v_existing then update public.customer_experiences set seller_closing_required=true,whatsapp_auto_enabled=true,whatsapp_due_at=coalesce(p_due,now()),whatsapp_expires_at=coalesce(p_due,now())+interval '7 days' where token=v_token; end if;
 return v_token;
end $$;
