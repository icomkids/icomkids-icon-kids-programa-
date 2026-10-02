create table public.experience_whatsapp_provider (
 id integer primary key check(id=1), token_cipher text not null, updated_at timestamptz not null default now()
);
create table public.experience_whatsapp_instances (
 salesperson_id uuid primary key references public.salespeople(id), phone text not null unique check(phone ~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$'),
 status text not null check(status in ('creating','ready','failed','unknown')), token_cipher text, instance_id text unique,
 claim_id uuid not null, updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
 check(status <> 'ready' or (token_cipher is not null and instance_id is not null))
);
alter table public.experience_whatsapp_provider enable row level security;
alter table public.experience_whatsapp_instances enable row level security;
revoke all on public.experience_whatsapp_provider, public.experience_whatsapp_instances from public,anon,authenticated;
grant all on public.experience_whatsapp_provider, public.experience_whatsapp_instances to service_role;
create function public.experience_whatsapp_instance_claim(p_user uuid,p_phone text,p_claim uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_seller uuid; v_row public.experience_whatsapp_instances; begin
 select salesperson_id into v_seller from public.experience_users where id=p_user and active and role='seller' for share;
 if v_seller is null then raise exception 'Unauthorized'; end if;
 if p_phone is null or p_phone !~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' then raise exception 'Invalid phone'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_seller::text,0));
 select * into v_row from public.experience_whatsapp_instances where salesperson_id=v_seller for update;
 if found then
  if v_row.phone<>p_phone then raise exception 'Phone already bound'; end if;
  if v_row.status<>'failed' or v_row.updated_at>now()-interval '1 minute' then return false; end if;
  update public.experience_whatsapp_instances set status='creating',claim_id=p_claim,updated_at=now() where salesperson_id=v_seller;
 else
  insert into public.experience_whatsapp_instances(salesperson_id,phone,status,claim_id) values(v_seller,p_phone,'creating',p_claim);
 end if;
 return true;
end $$;
revoke all on function public.experience_whatsapp_instance_claim(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.experience_whatsapp_instance_claim(uuid,text,uuid) to service_role;
