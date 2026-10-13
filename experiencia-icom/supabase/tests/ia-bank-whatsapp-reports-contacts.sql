begin;
do $$
declare b public.icom_bank_whatsapp_bot;j uuid;c uuid;i int;original jsonb;begin
 select * into b from public.icom_bank_whatsapp_bot where id=1;
 insert into public.icom_bank_whatsapp_inbox(owner_id,provider_id,sender,type,text,sent_at,status,claim_id)
 values(b.owner_id,'qa-read-'||gen_random_uuid(),b.allowed_phones[1],'text','Qual meu lucro atual?',now(),'PROCESSANDO',gen_random_uuid()) returning id,claim_id into j,c;
 perform set_config('qa.whatsapp_id',j::text,true);perform set_config('qa.whatsapp_claim',c::text,true);perform set_config('qa.whatsapp_owner',b.owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b.owner_id,'role','authenticated')::text,true);
 original:=public.icom_bank_cash_entries();perform set_config('qa.whatsapp_ledger',original::text,true);
 for i in 1..40 loop
  insert into public.ia_bank_whatsapp_subscriber_contacts(name,phone,created_by)values('Teste somente rollback '||i,'5511988'||lpad(i::text,6,'0'),b.owner_id);
 end loop;
 begin
  insert into public.ia_bank_whatsapp_subscriber_contacts(name,phone,created_by)values('Teste limite','5511988999999',b.owner_id);
  raise exception 'QA_LIMIT_NOT_ENFORCED';
 exception when others then if sqlerrm<>'CONTACT_LIMIT_40' then raise;end if;end;
 begin
  insert into public.ia_bank_whatsapp_subscriber_contacts(name,phone,created_by)values('Número local',b.allowed_phones[1],b.owner_id);
  raise exception 'QA_LOCAL_NOT_BLOCKED';
 exception when others then if sqlerrm<>'CONTACT_IS_LOCAL_NUMBER' then raise;end if;end;
end $$;
set local role service_role;
do $$
declare result jsonb;t text;source jsonb;expected jsonb:=current_setting('qa.whatsapp_ledger')::jsonb;begin
 result:=public.icom_bank_whatsapp_read_rows(current_setting('qa.whatsapp_id')::uuid,current_setting('qa.whatsapp_claim')::uuid,'ledger');
 select coalesce(jsonb_agg(v-'cash_account_id'-'cash_account_purpose' order by ord),'[]'::jsonb) into source from jsonb_array_elements(result) with ordinality x(v,ord);
 if source<>expected then raise exception 'QA_LEDGER_DIFFERENT';end if;
 foreach t in array array['icom_bank_accounts','icom_bank_account_links','icom_bank_prolabore','icom_bank_rent_dues','icom_bank_personal_wealth','icom_bank_payables','icom_bank_stock_vehicles','icom_bank_investors','icom_bank_receivables','icom_bank_customers','icom_bank_user_access','icom_bank_system_settings','icom_bank_vehicles','icom_bank_contracts','icom_bank_installments','icom_bank_payments','icom_bank_payment_proofs'] loop
  result:=public.icom_bank_whatsapp_read_rows(current_setting('qa.whatsapp_id')::uuid,current_setting('qa.whatsapp_claim')::uuid,t);
  if jsonb_typeof(result)<>'array' then raise exception 'QA_ROWS_NOT_ARRAY';end if;
  if t='icom_bank_system_settings' and result::text like '%pix_key%' then raise exception 'QA_PIX_EXPOSED';end if;
  if t='icom_bank_customers' and (result::text like '%"cpf"%' or result::text like '%"phone"%') then raise exception 'QA_CUSTOMER_CONTACT_EXPOSED';end if;
 end loop;
 begin
  perform public.icom_bank_whatsapp_read_rows(current_setting('qa.whatsapp_id')::uuid,gen_random_uuid(),'ledger');raise exception 'QA_CLAIM_NOT_ENFORCED';
 exception when insufficient_privilege then null;end;
 begin
  perform public.icom_bank_whatsapp_read_rows(current_setting('qa.whatsapp_id')::uuid,current_setting('qa.whatsapp_claim')::uuid,'auth.users');raise exception 'QA_TABLE_NOT_ENFORCED';
 exception when others then if sqlerrm<>'BANK_WHATSAPP_READ_TABLE' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if (select count(*) from public.ia_bank_whatsapp_subscriber_contacts)<>0 then raise exception 'QA_CONTACTS_EXPOSED';end if;
 if has_function_privilege('authenticated','public.icom_bank_whatsapp_read_rows(uuid,uuid,text)','EXECUTE') or has_function_privilege('anon','public.icom_bank_whatsapp_read_rows(uuid,uuid,text)','EXECUTE') then raise exception 'QA_RPC_EXPOSED';end if;
 begin
  insert into public.ia_bank_whatsapp_subscriber_contacts(name,phone,created_by)values('Proibido','5511999999999',current_setting('qa.whatsapp_owner')::uuid);raise exception 'QA_DIRECT_INSERT_ALLOWED';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'WhatsApp reports and subscriber isolation checks passed; all test data rolled back' as result;
