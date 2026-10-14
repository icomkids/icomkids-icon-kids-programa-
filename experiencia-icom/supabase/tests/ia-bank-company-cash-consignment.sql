begin;
do $test$
declare owner_id uuid;s public.icom_bank_admin_entries;r public.icom_bank_admin_entries;
 payload jsonb;outgoing jsonb;origin uuid:=gen_random_uuid();paid uuid:=gen_random_uuid();
 partner uuid:=gen_random_uuid();today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 select user_id into strict owner_id from public.icom_bank_user_access where active and role='OWNER' limit 1;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.icom_bank_save_investor(jsonb_build_object('id',partner,'name','TEST CONSIGNANTE ROLLBACK','email','','phone','','notes',''),null);
 payload:=jsonb_build_object('id',origin,'kind','VENDA','scope','LOJA','entry_date',today,'description','TEST CONSIGNADO ROLLBACK','category','Venda','status','REALIZADO','amount_cents',10000000,'details',jsonb_build_object('vehicle','Carro teste','plate','TST9N01','sale_cents',10000000,'purchase_cents',8000000,'vehicle_cost_cents',100000,'commission_cents',165000,'sale_owner','INVESTIDOR','capital_owner_type','CONSIGNADO','investor_name','TEST CONSIGNANTE ROLLBACK','investor_id',partner,'sale_mode','NORMAL','trade_in',false,'payment_method','PIX'));
 perform public.icom_bank_save_admin_entry(payload,null);
 select * into strict s from public.icom_bank_admin_entries where id=origin;
 if s.details->>'capital_owner_type' is distinct from 'CONSIGNADO' then raise exception 'Consignment metadata lost';end if;
 if icom_bank_internal.cash_investor_headroom(s,today)<>8265000 then raise exception 'Incorrect third party reserve';end if;
 outgoing:=jsonb_build_object('id',paid,'kind','CUSTO','scope','LOJA','entry_date',today,'description','TEST REPASSE CONSIGNADO ROLLBACK','category','Repasse de capital de terceiros','status','REALIZADO','amount_cents',8265000,'details',jsonb_build_object('sale_cost_id',origin,'settlement_part','INVESTIDOR','payment_method','PIX'));
 perform public.icom_bank_save_admin_entry(outgoing,null);
 perform public.icom_bank_save_admin_entry(outgoing,null);
 if (select count(*) from public.icom_bank_admin_entries where id=paid)<>1 then raise exception 'Duplicate payment';end if;
 if icom_bank_internal.cash_investor_headroom(s,today)<>0 then raise exception 'Reserve not consumed';end if;
 begin perform public.icom_bank_save_admin_entry(outgoing||jsonb_build_object('id',gen_random_uuid(),'amount_cents',1),null);raise exception 'Profit spent as investor capital';exception when raise_exception then if sqlerrm<>'BANK_CASH_LIMIT' then raise;end if;end;
 begin perform public.icom_bank_save_admin_entry(payload||jsonb_build_object('id',gen_random_uuid(),'details',(payload->'details')||'{"capital_owner_type":"INVALIDO"}'),null);raise exception 'Invalid classification accepted';exception when raise_exception then if sqlerrm<>'BANK_CASH_INVALID' then raise;end if;end;
end $test$;
rollback;