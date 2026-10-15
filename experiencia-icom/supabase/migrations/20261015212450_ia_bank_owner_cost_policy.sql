-- Explicit contracts: fixed capital or maintenance deducted from capital.
-- Rows without this field retain the historical allocation; no ledger data is rewritten.
create function icom_bank_internal.owner_maintenance_deduction(d jsonb) returns bigint
language sql immutable set search_path='' as $$
 select case when d->>'sale_owner'='INVESTIDOR' and d->>'owner_cost_policy'='DESCONTAR_CUSTOS' then
 least(coalesce((d->>'purchase_cents')::bigint,0),greatest(0,coalesce((d->>'vehicle_cost_cents')::bigint,0)
 -case when d->>'documentation_sold'='true' then coalesce((d->>'documentation_cost_cents')::bigint,0) else 0 end
 -case when d->>'inspection_sold'='true' then coalesce((d->>'inspection_cost_cents')::bigint,0) else 0 end)) else 0 end;
$$;
create or replace function icom_bank_internal.cash_investor_target(d jsonb) returns bigint
language sql immutable set search_path='' as $$
 select greatest(0,coalesce((d->>'purchase_cents')::bigint,0)
 +case when coalesce(d->>'owner_cost_policy','') in('FIXO','DESCONTAR_CUSTOS') then -icom_bank_internal.owner_maintenance_deduction(d)
 else coalesce((d->>'vehicle_cost_cents')::bigint,0)+coalesce((d->>'commission_cents')::bigint,0) end
 -case when icom_bank_internal.cash_same_investor(d) then
 coalesce((d->>'trade_value_cents')::bigint,0)-case when d->>'trade_has_debts'='true'
 then coalesce((d->>'trade_ipva_cents')::bigint,0)+coalesce((d->>'trade_fines_cents')::bigint,0)
 +case when d->>'trade_has_payoff'='true' then coalesce((d->>'trade_payoff_cents')::bigint,0) else 0 end
 else 0 end else 0 end);
$$;
revoke all on function icom_bank_internal.owner_maintenance_deduction(jsonb) from public,anon,authenticated;
do $patch$ declare s text;a text;b text;begin
 s:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 a:=$a$when 'VENDA' then array[$a$; b:=$b$when 'VENDA' then array['owner_cost_policy',$b$;
 if position(a in s)=0 then raise exception 'OWNER_POLICY_KEYS_ANCHOR';end if;s:=replace(s,a,b);
 a:=$a$if coalesce(v_details->>'plate','')<>''$a$;
 b:=$b$if v_details ? 'owner_cost_policy' then
   if coalesce(v_details->>'owner_cost_policy','') not in('FIXO','DESCONTAR_CUSTOS') then raise exception 'BANK_ADMIN_INVALID';end if;
   if v_details->>'sale_owner' is distinct from 'INVESTIDOR' then v_details:=v_details-'owner_cost_policy';end if;
  end if;
  if coalesce(v_details->>'plate','')<>''$b$;
 if position(a in s)=0 then raise exception 'OWNER_POLICY_VALIDATE_ANCHOR';end if;s:=replace(s,a,b);execute s;
 s:=pg_get_functiondef('icom_bank_internal.cash_investor_headroom(public.icom_bank_admin_entries,date,uuid)'::regprocedure);
 a:=$a$icom_bank_internal.cash_investor_target(s.details)-costs-case$a$;
 b:=$b$icom_bank_internal.cash_investor_target(s.details)-case when coalesce(s.details->>'owner_cost_policy','') in('FIXO','DESCONTAR_CUSTOS') then 0 else costs end-case$b$;
 if position(a in s)=0 then raise exception 'OWNER_POLICY_HEADROOM_ANCHOR';end if;s:=replace(s,a,b);execute s;
 s:=pg_get_functiondef('icom_bank_internal.guard_cash_ownership()'::regprocedure);
 a:=$a$if s.details->>'sale_owner'='INVESTIDOR' and new.amount_cents>icom_bank_internal.cash_investor_headroom(s,new.entry_date,new.id) then$a$;
 b:=$b$if s.details->>'sale_owner'='INVESTIDOR' and coalesce(s.details->>'owner_cost_policy','') not in('FIXO','DESCONTAR_CUSTOS') and new.amount_cents>icom_bank_internal.cash_investor_headroom(s,new.entry_date,new.id) then$b$;
 if position(a in s)=0 then raise exception 'OWNER_POLICY_COST_GUARD_ANCHOR';end if;s:=replace(s,a,b);execute s;
 -- This agreement does not change trade inventory, but linked payouts still lock financial edits.
 s:=pg_get_functiondef('icom_bank_internal.sync_stock_entry()'::regprocedure);
 a:=$a$array['sale_owner','investor_name','sale_mode','trade_destination','trade_investor_name','vehicle_spec'$a$;
 b:=$b$array['owner_cost_policy','sale_owner','investor_name','sale_mode','trade_destination','trade_investor_name','vehicle_spec'$b$;
 if position(a in s)=0 then raise exception 'OWNER_POLICY_STOCK_SYNC_ANCHOR';end if;s:=replace(s,a,b);execute s;
end $patch$;
notify pgrst,'reload schema';
