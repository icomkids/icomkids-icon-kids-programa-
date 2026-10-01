alter table public.customer_experiences add column vehicle_plate text;
alter table public.customer_experiences add column seller_request_id uuid unique;
create function public.experience_seller_create(p_user uuid,p_customer text,p_vehicle text,p_plate text,p_request uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare seller uuid; customer uuid; vehicle uuid; token uuid; experience uuid; day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 select salesperson_id into seller from public.experience_users where id=p_user and active and role='seller' for share;
 if seller is null then raise exception 'Unauthorized'; end if;
 if p_request is null or length(trim(p_customer)) not between 2 and 120 or length(trim(p_vehicle)) not between 2 and 120 or p_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then raise exception 'Invalid registration'; end if;
 -- Serialize retries before inserting any customer or vehicle.
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select e.token into token from public.customer_experiences e where e.seller_request_id=p_request and e.salesperson_id=seller;
 if token is not null then return token; end if;
 if exists(select 1 from public.customer_experiences where seller_request_id=p_request) then raise exception 'Unauthorized'; end if;
 insert into public.customers(name) values(trim(p_customer)) returning id into customer;
 insert into public.vehicles(name) values(trim(p_vehicle)) on conflict(name) do update set name=excluded.name returning id into vehicle;
 insert into public.customer_experiences(customer_id,salesperson_id,vehicle_id,purchase_date,delivery_date,vehicle_plate,seller_request_id) values(customer,seller,vehicle,day,day,p_plate,p_request) returning id,customer_experiences.token into experience,token;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'seller_customer_registered',experience::text);
 return token;
end $$;
create function public.experience_seller_sent(p_user uuid,p_experience uuid) returns void language plpgsql security invoker set search_path='' as $$
declare seller uuid; affected integer;
begin
 select salesperson_id into seller from public.experience_users where id=p_user and active and role='seller' for share;
 if seller is null then raise exception 'Unauthorized'; end if;
 update public.customer_experiences set sent_at=coalesce(sent_at,now()),status=case when status='criada' then 'enviada' else status end,updated_at=now() where id=p_experience and salesperson_id=seller and status<>'arquivada';
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Unauthorized'; end if;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'seller_share_started',p_experience::text);
end $$;
revoke all on function public.experience_seller_create(uuid,text,text,text,uuid),public.experience_seller_sent(uuid,uuid) from public,anon,authenticated;
grant execute on function public.experience_seller_create(uuid,text,text,text,uuid),public.experience_seller_sent(uuid,uuid) to service_role;
