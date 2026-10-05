create or replace function public.icom_bank_save_admin_entry(p_payload jsonb,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_kind text;v_scope text;v_date date;v_amount bigint;v_description text;v_category text;v_status text;v_details jsonb;v_keys text[];v_key text;v_money text[]:=array['trade_value_cents','trade_ipva_cents','trade_fines_cents','trade_payoff_cents','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','financed_cents','tax_cents','manager_cents','seller_cents','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents'];v_before public.icom_bank_admin_entries;v_after public.icom_bank_admin_entries;v_found boolean;v_action text;v_trade bigint:=0;v_debt bigint:=0;v_remaining bigint;v_banks text[]:=array['Banco do Brasil','Bradesco','BV','C6 Bank','Caixa','Cresol','Itaú','Pan','Porto Bank','Safra','Santander','Sicoob','Sicredi','OUTRO'];
begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>8000 then raise exception 'BANK_ADMIN_INVALID';end if;
 begin
  v_id:=(p_payload->>'id')::uuid;v_kind:=p_payload->>'kind';v_scope:=p_payload->>'scope';v_date:=(p_payload->>'entry_date')::date;
  v_description:=trim(p_payload->>'description');v_category:=coalesce(trim(p_payload->>'category'),'');v_status:=p_payload->>'status';v_details:=p_payload->'details';
  if p_payload->>'amount_cents' is not null then
   if jsonb_typeof(p_payload->'amount_cents')<>'number' or (p_payload->>'amount_cents')!~'^\d+$' then raise exception 'BANK_ADMIN_INVALID';end if;
   v_amount:=(p_payload->>'amount_cents')::bigint;
  end if;
 exception when others then raise exception 'BANK_ADMIN_INVALID';end;
 if v_id is null or v_kind is null or v_kind not in ('VENDA','ENTRADA','CUSTO','RETORNO','TROCA','MENSAL','PESSOAL') or v_scope is null or v_scope not in ('LOJA','PESSOAL') or
 (v_kind='PESSOAL' and v_scope<>'PESSOAL') or (v_kind not in ('MENSAL','PESSOAL') and v_scope<>'LOJA') or v_date is null or v_date<date '2000-01-01' or v_date>date '2100-12-31' or
 (p_payload->>'entry_date')!~'^\d{4}-\d{2}-\d{2}$' or to_char(v_date,'YYYY-MM-DD')<>p_payload->>'entry_date' or
 v_description is null or length(v_description)<2 or length(v_description)>160 or length(v_category)>80 or v_status is null or v_status not in ('PREVISTO','REALIZADO') or
 (v_amount is null and v_kind not in ('MENSAL','TROCA')) or v_amount<0 or v_amount>1000000000 or jsonb_typeof(v_details) is distinct from 'object' or octet_length(v_details::text)>6000 then raise exception 'BANK_ADMIN_INVALID';end if;
 v_keys:=case v_kind
 when 'VENDA' then array['trade_in','trade_has_debts','trade_has_payoff','trade_plate','trade_year','trade_value_cents','trade_ipva_cents','trade_fines_cents','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other','payment_bank','payment_bank_other','vehicle','trade_vehicle','plate','seller','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','notes','payment_method']
 when 'RETORNO' then array['vehicle','plate','seller','bank','return_level','financed_cents','tax_cents','manager_cents','seller_cents','notes']
 when 'TROCA' then array['vehicle','plate','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents','notes']
 when 'CUSTO' then array['vehicle','plate','notes','payment_method']
 when 'MENSAL' then array['due_day','notes','payment_method'] else array['notes','payment_method'] end;
 for v_key in select jsonb_object_keys(v_details) loop
  if not (v_key=any(v_keys)) then raise exception 'BANK_ADMIN_INVALID';end if;
  if v_key=any(v_money) then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric>1000000000 then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key in ('trade_in','trade_has_debts','trade_has_payoff') then
   if jsonb_typeof(v_details->v_key)<>'boolean' then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key='trade_year' then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric<1900 or (v_details->>v_key)::numeric>2100 then raise exception 'BANK_ADMIN_INVALID';end if;
  elsif v_key in ('due_day','return_level') then
   if jsonb_typeof(v_details->v_key)<>'number' or (v_details->>v_key)!~'^\d+$' or (v_details->>v_key)::numeric<1 or (v_details->>v_key)::numeric>(case when v_key='due_day' then 31 else 3 end) then raise exception 'BANK_ADMIN_INVALID';end if;
  else
   if jsonb_typeof(v_details->v_key)<>'string' or length(v_details->>v_key)>(case when v_key='notes' then 2000 when v_key='plate' then 7 else 160 end) then raise exception 'BANK_ADMIN_INVALID';end if;
  end if;
 end loop;
 if coalesce(v_details->>'plate','')<>'' and (v_details->>'plate')!~'^[A-Z]{3}\d[A-Z0-9]\d{2}$' then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind in ('VENDA','RETORNO','TROCA') and length(trim(coalesce(v_details->>'vehicle','')))<1 then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind='VENDA' and not (v_details ?& array['purchase_cents','vehicle_cost_cents','commission_cents','sale_cents']) then raise exception 'BANK_ADMIN_INVALID';end if;
 if v_kind='VENDA' and v_details ? 'trade_in' then
  if (v_details->>'trade_in')::boolean then
   if length(trim(coalesce(v_details->>'trade_vehicle','')))=0 or coalesce(v_details->>'trade_plate','')!~'^[A-Z]{3}\d[A-Z0-9]\d{2}$' or not(v_details ?& array['trade_year','trade_value_cents','trade_has_debts']) then raise exception 'BANK_ADMIN_INVALID';end if;
   v_trade:=(v_details->>'trade_value_cents')::bigint;if v_trade<=0 then raise exception 'BANK_ADMIN_INVALID';end if;
   if (v_details->>'trade_has_debts')::boolean then
    if not(v_details ?& array['trade_ipva_cents','trade_fines_cents','trade_has_payoff']) then raise exception 'BANK_ADMIN_INVALID';end if;
    v_debt:=(v_details->>'trade_ipva_cents')::bigint+(v_details->>'trade_fines_cents')::bigint;
    if (v_details->>'trade_has_payoff')::boolean then
     if coalesce((v_details->>'trade_payoff_cents')::bigint,0)<=0 or coalesce(v_details->>'trade_payoff_bank','')<>all(v_banks) or (v_details->>'trade_payoff_bank'='OUTRO' and length(trim(coalesce(v_details->>'trade_payoff_bank_other','')))=0) then raise exception 'BANK_ADMIN_INVALID';end if;
     v_debt:=v_debt+(v_details->>'trade_payoff_cents')::bigint;
     if v_details->>'trade_payoff_bank'<>'OUTRO' then v_details:=v_details-'trade_payoff_bank_other';end if;
    else v_details:=v_details-array['trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other'];end if;
    if v_debt=0 then raise exception 'BANK_ADMIN_INVALID';end if;
   else v_details:=v_details-array['trade_ipva_cents','trade_fines_cents','trade_has_payoff','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other'];end if;
  else v_details:=v_details-array['trade_vehicle','trade_plate','trade_year','trade_value_cents','trade_has_debts','trade_ipva_cents','trade_fines_cents','trade_has_payoff','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other'];end if;
  v_remaining:=(v_details->>'sale_cents')::bigint-v_trade+v_debt;
  if v_debt>v_trade or v_remaining<0 or v_amount>v_remaining then raise exception 'BANK_ADMIN_INVALID';end if;
  if coalesce(v_details->>'payment_method','') not in ('PIX','DINHEIRO','CARTAO','FINANCIAMENTO','SEM_DIFERENCA') or (v_details->>'payment_method'='SEM_DIFERENCA' and v_remaining<>0) then raise exception 'BANK_ADMIN_INVALID';end if;
  if v_details->>'payment_method'='FINANCIAMENTO' then
   if coalesce(v_details->>'payment_bank','')<>all(v_banks) or (v_details->>'payment_bank'='OUTRO' and length(trim(coalesce(v_details->>'payment_bank_other','')))=0) then raise exception 'BANK_ADMIN_INVALID';end if;
   if v_details->>'payment_bank'<>'OUTRO' then v_details:=v_details-'payment_bank_other';end if;
  else v_details:=v_details-array['payment_bank','payment_bank_other'];end if;
 end if;
 if v_kind='RETORNO' and coalesce((v_details->>'tax_cents')::bigint,0)+coalesce((v_details->>'manager_cents')::bigint,0)+coalesce((v_details->>'seller_cents')::bigint,0)>v_amount then raise exception 'BANK_ADMIN_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text,0));
 select * into v_before from public.icom_bank_admin_entries where id=v_id for update;v_found:=found;
 if v_found then
  if p_expected is null then
   if v_before.created_by=auth.uid() and v_before.active and v_before.kind=v_kind and v_before.scope=v_scope and v_before.entry_date=v_date and v_before.description=v_description and v_before.category=v_category and v_before.status=v_status and v_before.amount_cents is not distinct from v_amount and v_before.details=v_details then return to_jsonb(v_before);end if;
   raise exception 'BANK_ADMIN_CHANGED';
  end if;
  if not v_before.active or v_before.updated_at is distinct from p_expected then raise exception 'BANK_ADMIN_CHANGED';end if;
  update public.icom_bank_admin_entries set kind=v_kind,scope=v_scope,entry_date=v_date,description=v_description,category=v_category,status=v_status,amount_cents=v_amount,details=v_details,updated_at=clock_timestamp() where id=v_id returning * into v_after;v_action:='EDITADO';
 else
  if p_expected is not null then raise exception 'BANK_ADMIN_CHANGED';end if;
  insert into public.icom_bank_admin_entries(id,kind,scope,entry_date,description,category,status,amount_cents,details,created_by) values(v_id,v_kind,v_scope,v_date,v_description,v_category,v_status,v_amount,v_details,auth.uid()) returning * into v_after;v_action:='CRIADO';
 end if;
 insert into public.icom_bank_admin_history(entry_id,actor_id,action,previous,next) values(v_id,auth.uid(),v_action,case when v_found then to_jsonb(v_before) else null end,to_jsonb(v_after));
 -- The general audit is visible to other administrative roles; private financial snapshots stay in the owner-only history.
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'ADMINISTRATIVO_'||v_action,v_id,'{"module":"ADMINISTRATIVO"}');
 return to_jsonb(v_after);
exception when unique_violation then raise exception 'BANK_ADMIN_DUPLICATE';
end $$;
revoke all on function public.icom_bank_save_admin_entry(jsonb,timestamptz) from public,anon;
grant execute on function public.icom_bank_save_admin_entry(jsonb,timestamptz) to authenticated;

notify pgrst,'reload schema';
do $$ declare v_owner uuid;v_seller uuid;v_id uuid:=gen_random_uuid();v_payload jsonb;v_result jsonb;v_bad jsonb;begin
 select user_id into v_owner from public.icom_bank_user_access where role='OWNER' and active limit 1;
 select user_id into v_seller from public.icom_bank_user_access where role='VENDEDOR' and active limit 1;
 if v_owner is null or v_seller is null then raise exception 'Validation accounts missing';end if;
 begin
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  v_payload:=jsonb_build_object('id',v_id,'kind','VENDA','scope','LOJA','entry_date','2026-10-05','description','TESTE TRANSACIONAL TROCA','category','Venda de veículo','status','REALIZADO','amount_cents',5700000,'details','{"vehicle":"Teste","purchase_cents":8500000,"vehicle_cost_cents":250000,"commission_cents":165000,"sale_cents":10200000,"trade_in":true,"trade_vehicle":"Troca teste","trade_plate":"XYZ9A99","trade_year":2020,"trade_value_cents":5000000,"trade_has_debts":true,"trade_ipva_cents":100000,"trade_fines_cents":50000,"trade_has_payoff":true,"trade_payoff_cents":350000,"trade_payoff_bank":"Safra","payment_method":"FINANCIAMENTO","payment_bank":"Itaú"}'::jsonb);
  v_result:=public.icom_bank_save_admin_entry(v_payload,null);
  if v_result->'details'->>'trade_payoff_bank'<>'Safra' or (v_result->>'amount_cents')::bigint<>5700000 then raise exception 'Trade details not retained';end if;
  perform public.icom_bank_save_admin_entry(v_payload,null);
  if (select count(*) from public.icom_bank_admin_history where entry_id=v_id)<>1 then raise exception 'Retry duplicated audit';end if;
  foreach v_bad in array array['{"trade_plate":"bad"}','{"trade_year":1899}','{"trade_in":"true"}','{"trade_value_cents":0}','{"trade_ipva_cents":5000001}','{"trade_has_debts":true,"trade_ipva_cents":0,"trade_fines_cents":0,"trade_has_payoff":false}','{"trade_payoff_bank":""}','{"payment_bank":"invalid"}','{"payment_bank":"OUTRO","payment_bank_other":""}']::jsonb[] loop
   begin perform public.icom_bank_save_admin_entry(v_payload||jsonb_build_object('id',gen_random_uuid(),'details',(v_payload->'details')||v_bad),null);raise exception 'Invalid trade accepted: %',v_bad;
   exception when raise_exception then if sqlerrm<>'BANK_ADMIN_INVALID' then raise;end if;end;
  end loop;
  begin perform public.icom_bank_save_admin_entry(v_payload||jsonb_build_object('id',gen_random_uuid(),'amount_cents',5700001),null);raise exception 'Excess received accepted';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_INVALID' then raise;end if;end;
  v_result:=public.icom_bank_save_admin_entry(v_payload||jsonb_build_object('id',gen_random_uuid(),'details',(v_payload->'details')||'{"trade_in":false,"payment_method":"PIX"}'),null);
  if v_result->'details' ? 'trade_vehicle' or v_result->'details' ? 'payment_bank' then raise exception 'Inactive branches retained';end if;
  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  begin perform public.icom_bank_save_admin_entry(v_payload,null);raise exception 'Seller saved private ledger';exception when insufficient_privilege then null;end;
  raise exception using errcode='P0002',message='ROLLBACK_VALIDATION';
 exception when no_data_found then if sqlerrm<>'ROLLBACK_VALIDATION' then raise;end if;end;
 if exists(select 1 from public.icom_bank_admin_entries where id=v_id) then raise exception 'Validation data persisted';end if;
end $$;
