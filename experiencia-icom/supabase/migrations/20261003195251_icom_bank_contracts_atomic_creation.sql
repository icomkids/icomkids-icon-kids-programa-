-- Atomic write, explicit module authorization; direct table writes remain revoked.
create function public.icom_bank_create_contract(p_customer uuid,p_request uuid,p_vehicle jsonb,p_finance jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); role_name text:=icom_bank_internal.role(); client public.icom_bank_customers;
 existing public.icom_bank_contracts; vehicle_id uuid; contract_number text;
 price bigint; entry bigint; principal bigint; installment bigint; amount bigint; qty integer;
 sold date; first_due date; due date; period text; plate text; fingerprint text;
 today date:=(now() at time zone 'America/Sao_Paulo')::date; i integer; anchor integer;
begin
 if actor is null or role_name is null or role_name not in('OWNER','ADMIN','GERENTE','VENDEDOR') then raise exception 'BANK_FORBIDDEN' using errcode='42501'; end if;
 if p_request is null or p_customer is null or jsonb_typeof(p_vehicle)<>'object' or jsonb_typeof(p_finance)<>'object' then raise exception 'BANK_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into client from public.icom_bank_customers where id=p_customer for share;
 if not found or client.status<>'ATIVO' or (role_name='VENDEDOR' and client.assigned_to is distinct from actor) then raise exception 'BANK_FORBIDDEN' using errcode='42501'; end if;
 if client.assigned_to is null or not exists(select 1 from public.icom_bank_user_access where user_id=client.assigned_to and active) then raise exception 'BANK_RESPONSIBLE_REQUIRED';end if;
 fingerprint:=md5(jsonb_build_object('customer',p_customer,'vehicle',p_vehicle,'finance',p_finance)::text);
 select * into existing from public.icom_bank_contracts where id=p_request;
 if found then
   if existing.terms->>'created_by' is distinct from actor::text or existing.terms->>'request_hash' is distinct from fingerprint then raise exception 'BANK_REQUEST_CONFLICT';end if;
   return jsonb_build_object('id',existing.id,'number',existing.number);
 end if;
 if length(coalesce(p_vehicle->>'brand','')) not between 2 and 160 or length(coalesce(p_vehicle->>'model','')) not between 2 and 160 then raise exception 'BANK_VEHICLE_INVALID';end if;
 plate:=upper(p_vehicle->>'plate');if plate is null or plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then raise exception 'BANK_PLATE_INVALID';end if;
 if octet_length(p_vehicle::text)>10000 or octet_length(p_finance::text)>8000 then raise exception 'BANK_INVALID';end if;
 -- Strict integer validation also applies to direct RPC callers.
 if coalesce(p_finance->>'vehicle_cents','') !~ '^[0-9]+$' or coalesce(p_finance->>'down_payment_cents','') !~ '^[0-9]+$' or coalesce(p_finance->>'installment_cents','') !~ '^[0-9]+$' or coalesce(p_finance->>'count','') !~ '^[0-9]+$' then raise exception 'BANK_AMOUNTS_INVALID';end if;
 price:=(p_finance->>'vehicle_cents')::bigint; entry:=(p_finance->>'down_payment_cents')::bigint; installment:=(p_finance->>'installment_cents')::bigint;qty:=(p_finance->>'count')::integer;
 if price not between 1 and 1000000000 or entry<0 or entry>=price or installment not between 1 and 1000000000 or qty not between 1 and 120 then raise exception 'BANK_AMOUNTS_INVALID';end if;
 principal:=price-entry;amount:=installment*qty;if amount<principal then raise exception 'BANK_TOTAL_INVALID';end if;
 if coalesce(p_finance->>'sale_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_finance->>'first_due','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'BANK_DATE_INVALID';end if;
 sold:=(p_finance->>'sale_date')::date;first_due:=(p_finance->>'first_due')::date;period:=p_finance->>'period';
 if sold>today or first_due<sold or period is null or period not in('MENSAL','QUINZENAL','SEMANAL') then raise exception 'BANK_DATE_INVALID';end if;
 if coalesce(p_finance->>'interest_bps','') !~ '^[0-9]+$' or coalesce(p_finance->>'fine_bps','') !~ '^[0-9]+$' or coalesce(p_finance->>'late_interest_bps','') !~ '^[0-9]+$' then raise exception 'BANK_RATE_INVALID';end if;
 if (p_finance->>'interest_bps')::integer not between 0 and 10000 or (p_finance->>'fine_bps')::integer not between 0 and 10000 or (p_finance->>'late_interest_bps')::integer not between 0 and 10000 then raise exception 'BANK_RATE_INVALID';end if;
 if exists(select 1 from public.icom_bank_contracts c join public.icom_bank_vehicles v on v.id=c.vehicle_id where c.status='ATIVO' and v.plate=plate) then raise exception 'BANK_PLATE_ACTIVE';end if;
 -- Serialize concurrent submissions for the same plate before rechecking.
 perform pg_advisory_xact_lock(hashtextextended(plate,1));
 if exists(select 1 from public.icom_bank_contracts c join public.icom_bank_vehicles v on v.id=c.vehicle_id where c.status='ATIVO' and v.plate=plate) then raise exception 'BANK_PLATE_ACTIVE';end if;
 insert into public.icom_bank_vehicles(customer_id,brand,model,plate,details) values(p_customer,p_vehicle->>'brand',p_vehicle->>'model',plate,p_vehicle-'brand'-'model'-'plate') returning id into vehicle_id;
 contract_number:='ICOM-'||extract(year from sold)::text||'-'||upper(substr(replace(p_request::text,'-',''),1,16));
 insert into public.icom_bank_contracts(id,customer_id,vehicle_id,number,seller_id,principal_cents,down_payment_cents,total_cents,sale_date,terms)
 values(p_request,p_customer,vehicle_id,contract_number,client.assigned_to,principal,entry,amount,sold,p_finance||jsonb_build_object('created_by',actor,'request_hash',fingerprint));
 anchor:=extract(day from first_due)::integer;
 for i in 0..qty-1 loop
  if period='MENSAL' then
   due:=(date_trunc('month',first_due)+make_interval(months=>i))::date;
   due:=due+(least(anchor,extract(day from (due+interval '1 month - 1 day'))::integer)-1);
  else due:=first_due+i*(case when period='SEMANAL' then 7 else 15 end);end if;
  insert into public.icom_bank_installments(contract_id,number,due_date,original_cents,updated_cents,status)
  values(p_request,i+1,due,installment,installment,case when due<today then 'ATRASADO' when due=today then 'VENCE_HOJE' else 'A_VENCER' end);
 end loop;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values
 (actor,'VEICULO_CRIADO',vehicle_id,jsonb_build_object('customer_id',p_customer)),
 (actor,'CONTRATO_CRIADO',p_request,jsonb_build_object('principal_cents',principal,'total_cents',amount,'down_payment_cents',entry)),
 (actor,'PARCELAS_GERADAS',p_request,jsonb_build_object('count',qty,'first_due',first_due,'period',period));
 return jsonb_build_object('id',p_request,'number',contract_number);
end $$;
revoke all on function public.icom_bank_create_contract(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.icom_bank_create_contract(uuid,uuid,jsonb,jsonb) to authenticated;
