begin;
do $$ declare v_owner uuid;v_id uuid:=gen_random_uuid();v_payload jsonb;v_result jsonb;v_version timestamptz;begin
 select user_id into v_owner from public.icom_bank_user_access where role='OWNER' and active limit 1;
 if v_owner is null then raise exception 'Owner fixture missing';end if;
 perform set_config('test.admin.owner',v_owner::text,true);perform set_config('request.jwt.claim.sub',v_owner::text,true);perform set_config('test.admin.entry',v_id::text,true);
 v_payload:=jsonb_build_object('id',v_id,'kind','VENDA','scope','LOJA','entry_date','2026-10-05','description','TESTE TRANSACIONAL ADMINISTRATIVO','category','Venda','status','REALIZADO','amount_cents',400000,'details','{"vehicle":"Teste","plate":"ADM9Z99","purchase_cents":800000,"vehicle_cost_cents":10000,"commission_cents":20000,"sale_cents":1000000}'::jsonb);
 perform set_config('test.admin.payload',v_payload::text,true);
 v_result:=public.icom_bank_save_admin_entry(v_payload,null);v_version:=(v_result->>'updated_at')::timestamptz;
 perform public.icom_bank_save_admin_entry(v_payload,null);
 if (select count(*) from public.icom_bank_admin_history where entry_id=v_id)<>1 then raise exception 'Duplicate retry created history';end if;
 begin perform public.icom_bank_save_admin_entry(v_payload||'{"amount_cents":-1}',v_version);raise exception 'Negative amount accepted';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_INVALID' then raise;end if;end;
 begin perform public.icom_bank_save_admin_entry(v_payload||'{"details":{"vehicle":"Teste","purchase_cents":1.1}}',v_version);raise exception 'Invalid details accepted';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_INVALID' then raise;end if;end;
 begin perform public.icom_bank_save_admin_entry(v_payload||'{"scope":"PESSOAL"}',v_version);raise exception 'Invalid scope accepted';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_INVALID' then raise;end if;end;
 begin perform public.icom_bank_save_admin_entry(v_payload||jsonb_build_object('kind','RETORNO','amount_cents',100,'details','{"vehicle":"Teste","tax_cents":101}'::jsonb),v_version);raise exception 'Over-allocation accepted';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_INVALID' then raise;end if;end;
 v_result:=public.icom_bank_save_admin_entry(v_payload||'{"amount_cents":500000}',v_version);
 begin perform public.icom_bank_save_admin_entry(v_payload,v_version);raise exception 'Stale update accepted';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_CHANGED' then raise;end if;end;
 v_result:=public.icom_bank_archive_admin_entry(v_id,false,(v_result->>'updated_at')::timestamptz);
 if (v_result->>'active')::boolean then raise exception 'Archive failed';end if;
 perform public.icom_bank_archive_admin_entry(v_id,false,v_version);
 begin perform public.icom_bank_save_admin_entry(v_payload,(v_result->>'updated_at')::timestamptz);raise exception 'Archived entry editable';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_CHANGED' then raise;end if;end;
 v_result:=public.icom_bank_archive_admin_entry(v_id,true,(v_result->>'updated_at')::timestamptz);
 if not (v_result->>'active')::boolean or (select count(*) from public.icom_bank_admin_history where entry_id=v_id)<>4 then raise exception 'Restore or audit failed';end if;
 if exists(select 1 from public.icom_bank_audit_logs where entity_id=v_id and details<>'{"module":"ADMINISTRATIVO"}'::jsonb) then raise exception 'Private data leaked to general audit';end if;
 v_payload:=v_payload||jsonb_build_object('id',gen_random_uuid(),'kind','MENSAL','description','TESTE CONTA MENSAL','amount_cents',null,'details','{"due_day":31}'::jsonb);
 perform public.icom_bank_save_admin_entry(v_payload,null);
 begin perform public.icom_bank_save_admin_entry(v_payload||jsonb_build_object('id',gen_random_uuid()),null);raise exception 'Duplicate monthly account accepted';exception when raise_exception then if sqlerrm<>'BANK_ADMIN_DUPLICATE' then raise;end if;end;
 insert into public.icom_bank_admin_references(id,content) values(1,'{"private":"test"}') on conflict(id) do nothing;
end $$;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.icom_bank_admin_entries where id=current_setting('test.admin.entry')::uuid) then raise exception 'Owner cannot read entries';end if;
 begin update public.icom_bank_admin_entries set amount_cents=0;raise exception 'Direct write accepted';exception when insufficient_privilege then null;end;
 begin delete from public.icom_bank_admin_history;raise exception 'History deletable';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare v_role text;begin
 foreach v_role in array array['ADMIN','GERENTE','FINANCEIRO','VENDEDOR'] loop
  update public.icom_bank_user_access set role=v_role where user_id=current_setting('test.admin.owner')::uuid;
  execute 'set local role authenticated';
  if exists(select 1 from public.icom_bank_admin_entries) or exists(select 1 from public.icom_bank_admin_history) or exists(select 1 from public.icom_bank_admin_references) then raise exception 'Private data visible to %',v_role;end if;
  begin perform public.icom_bank_save_admin_entry(current_setting('test.admin.payload')::jsonb,null);raise exception 'Unauthorized save';exception when insufficient_privilege then null;end;
  begin perform public.icom_bank_archive_admin_entry(current_setting('test.admin.entry')::uuid,false,now());raise exception 'Unauthorized archive';exception when insufficient_privilege then null;end;
  execute 'reset role';
 end loop;
 update public.icom_bank_user_access set role='OWNER',active=false where user_id=current_setting('test.admin.owner')::uuid;
 execute 'set local role authenticated';
 if exists(select 1 from public.icom_bank_admin_entries) then raise exception 'Inactive owner read entries';end if;
 begin perform public.icom_bank_save_admin_entry(current_setting('test.admin.payload')::jsonb,null);raise exception 'Inactive owner saved';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
set local role anon;
do $$ begin
 begin perform public.icom_bank_save_admin_entry('{}',null);raise exception 'Anonymous save';exception when insufficient_privilege then null;end;
 begin perform 1 from public.icom_bank_admin_entries;raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
end $$;
reset role;

rollback;
select 'Administrative validation, totals boundaries, archive, restore, private history and owner authorization passed; fixtures rolled back' as result;
