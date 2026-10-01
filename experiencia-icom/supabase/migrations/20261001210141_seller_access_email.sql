-- Auth accounts are resolved through the server-side Auth Admin API, not auth.users SQL privileges.
drop function public.experience_find_login(uuid,text);
alter table public.experience_users add column access_email text;
create or replace function public.experience_seller_accesses(p_actor uuid) returns table(id uuid,name text,email text,salesperson_id uuid,active boolean) language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.experience_users where experience_users.id=p_actor and experience_users.active and role in ('owner','admin')) then raise exception 'Unauthorized'; end if;
 return query select u.id,u.name,u.access_email,u.salesperson_id,u.active from public.experience_users u where u.role='seller' order by u.name;
end $$;
drop function public.experience_set_seller_access(uuid,uuid,uuid,boolean);
create function public.experience_set_seller_access(p_actor uuid,p_target uuid,p_seller uuid,p_active boolean,p_email text) returns void language plpgsql security invoker set search_path='' as $$
declare seller_name text; affected integer;
begin
 if not exists(select 1 from public.experience_users where id=p_actor and active and role in ('owner','admin')) then raise exception 'Unauthorized'; end if;
 if exists(select 1 from public.experience_users where id=p_target and role<>'seller') then raise exception 'Management account cannot become seller'; end if;
 select name into seller_name from public.salespeople where id=p_seller;
 if seller_name is null then raise exception 'Invalid salesperson'; end if;
 insert into public.experience_users(id,name,role,leadership_access,active,salesperson_id,access_email) values(p_target,seller_name,'seller',false,p_active,p_seller,lower(trim(p_email)))
 on conflict(id) do update set name=excluded.name,salesperson_id=excluded.salesperson_id,active=excluded.active,access_email=excluded.access_email where experience_users.role='seller';
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Management account cannot become seller'; end if;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_actor,case when p_active then 'seller_access_enabled' else 'seller_access_disabled' end,p_target::text);
end $$;
revoke all on function public.experience_seller_accesses(uuid),public.experience_set_seller_access(uuid,uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.experience_seller_accesses(uuid),public.experience_set_seller_access(uuid,uuid,uuid,boolean,text) to service_role;
