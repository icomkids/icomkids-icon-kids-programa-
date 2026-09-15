-- Initial administrator explicitly confirmed by the project owner.
insert into public.adh_profiles (id, full_name, role)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1)),
  'super_admin'::public.adh_member_role
from auth.users
where lower(email) = lower('wandercarvalho31@gmail.com')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from public.adh_profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower('wandercarvalho31@gmail.com')
      and p.role = 'super_admin'
  ) then
    raise exception 'Não foi possível atribuir o administrador geral';
  end if;
end
$$;
