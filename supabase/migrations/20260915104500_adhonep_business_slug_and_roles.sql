create or replace function adh_private.prepare_business_slug()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := lower(regexp_replace(regexp_replace(new.name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
      || '-' || substr(new.id::text, 1, 6);
  end if;
  return new;
end;
$$;
revoke all on function adh_private.prepare_business_slug() from public, anon, authenticated;
drop trigger if exists prepare_adh_business_slug on public.adh_businesses;
create trigger prepare_adh_business_slug before insert or update of name, slug on public.adh_businesses
for each row execute function adh_private.prepare_business_slug();

create or replace function adh_private.protect_member_role()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('postgres', 'service_role')
     and new.role is distinct from old.role
     and not adh_private.is_super_admin() then
    raise exception 'Somente um administrador geral pode alterar funções de acesso';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function adh_private.protect_member_role() from public, anon, authenticated;
