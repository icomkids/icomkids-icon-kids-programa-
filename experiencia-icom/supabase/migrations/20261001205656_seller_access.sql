alter table public.experience_users add column salesperson_id uuid references public.salespeople(id);
alter table public.experience_users drop constraint experience_users_role_check;
alter table public.experience_users add constraint experience_users_role_check check(role in ('admin','manager','owner','seller'));
alter table public.experience_users add constraint experience_seller_scope check((role='seller' and salesperson_id is not null and leadership_access=false) or (role<>'seller' and salesperson_id is null));
create index experience_users_salesperson on public.experience_users(salesperson_id);

create function public.experience_find_login(p_actor uuid,p_email text) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.experience_users where id=p_actor and active and role in ('owner','admin')) then raise exception 'Unauthorized'; end if;
 return (select id from auth.users where lower(email)=lower(trim(p_email)) limit 1);
end $$;
create function public.experience_seller_accesses(p_actor uuid) returns table(id uuid,name text,email text,salesperson_id uuid,active boolean) language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.experience_users where experience_users.id=p_actor and experience_users.active and role in ('owner','admin')) then raise exception 'Unauthorized'; end if;
 return query select u.id,u.name,a.email::text,u.salesperson_id,u.active from public.experience_users u join auth.users a on a.id=u.id where u.role='seller' order by u.name;
end $$;
create function public.experience_set_seller_access(p_actor uuid,p_target uuid,p_seller uuid,p_active boolean) returns void language plpgsql security invoker set search_path='' as $$
declare seller_name text;
begin
 if not exists(select 1 from public.experience_users where id=p_actor and active and role in ('owner','admin')) then raise exception 'Unauthorized'; end if;
 if exists(select 1 from public.experience_users where id=p_target and role<>'seller') then raise exception 'Management account cannot become seller'; end if;
 select name into seller_name from public.salespeople where id=p_seller;
 if seller_name is null then raise exception 'Invalid salesperson'; end if;
 insert into public.experience_users(id,name,role,leadership_access,active,salesperson_id) values(p_target,seller_name,'seller',false,p_active,p_seller)
 on conflict(id) do update set name=excluded.name,salesperson_id=excluded.salesperson_id,active=excluded.active where experience_users.role='seller';
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_actor,case when p_active then 'seller_access_enabled' else 'seller_access_disabled' end,p_target::text);
end $$;
revoke all on function public.experience_find_login(uuid,text),public.experience_seller_accesses(uuid),public.experience_set_seller_access(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.experience_find_login(uuid,text),public.experience_seller_accesses(uuid),public.experience_set_seller_access(uuid,uuid,uuid,boolean) to service_role;
