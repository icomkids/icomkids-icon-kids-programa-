create table public.icom_bank_user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 assistant_name text not null default 'IA Bank' check (char_length(assistant_name) between 1 and 40),
 menu_order jsonb not null default '[]'::jsonb check(jsonb_typeof(menu_order)='array' and jsonb_array_length(menu_order)<=12),
 layout_orders jsonb not null default '{}'::jsonb check(jsonb_typeof(layout_orders)='object' and octet_length(layout_orders::text)<=40000),
 updated_at timestamptz not null default now()
);
alter table public.icom_bank_user_preferences enable row level security;
revoke all on public.icom_bank_user_preferences from anon,authenticated;
grant select,insert,update on public.icom_bank_user_preferences to authenticated;
grant all on public.icom_bank_user_preferences to service_role;
create policy bank_preferences_own on public.icom_bank_user_preferences for all to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.icom_bank_user_access a where a.user_id=(select auth.uid()) and a.active))
 with check(user_id=(select auth.uid()) and exists(select 1 from public.icom_bank_user_access a where a.user_id=(select auth.uid()) and a.active));

create function public.icom_bank_save_preferences(p_patch jsonb) returns jsonb
 language plpgsql security invoker set search_path='' as $fn$
declare actor uuid:=auth.uid(); row public.icom_bank_user_preferences; item record;
begin
 if actor is null or not exists(select 1 from public.icom_bank_user_access where user_id=actor and active) then raise exception 'BANK_FORBIDDEN'; end if;
 if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or octet_length(p_patch::text)>40000 or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('assistant_name','menu_order','layout_orders')) then raise exception 'BANK_PREFERENCES_INVALID'; end if;
 if p_patch ? 'assistant_name' and (jsonb_typeof(p_patch->'assistant_name')<>'string' or char_length(btrim(p_patch->>'assistant_name')) not between 1 and 40 or p_patch->>'assistant_name' ~ '[[:cntrl:]]') then raise exception 'BANK_PREFERENCES_INVALID'; end if;
 if p_patch ? 'menu_order' then
  if jsonb_typeof(p_patch->'menu_order')<>'array' then raise exception 'BANK_PREFERENCES_INVALID'; end if;
  if jsonb_array_length(p_patch->'menu_order')>12 or exists(select 1 from jsonb_array_elements_text(p_patch->'menu_order') k where k not in ('dashboard','clientes','contratos','administrativo','parcelas','pagamentos','comprovantes','inadimplencia','veiculos','relatorios','funcionarios','configuracoes')) or (select count(*)<>count(distinct k) from jsonb_array_elements_text(p_patch->'menu_order') k) then raise exception 'BANK_PREFERENCES_INVALID'; end if;
 end if;
 if p_patch ? 'layout_orders' then
  if jsonb_typeof(p_patch->'layout_orders')<>'object' then raise exception 'BANK_PREFERENCES_INVALID'; end if;
  if (select count(*) from jsonb_object_keys(p_patch->'layout_orders'))>100 then raise exception 'BANK_PREFERENCES_INVALID'; end if;
  for item in select key,value from jsonb_each(p_patch->'layout_orders') loop
   if item.key !~ '^[a-zA-Z0-9/_?=.#:-]{1,180}$' or jsonb_typeof(item.value)<>'array' then raise exception 'BANK_PREFERENCES_INVALID'; end if;
   if jsonb_array_length(item.value)>60 or exists(select 1 from jsonb_array_elements(item.value) v where jsonb_typeof(v)<>'string' or char_length(v#>>'{}') not between 1 and 120) or (select count(*)<>count(distinct v) from jsonb_array_elements_text(item.value) v) then raise exception 'BANK_PREFERENCES_INVALID'; end if;
  end loop;
 end if;
 insert into public.icom_bank_user_preferences(user_id,assistant_name,menu_order,layout_orders)
 values(actor,coalesce(p_patch->>'assistant_name','IA Bank'),coalesce(p_patch->'menu_order','[]'),coalesce(p_patch->'layout_orders','{}'))
 on conflict(user_id) do update set
 assistant_name=case when p_patch ? 'assistant_name' then excluded.assistant_name else icom_bank_user_preferences.assistant_name end,
 menu_order=case when p_patch ? 'menu_order' then excluded.menu_order else icom_bank_user_preferences.menu_order end,
 layout_orders=icom_bank_user_preferences.layout_orders||coalesce(p_patch->'layout_orders','{}'), updated_at=now()
 returning * into row;
 return jsonb_build_object('assistant_name',row.assistant_name,'menu_order',row.menu_order,'layout_orders',row.layout_orders);
end $fn$;
revoke all on function public.icom_bank_save_preferences(jsonb) from public,anon;
grant execute on function public.icom_bank_save_preferences(jsonb) to authenticated;
