create table public.experience_sale_closings (
 experience_id uuid primary key references public.customer_experiences(id),
 actor_id uuid not null references public.experience_users(id),
 lead_source text not null check (lead_source in ('store','own','internet')),
 inspection_sold boolean not null,
 full_return boolean not null,
 full_documentation boolean not null,
 feedback_video boolean not null,
 created_at timestamptz not null default now()
);
alter table public.experience_sale_closings enable row level security;
revoke all on public.experience_sale_closings from public, anon, authenticated;
grant select,insert on public.experience_sale_closings to service_role;
alter table public.customer_experiences add column seller_closing_required boolean not null default false;
create function public.experience_sale_close(p_actor uuid,p_experience uuid,p_source text,p_inspection boolean,p_return boolean,p_documentation boolean,p_video boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare seller uuid; existing public.experience_sale_closings;
begin
 select salesperson_id into seller from public.experience_users where id=p_actor and active and role='seller';
 if seller is null or not exists(select 1 from public.customer_experiences where id=p_experience and salesperson_id=seller and seller_closing_required) then raise exception 'Acesso não autorizado.'; end if;
 if p_source not in ('store','own','internet') or p_source is null or p_inspection is null or p_return is null or p_documentation is null or p_video is null then raise exception 'Responda todos os itens do fechamento.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_experience::text,17));
 select * into existing from public.experience_sale_closings where experience_id=p_experience;
 if found then
  if (existing.lead_source,existing.inspection_sold,existing.full_return,existing.full_documentation,existing.feedback_video) is distinct from (p_source,p_inspection,p_return,p_documentation,p_video) then raise exception 'Fechamento já registrado. As respostas não podem ser alteradas.'; end if;
  return;
 end if;
 insert into public.experience_sale_closings(experience_id,actor_id,lead_source,inspection_sold,full_return,full_documentation,feedback_video) values(p_experience,p_actor,p_source,p_inspection,p_return,p_documentation,p_video);
end $$;
revoke all on function public.experience_sale_close(uuid,uuid,text,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.experience_sale_close(uuid,uuid,text,boolean,boolean,boolean,boolean) to service_role;
