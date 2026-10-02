create or replace function public.experience_seller_create_with_phone(p_user uuid,p_customer text,p_vehicle text,p_plate text,p_request uuid,p_phone text) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_seller uuid;v_customer uuid;v_vehicle uuid;v_token uuid;v_experience uuid;v_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 select salesperson_id into v_seller from public.experience_users where id=p_user and active and role='seller' for share;
 if v_seller is null then raise exception 'Unauthorized'; end if;
 if p_request is null or p_customer is null or p_vehicle is null or length(trim(p_customer)) not between 2 and 120 or length(trim(p_vehicle)) not between 2 and 120 or p_plate is null or p_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' or p_phone is null or p_phone !~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' then raise exception 'Invalid registration'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select e.token into v_token from public.customer_experiences e join public.customers c on c.id=e.customer_id where e.seller_request_id=p_request and e.salesperson_id=v_seller and c.phone=p_phone;
 if v_token is not null then return v_token;end if;
 if exists(select 1 from public.customer_experiences where seller_request_id=p_request) then raise exception 'Request already used';end if;
 -- Reuse the contact without changing its name or prior experiences.
 insert into public.customers(name,phone) values(trim(p_customer),p_phone) on conflict(phone) where(phone<>'') do update set phone=excluded.phone returning id into v_customer;
 insert into public.vehicles(name) values(trim(p_vehicle)) on conflict(name) do update set name=excluded.name returning id into v_vehicle;
 insert into public.customer_experiences(customer_id,salesperson_id,vehicle_id,purchase_date,delivery_date,vehicle_plate,seller_request_id) values(v_customer,v_seller,v_vehicle,v_day,v_day,p_plate,p_request) returning id,token into v_experience,v_token;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'seller_customer_registered',v_experience::text);
 return v_token;
end $$;
revoke all on function public.experience_seller_create_with_phone(uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.experience_seller_create_with_phone(uuid,text,text,text,uuid,text) to service_role;

