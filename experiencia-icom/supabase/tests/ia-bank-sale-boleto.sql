begin;
do $test$ declare actor uuid;s uuid:=gen_random_uuid();c uuid:=gen_random_uuid();loan uuid:=gen_random_uuid();v jsonb;f jsonb;row jsonb;first jsonb;before_count integer;begin
 select user_id into strict actor from public.icom_bank_user_access where active and role='OWNER';perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('sale.test_owner',actor::text,true);perform set_config('sale.test_id',s::text,true);
 insert into public.icom_bank_customers(id,name,cpf,assigned_to,created_by) values(c,'TEST BOLETO ROLLBACK','93541134780',actor,actor);
 row:=public.icom_bank_save_admin_entry(jsonb_build_object('id',s,'kind','VENDA','scope','LOJA','entry_date',current_date,'description','TEST BOLETO ROLLBACK','category','Venda de veículo','status','REALIZADO','amount_cents',2000000,'details',jsonb_build_object('vehicle','Chevrolet Onix','plate','TST1A23','sale_cents',10000000,'purchase_cents',8000000,'vehicle_cost_cents',0,'commission_cents',165000,'sale_owner','LOJA','sale_mode','NORMAL','trade_in',false,'payment_method','BOLETO_PROPRIO')),null);
 v:='{"brand":"Chevrolet","model":"Onix","plate":"TST1A23"}';f:=jsonb_build_object('vehicle_cents',10000000,'down_payment_cents',2000000,'count',4,'installment_cents',2000000,'sale_date',current_date,'first_due',current_date+30,'period','MENSAL','interest_bps',0,'fine_bps',0,'late_interest_bps',0,'notes','');
 select count(*) into before_count from public.icom_bank_admin_entries;
 begin perform public.icom_bank_create_sale_contract(s,(row->>'updated_at')::timestamptz,c,loan,v,f||'{"down_payment_cents":0}');raise exception 'Forged principal accepted';exception when raise_exception then if sqlerrm<>'BANK_SALE_CONTRACT_CHANGED' then raise;end if;end;
 if exists(select 1 from public.icom_bank_contracts where id=loan) then raise exception 'Failed request left partial contract';end if;
 first:=public.icom_bank_create_sale_contract(s,(row->>'updated_at')::timestamptz,c,loan,v,f);perform public.icom_bank_create_sale_contract(s,(row->>'updated_at')::timestamptz,c,loan,v,f);
 if (select count(*) from public.icom_bank_sale_contracts where sale_id=s)<>1 or (select count(*) from public.icom_bank_installments where contract_id=loan)<>4 then raise exception 'Duplicate loan or installments';end if;
 if (select count(*) from public.icom_bank_admin_entries)<>before_count or exists(select 1 from public.icom_bank_payments where installment_id in(select id from public.icom_bank_installments where contract_id=loan)) then raise exception 'Creating contract changed received money';end if;
 begin perform public.icom_bank_create_sale_contract(s,(row->>'updated_at')::timestamptz,c,gen_random_uuid(),v,f);raise exception 'Second contract accepted';exception when raise_exception then if sqlerrm<>'BANK_SALE_CONTRACT_EXISTS' then raise;end if;end;
 begin update public.icom_bank_admin_entries set details=details||'{"sale_cents":11000000}' where id=s;raise exception 'Linked price changed';exception when raise_exception then if sqlerrm<>'BANK_SALE_CONTRACT_LOCKED' then raise;end if;end;
 perform set_config('sale.test_contract',loan::text,true);perform set_config('sale.test_client',c::text,true);
end $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('sale.test_owner'),true);
do $test$ begin
 if not exists(select 1 from public.icom_bank_sale_contracts where sale_id=current_setting('sale.test_id')::uuid) then raise exception 'Owner cannot see linked contract';end if;
 if has_table_privilege('authenticated','public.icom_bank_sale_contracts','INSERT') or has_table_privilege('authenticated','public.icom_bank_sale_contracts','DELETE') then raise exception 'Direct link mutation exposed';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.icom_bank_sale_contracts) then raise exception 'Unauthenticated link leak';end if;
 begin perform public.icom_bank_create_sale_contract(current_setting('sale.test_id')::uuid,now(),current_setting('sale.test_client')::uuid,gen_random_uuid(),'{}','{}');raise exception 'Foreign creation accepted';exception when insufficient_privilege then null;end;
end $test$;
reset role;
rollback;
