begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.icom_bank_user_access where role='OWNER' and active order by created_at limit 1),true);
set local role authenticated;
do $test$
declare v_sale_id uuid:=gen_random_uuid();actor uuid:=auth.uid();seller uuid;body jsonb;result jsonb;version timestamptz;before_count bigint;before_profit bigint;message text;
begin
 select count(*),coalesce(sum((details->>'sale_cents')::bigint-coalesce((details->>'purchase_cents')::bigint,0)-coalesce((details->>'vehicle_cost_cents')::bigint,0)-coalesce((details->>'commission_cents')::bigint,0)),0) into before_count,before_profit from public.icom_bank_admin_entries where kind='VENDA';
 body:=jsonb_build_object('id',v_sale_id,'kind','VENDA','scope','LOJA','entry_date','2026-10-13','description','Teste transacional de nova venda','category','Venda de veículo','status','PREVISTO','amount_cents',0,'details',jsonb_build_object('customer_name','','customer_cpf','','customer_phone','','customer_email','','vehicle','Veículo não informado','plate','','purchase_cents',8500000,'vehicle_cost_cents',250000,'commission_cents',165000,'sale_cents',10200000,'sale_owner','LOJA','sale_mode','NORMAL','trade_in',false,'payment_method','PIX','notes','Teste que será revertido'));
 result:=public.icom_bank_save_admin_entry(body,null);
 if result#>>'{details,customer_name}' is distinct from '' or result#>>'{details,customer_cpf}' is distinct from '' or (result#>>'{details,sale_cents}')::bigint-(result#>>'{details,purchase_cents}')::bigint-(result#>>'{details,vehicle_cost_cents}')::bigint-(result#>>'{details,commission_cents}')::bigint<>1285000 then raise exception 'sale metadata or profit changed';end if;
 perform public.icom_bank_save_admin_entry(body,null);
 if (select count(*) from public.icom_bank_admin_entries where public.icom_bank_admin_entries.id=v_sale_id)<>1 then raise exception 'duplicate sale';end if;
 version:=(result->>'updated_at')::timestamptz;body:=jsonb_set(body,'{details,customer_name}','"Comprador de teste"');body:=jsonb_set(body,'{details,plate}','"ABC1D23"');
 result:=public.icom_bank_save_admin_entry(body,version);
 if result#>>'{details,customer_name}'<>'Comprador de teste' or result#>>'{details,plate}'<>'ABC1D23' then raise exception 'sale edit failed';end if;
 begin
  perform public.icom_bank_save_admin_entry(jsonb_set(body,'{details,customer_name}','23'),(result->>'updated_at')::timestamptz);
  raise exception 'invalid metadata accepted';
 exception when others then get stacked diagnostics message=MESSAGE_TEXT;if message<>'BANK_ADMIN_INVALID' then raise;end if;end;
 select user_id into seller from public.icom_bank_user_access where role='VENDEDOR' and active order by created_at limit 1;
 if seller is not null then
  perform set_config('request.jwt.claim.sub',seller::text,true);
  begin perform public.icom_bank_save_admin_entry(body,null);raise exception 'seller reached private sale ledger';
  exception when others then get stacked diagnostics message=MESSAGE_TEXT;if message<>'BANK_FORBIDDEN' then raise;end if;end;
  if (select count(*) from public.icom_bank_admin_entries where public.icom_bank_admin_entries.id=v_sale_id)<>0 then raise exception 'seller read buyer metadata';end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
 end if;
 if (select count(*) from public.icom_bank_admin_entries where kind='VENDA')<>before_count+1 then raise exception 'unexpected sale side effect';end if;
end $test$;
select 'PASS: optional buyer, blank vehicle, Mercosul plate, idempotent save, edit, unchanged profit and seller isolation; all changes rolled back' as result;
rollback;
