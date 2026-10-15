-- Repasse and its commission are saved in the same transaction as the sale.
create table public.icom_bank_repasse_details(
 sale_id uuid primary key references public.icom_bank_admin_entries(id) deferrable initially deferred,
 origin_id uuid not null references public.icom_bank_admin_entries(id),
 stock_id uuid not null references public.icom_bank_stock_vehicles(id),
 manager_id uuid references public.icom_bank_user_access(user_id),manager_name text not null default '' check(length(manager_name)<=160),
 manager_cents bigint not null default 0 check(manager_cents between 0 and 1000000000),
 payable_id uuid unique references public.icom_bank_payables(id),active boolean not null default true,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp(),
 check((manager_cents=0 and manager_id is null) or (manager_cents>0 and manager_id is not null and length(trim(manager_name))>=2))
);
create unique index bank_repasse_stock_active on public.icom_bank_repasse_details(stock_id) where active;
create index bank_repasse_origin on public.icom_bank_repasse_details(origin_id);
create index bank_repasse_manager on public.icom_bank_repasse_details(manager_id);
create index bank_repasse_actor on public.icom_bank_repasse_details(created_by);
alter table public.icom_bank_repasse_details enable row level security;
revoke all on public.icom_bank_repasse_details from public,anon,authenticated;
grant select on public.icom_bank_repasse_details to authenticated;
create policy bank_repasse_owner on public.icom_bank_repasse_details for select to authenticated using(created_by=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');

-- Existing amount/cash guards keep their established purchase/cost math.
-- Only a commission matching the private repasse record can replace the old zero fee.
do $patch$ declare s text;a text;b text;begin
 s:=pg_get_functiondef('icom_bank_internal.guard_cash_ownership()'::regprocedure);
 a:=$a$coalesce((new.details->>'commission_cents')::bigint,-1)<>0$a$;
 b:=$b$coalesce((new.details->>'commission_cents')::bigint,-1)<>coalesce((select r.manager_cents from public.icom_bank_repasse_details r where r.sale_id=new.id),0)$b$;
 if position(a in s)=0 then raise exception 'REPASSE_PATCH_CASH_GUARD';end if;execute replace(s,a,b);
end $patch$;

create function icom_bank_internal.guard_repasse_sale() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.icom_bank_repasse_details;p public.icom_bank_payables;begin
 select * into r from public.icom_bank_repasse_details where sale_id=new.id;
 if not found then return new;end if;
 if new.kind<>'VENDA' or new.details->>'sale_mode' is distinct from 'REPASSE' or new.details->>'stock_id' is distinct from r.stock_id::text or (new.details->>'commission_cents')::bigint is distinct from r.manager_cents then raise exception 'BANK_REPASSE_CHANGED';end if;
 select * into p from public.icom_bank_payables where id=r.payable_id;
 if p.status='PAGO' and not new.active then raise exception 'BANK_REPASSE_PAID';end if;
 return new;
end $$;
revoke all on function icom_bank_internal.guard_repasse_sale() from public,anon,authenticated;
create trigger bank_repasse_guard before insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_repasse_sale();

create function icom_bank_internal.sync_repasse_commission() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.icom_bank_repasse_details;p public.icom_bank_payables;wanted boolean;begin
 select * into r from public.icom_bank_repasse_details where sale_id=new.id for update;
 if not found then return new;end if;
 wanted:=new.active and new.status='REALIZADO' and r.manager_cents>0;
 select * into p from public.icom_bank_payables where id=r.payable_id for update;
 if p.id is not null and p.status='PAGO' and (not wanted or p.amount_cents<>r.manager_cents) then raise exception 'BANK_REPASSE_PAID';end if;
 if wanted and p.id is null then
  insert into public.icom_bank_payables(kind,scope,person,title,category,amount_cents,bank,due_date,notes)
  values('DESPESA','LOJA','AMBOS',left('Comissão de repasse · '||r.manager_name||' · '||coalesce(new.details->>'plate',''),160),'Comissão de repasse',r.manager_cents,'',new.entry_date,'Gerente: '||r.manager_name||'. Repasse '||new.id::text||'. Custo já descontado do lucro; baixa vinculada sem duplicação.') returning * into p;
  update public.icom_bank_repasse_details set payable_id=p.id,updated_at=clock_timestamp() where sale_id=new.id;
 elsif p.id is not null and p.status='PENDENTE' then
  update public.icom_bank_payables set active=wanted,amount_cents=case when wanted then r.manager_cents else amount_cents end,
   title=left('Comissão de repasse · '||r.manager_name||' · '||coalesce(new.details->>'plate',''),160),updated_at=clock_timestamp() where id=p.id;
 end if;
 update public.icom_bank_repasse_details set active=new.active,updated_at=clock_timestamp() where sale_id=new.id;
 return new;
end $$;
revoke all on function icom_bank_internal.sync_repasse_commission() from public,anon,authenticated;
create trigger bank_repasse_sync after insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.sync_repasse_commission();

create function icom_bank_internal.guard_commission_payable() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.icom_bank_repasse_details;e public.icom_bank_admin_entries;begin
 select * into r from public.icom_bank_repasse_details where payable_id=new.id;
 if not found then return new;end if;
 select * into e from public.icom_bank_admin_entries where id=r.sale_id;
 if new.scope<>'LOJA' or new.kind<>'DESPESA' or new.stock_id is not null or (new.active and new.amount_cents<>r.manager_cents) or (not new.active and e.active and e.status='REALIZADO' and r.manager_cents>0) then raise exception 'BANK_REPASSE_CHANGED';end if;
 return new;
end $$;
revoke all on function icom_bank_internal.guard_commission_payable() from public,anon,authenticated;
create trigger bank_commission_payable_guard before update on public.icom_bank_payables for each row execute function icom_bank_internal.guard_commission_payable();

-- Reuse the existing payment and reversal workflow. Attach commissions to the
-- cost already included in repasse profit BEFORE saving or linking a cash exit.
do $patch$ declare s text;a text;b text;begin
 s:=pg_get_functiondef('public.icom_bank_pay_trade_debt(uuid,uuid,date,text,uuid,uuid,timestamptz)'::regprocedure);
 a:=$a$v_details:=jsonb_build_object('payment_method',p_method,'notes','Conta a pagar '||p.id::text);$a$;
 b:=a||$b$
  v_details:=v_details||coalesce((select jsonb_build_object('sale_cost_id',r.sale_id::text,'settlement_part','CUSTOS') from public.icom_bank_repasse_details r where r.payable_id=p.id and r.active),'{}'::jsonb);
$b$;
 if position(a in s)=0 then raise exception 'REPASSE_PATCH_PAYMENT_DETAILS';end if;s:=replace(s,a,b);
 a:=$a$insert into icom_bank_internal.payable_ledger_links$a$;
 b:=$b$if p_existing is not null and exists(select 1 from public.icom_bank_repasse_details r where r.payable_id=p.id and r.active) then
   if e.details ? 'sale_cost_id' and e.details->>'sale_cost_id' is distinct from (select r.sale_id::text from public.icom_bank_repasse_details r where r.payable_id=p.id) then raise exception 'BANK_PAYABLE_EXISTING';end if;
   perform public.icom_bank_save_admin_entry(to_jsonb(e)||jsonb_build_object('details',e.details||(select jsonb_build_object('sale_cost_id',r.sale_id::text,'settlement_part','CUSTOS') from public.icom_bank_repasse_details r where r.payable_id=p.id)),e.updated_at);
  end if;
 insert into icom_bank_internal.payable_ledger_links$b$;
 if position(a in s)=0 then raise exception 'REPASSE_PATCH_EXISTING_PAYMENT';end if;execute replace(s,a,b);
end $patch$;

create function icom_bank_internal.save_repasse_sale(p_payload jsonb,p_expected timestamptz,p_account uuid,p_manager uuid,p_manager_cents bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.icom_bank_stock_vehicles;o public.icom_bank_admin_entries;e public.icom_bank_admin_entries;r public.icom_bank_repasse_details;p public.icom_bank_payables;staff public.icom_bank_user_access;v_id uuid;result jsonb;details jsonb;fee bigint:=p_manager_cents;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>8000 or p_payload->>'kind' is distinct from 'VENDA' or p_payload->>'scope' is distinct from 'LOJA' or p_payload->'details'->>'sale_mode' is distinct from 'REPASSE' or fee is null or fee not between 0 and 1000000000 then raise exception 'BANK_REPASSE_INVALID';end if;
 begin v_id:=(p_payload->>'id')::uuid;select * into s from public.icom_bank_stock_vehicles where id=(p_payload->'details'->>'stock_id')::uuid for update;exception when others then raise exception 'BANK_REPASSE_INVALID';end;
 select * into o from public.icom_bank_admin_entries where id=s.origin_entry_id for update;
 if s.id is null or not s.active or o.created_by is distinct from auth.uid() or not o.active or o.status<>'REALIZADO' or s.source_details->>'trade_destination' is distinct from 'REPASSE' then raise exception 'BANK_REPASSE_INVALID';end if;
 if s.sold_entry_id is not null and s.sold_entry_id<>v_id then raise exception 'BANK_REPASSE_CHANGED';end if;
 details:=p_payload->'details';
 if length(trim(coalesce(details->>'customer_name','')))<2 or length(details->>'customer_name')>160 or length(coalesce(details->>'customer_phone',''))>30 then raise exception 'BANK_REPASSE_BUYER';end if;
 select * into r from public.icom_bank_repasse_details where sale_id=v_id for update;
 select * into p from public.icom_bank_payables where id=r.payable_id for update;
 if r.sale_id is not null and (r.created_by is distinct from auth.uid() or r.stock_id<>s.id) then raise exception 'BANK_FORBIDDEN';end if;
 if p.status='PAGO' and (r.manager_id is distinct from p_manager or r.manager_cents<>fee) then raise exception 'BANK_REPASSE_PAID';end if;
 if fee>0 then
  if p_manager is null then raise exception 'BANK_REPASSE_MANAGER';end if;
  select * into staff from public.icom_bank_user_access where user_id=p_manager and active and role='GERENTE';
  if staff.user_id is null and (r.manager_id is distinct from p_manager or r.manager_cents<>fee) then raise exception 'BANK_REPASSE_MANAGER';end if;
 elsif p_manager is not null then raise exception 'BANK_REPASSE_MANAGER';end if;
 if r.sale_id is null then
  insert into public.icom_bank_repasse_details(sale_id,origin_id,stock_id,manager_id,manager_name,manager_cents,created_by)
   values(v_id,o.id,s.id,p_manager,case when fee>0 then staff.name else '' end,fee,auth.uid());
 else
  update public.icom_bank_repasse_details set manager_id=p_manager,manager_name=case when fee>0 then coalesce(staff.name,r.manager_name) else '' end,manager_cents=fee where sale_id=v_id;
 end if;
 details:=details||jsonb_build_object('commission_cents',fee);
 if (p_payload->>'amount_cents')::bigint>0 and p_payload->>'status'='REALIZADO' then
  result:=public.icom_bank_account_post('LANCAMENTO',jsonb_build_object('p_payload',p_payload||jsonb_build_object('details',details),'p_expected',p_expected),p_account);
 else result:=public.icom_bank_save_admin_entry(p_payload||jsonb_build_object('details',details),p_expected);end if;
 -- Idempotent retries of the original request also leave exactly one obligation.
 select * into e from public.icom_bank_admin_entries where id=v_id;
 if not exists(select 1 from public.icom_bank_repasse_details where sale_id=v_id and payable_id is not null) and fee>0 and e.active and e.status='REALIZADO' then
  update public.icom_bank_admin_entries set updated_at=clock_timestamp() where id=v_id returning * into e;
  result:=to_jsonb(e);
 end if;
 return result;
end $$;
revoke all on function icom_bank_internal.save_repasse_sale(jsonb,timestamptz,uuid,uuid,bigint) from public,anon;
grant execute on function icom_bank_internal.save_repasse_sale(jsonb,timestamptz,uuid,uuid,bigint) to authenticated;
create function public.icom_bank_save_repasse_sale(p_payload jsonb,p_expected timestamptz,p_account uuid,p_manager uuid,p_manager_cents bigint) returns jsonb language sql security invoker set search_path='' as $$select icom_bank_internal.save_repasse_sale(p_payload,p_expected,p_account,p_manager,p_manager_cents)$$;
revoke all on function public.icom_bank_save_repasse_sale(jsonb,timestamptz,uuid,uuid,bigint) from public,anon;
grant execute on function public.icom_bank_save_repasse_sale(jsonb,timestamptz,uuid,uuid,bigint) to authenticated;

create function icom_bank_internal.save_sale_trade_repasse(p_payload jsonb,p_expected timestamptz,p_account uuid,p_repasse jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare parent_result jsonb;s public.icom_bank_stock_vehicles;o public.icom_bank_admin_entries;r public.icom_bank_repasse_details;child_payload jsonb;child_id uuid;spec jsonb;buyer text;phone text;v_sale bigint;v_received bigint;v_fee bigint;v_date date;manager uuid;account uuid;preparation bigint;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'kind' is distinct from 'VENDA' or p_payload->>'status' is distinct from 'REALIZADO' or p_payload->'details'->>'trade_in' is distinct from 'true' or p_payload->'details'->>'trade_destination' is distinct from 'REPASSE' or jsonb_typeof(p_repasse) is distinct from 'object' or octet_length(p_repasse::text)>3000 then raise exception 'BANK_REPASSE_REALIZED';end if;
 if (p_payload->>'amount_cents')::bigint>0 then parent_result:=public.icom_bank_account_post('LANCAMENTO',jsonb_build_object('p_payload',p_payload,'p_expected',p_expected),p_account);else parent_result:=public.icom_bank_save_admin_entry(p_payload,p_expected);end if;
 select * into o from public.icom_bank_admin_entries where id=(parent_result->>'id')::uuid for update;
 select * into s from public.icom_bank_stock_vehicles where origin_entry_id=o.id for update;
 if o.created_by is distinct from auth.uid() or s.id is null or not s.active then raise exception 'BANK_REPASSE_INVALID';end if;
 begin
  v_sale:=(p_repasse->>'sale_cents')::bigint;v_received:=(p_repasse->>'received_cents')::bigint;v_fee:=(p_repasse->>'manager_cents')::bigint;v_date:=(p_repasse->>'entry_date')::date;buyer:=trim(p_repasse->>'buyer_name');phone:=trim(coalesce(p_repasse->>'buyer_phone',''));manager:=(p_repasse->>'manager_id')::uuid;account:=(p_repasse->>'account_id')::uuid;
 exception when others then raise exception 'BANK_REPASSE_INVALID';end;
 if p_repasse->>'enabled' is distinct from 'true' or jsonb_typeof(p_repasse->'sale_cents') is distinct from 'number' or jsonb_typeof(p_repasse->'received_cents') is distinct from 'number' or jsonb_typeof(p_repasse->'manager_cents') is distinct from 'number' or (p_repasse->>'sale_cents')!~'^\d+$' or (p_repasse->>'received_cents')!~'^\d+$' or (p_repasse->>'manager_cents')!~'^\d+$' or v_sale is null or v_sale not between 1 and 1000000000 or v_received is null or v_received not between 0 and v_sale or v_fee is null or v_fee not between 0 and 1000000000 or v_date is null or v_date<o.entry_date or v_date>date '2100-12-31' or (p_repasse->>'entry_date')!~'^\d{4}-\d{2}-\d{2}$' or to_char(v_date,'YYYY-MM-DD') is distinct from p_repasse->>'entry_date' or coalesce(length(buyer),0) not between 2 and 160 or length(phone)>30 or coalesce(p_repasse->>'payment_method','') not in('PIX','DINHEIRO','CARTAO') then raise exception 'BANK_REPASSE_INVALID';end if;
 select * into r from public.icom_bank_repasse_details where stock_id=s.id and active for update;
 if r.sale_id is not null then
  if p_expected is null and exists(select 1 from public.icom_bank_admin_entries e where e.id=r.sale_id and (e.details->>'sale_cents')::bigint=v_sale and e.details->>'customer_name'=buyer and coalesce(e.details->>'customer_phone','')=phone and e.amount_cents=v_received and e.entry_date=v_date and e.details->>'payment_method'=p_repasse->>'payment_method') and r.manager_id is not distinct from manager and r.manager_cents=v_fee then return parent_result;end if;
  raise exception 'BANK_REPASSE_CHANGED';
 end if;
 if s.sold_entry_id is not null then raise exception 'BANK_REPASSE_CHANGED';end if;
 -- The owner states this repasse already occurred; debt obligations remain open.
 update public.icom_bank_stock_vehicles set status='DISPONIVEL',updated_at=clock_timestamp() where id=s.id;
 select coalesce(sum(amount_cents),0) into preparation from public.icom_bank_admin_entries where active and kind='CUSTO' and status='REALIZADO' and details->>'stock_id'=s.id::text;
 child_id:=gen_random_uuid();
 child_payload:=jsonb_build_object('id',child_id,'kind','VENDA','scope','LOJA','entry_date',v_date,'description',left('Repasse · '||s.plate||' · '||buyer,160),'category','Repasse de veículo','status','REALIZADO','amount_cents',v_received,'details',jsonb_build_object('vehicle',left(coalesce(s.vehicle->>'brand','')||' '||coalesce(s.vehicle->>'model',s.plate),160),'plate',s.plate,'stock_id',s.id::text,'sale_owner','LOJA','sale_mode','REPASSE','trade_in',false,'purchase_cents',s.purchase_cents,'vehicle_cost_cents',preparation,'commission_cents',v_fee,'sale_cents',v_sale,'customer_name',buyer,'customer_phone',phone,'payment_method',p_repasse->>'payment_method','notes','Repasse do carro recebido na venda '||o.id::text));
 if icom_bank_internal.valid_vehicle_spec(s.vehicle) then child_payload:=jsonb_set(child_payload,'{details,vehicle_spec}',s.vehicle);end if;
 perform icom_bank_internal.save_repasse_sale(child_payload,null,account,manager,v_fee);
 return parent_result;
end $$;
revoke all on function icom_bank_internal.save_sale_trade_repasse(jsonb,timestamptz,uuid,jsonb) from public,anon;
grant execute on function icom_bank_internal.save_sale_trade_repasse(jsonb,timestamptz,uuid,jsonb) to authenticated;
create function public.icom_bank_save_sale_trade_repasse(p_payload jsonb,p_expected timestamptz,p_account uuid,p_repasse jsonb) returns jsonb language sql security invoker set search_path='' as $$select icom_bank_internal.save_sale_trade_repasse(p_payload,p_expected,p_account,p_repasse)$$;
revoke all on function public.icom_bank_save_sale_trade_repasse(jsonb,timestamptz,uuid,jsonb) from public,anon;
grant execute on function public.icom_bank_save_sale_trade_repasse(jsonb,timestamptz,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
