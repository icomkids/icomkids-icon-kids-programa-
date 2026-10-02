create function public.experience_seller_create_sale(p_user uuid,p_customer text,p_vehicle text,p_plate text,p_request uuid,p_phone text,p_due timestamptz,p_purchase date) returns uuid language plpgsql security invoker set search_path='' as $$
declare t uuid; old_date date;
begin
 if p_purchase is null or p_purchase>(now() at time zone 'America/Sao_Paulo')::date or p_purchase<'1900-01-01'::date then raise exception 'Data da venda inválida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
 select purchase_date into old_date from public.customer_experiences where seller_request_id=p_request;
 if old_date is not null and old_date<>p_purchase then raise exception 'A venda já foi cadastrada com outra data';end if;
 t:=public.experience_seller_create_scheduled(p_user,p_customer,p_vehicle,p_plate,p_request,p_phone,p_due);
 update public.customer_experiences set purchase_date=p_purchase where token=t;
 return t;
end $$;
revoke all on function public.experience_seller_create_sale(uuid,text,text,text,uuid,text,timestamptz,date) from public,anon,authenticated;
grant execute on function public.experience_seller_create_sale(uuid,text,text,text,uuid,text,timestamptz,date) to service_role;
