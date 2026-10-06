begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.icom_bank_user_access where active and role='OWNER' limit 1),true);
set local role authenticated;
do $$ declare identifier uuid:=gen_random_uuid();r public.icom_bank_investors;r2 public.icom_bank_investors;p jsonb;begin
 p:=jsonb_build_object('id',identifier,'name','TESTE INVESTIDOR ROLLBACK','email','test@example.com','phone','11999999999','notes','Fixture');
 r:=public.icom_bank_save_investor(p,null);r2:=public.icom_bank_save_investor(p,null);
 if r.updated_at<>r2.updated_at then raise exception 'Retry duplicated';end if;
 if not exists(select 1 from public.icom_bank_investors where id=identifier) then raise exception 'Owner RLS read failed';end if;
 begin perform public.icom_bank_save_investor(p||'{"phone":"11888888888"}',null);raise exception 'CAS bypassed';exception when raise_exception then if sqlerrm<>'BANK_INVESTOR_CHANGED' then raise;end if;end;
 r2:=public.icom_bank_save_investor(p||'{"phone":"11888888888"}',r.updated_at);
 if r2.phone<>'11888888888' then raise exception 'Contact edit lost';end if;
 begin perform public.icom_bank_save_investor(p||jsonb_build_object('id',gen_random_uuid()),null);raise exception 'Duplicate allowed';exception when raise_exception then if sqlerrm<>'BANK_INVESTOR_DUPLICATE' then raise;end if;end;
 begin update public.icom_bank_investors set name='Other' where id=identifier;raise exception 'Mutable name';exception when raise_exception then if sqlerrm<>'BANK_INVESTOR_NAME_LOCKED' then raise;end if;end;
 begin delete from public.icom_bank_investors where id=identifier;raise exception 'Delete allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare staff uuid;identifier uuid;owner_id uuid;payload jsonb;begin
 select user_id into owner_id from public.icom_bank_user_access where role='OWNER' and active limit 1;
 select id into identifier from public.icom_bank_investors where name='TESTE INVESTIDOR ROLLBACK';
 if (select count(*) from icom_bank_internal.investor_history where investor_id=identifier)<>2 then raise exception 'History mismatch';end if;
 payload:=jsonb_build_object('id',gen_random_uuid(),'kind','VENDA','scope','LOJA','entry_date','2026-10-06','description','TESTE VINCULO INVESTIDOR ROLLBACK','category','Venda','status','REALIZADO','amount_cents',100000,'details',jsonb_build_object('vehicle','Onix teste','purchase_cents',0,'vehicle_cost_cents',0,'commission_cents',165000,'sale_cents',100000,'sale_owner','INVESTIDOR','investor_id',identifier,'investor_name','TESTE INVESTIDOR ROLLBACK','trade_in',false,'payment_method','PIX'));
 perform public.icom_bank_save_admin_entry(payload,null);
 begin perform public.icom_bank_save_admin_entry(payload||jsonb_build_object('id',gen_random_uuid(),'details',(payload->'details')||'{"investor_name":"Forged name"}'),null);raise exception 'Forged investor accepted';exception when raise_exception then if sqlerrm<>'BANK_INVESTOR_INVALID' then raise;end if;end;
 for staff in select user_id from public.icom_bank_user_access where role<>'OWNER' and active loop
  perform set_config('request.jwt.claim.sub',staff::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.icom_bank_investors) then raise exception 'Investor data exposed to staff';end if;
  begin perform public.icom_bank_save_investor(jsonb_build_object('id',gen_random_uuid(),'name','NOT AUTHORIZED'),null);raise exception 'Unauthorized save';exception when raise_exception then if sqlerrm<>'BANK_FORBIDDEN' then raise;end if;end;
  execute 'reset role';
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role anon';
 begin perform public.icom_bank_save_investor('{}',null);raise exception 'Anon execute allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
rollback;
