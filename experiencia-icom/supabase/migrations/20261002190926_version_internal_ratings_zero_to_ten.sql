alter table public.customer_experiences add column rating_scale integer not null default 5 check(rating_scale in(5,10));
create function public.experience_use_ten_scale(p_token uuid) returns void language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences; a jsonb; k text; n integer; options text[];
begin
 select * into e from public.customer_experiences where token=p_token for update;
 if e.id is null or e.status='arquivada' or e.completed_at is not null or e.rating_scale=10 then return; end if;
 select answers into a from public.experience_responses where experience_id=e.id for update;
 if a is not null then
  foreach k in array array['overall_rating','salesperson_rating','transparency_rating','delivery_rating','store_cleanliness_rating','vehicle_cleanliness_rating','manager_rating','owner_rating'] loop
   if jsonb_typeof(a->k)='number' then a:=jsonb_set(a,array[k],to_jsonb((a->>k)::numeric*2)); end if;
  end loop;
  foreach k in array array['salesperson_understanding','documentation_experience'] loop
   options:=case when k='salesperson_understanding' then array['Não','Pouco','Parcialmente','Em grande parte','Sim, completamente'] else array['Muito complicado','Um pouco complicado','Normal','Fácil','Muito fácil'] end;
   n:=array_position(options,a->>k);
   if n is not null then a:=jsonb_set(a,array[k],to_jsonb(n*2)); end if;
  end loop;
  update public.experience_responses set answers=a,updated_at=now() where experience_id=e.id;
 end if;
 update public.customer_experiences set rating_scale=10 where id=e.id;
end $$;
revoke all on function public.experience_use_ten_scale(uuid) from public,anon,authenticated;
grant execute on function public.experience_use_ten_scale(uuid) to service_role;
