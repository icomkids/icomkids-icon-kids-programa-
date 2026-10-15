-- Services are broken out for display, and included once in the existing
-- sale/cost totals so cash, investor reservations, receivables and contracts
-- continue to use the same audited financial amounts. No existing rows change.
do $patch$ declare s text;a text;b text;begin
 s:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamp with time zone)'::regprocedure);
 a:=$a$v_money text[]:=array[$a$;
 b:=$b$v_money text[]:=array['documentation_cost_cents','documentation_sale_cents','inspection_cost_cents','inspection_sale_cents',$b$;
 if position(a in s)=0 then raise exception 'SERVICE_MONEY_ANCHOR';end if;s:=replace(s,a,b);
 a:=$a$when 'VENDA' then array[$a$;
 b:=$b$when 'VENDA' then array['documentation_sold','documentation_cost_cents','documentation_sale_cents','inspection_sold','inspection_cost_cents','inspection_sale_cents',$b$;
 if position(a in s)=0 then raise exception 'SERVICE_KEYS_ANCHOR';end if;s:=replace(s,a,b);
 a:=$a$elsif v_key in ('trade_in','trade_has_debts','trade_has_payoff') then$a$;
 b:=$b$elsif v_key in ('documentation_sold','inspection_sold','trade_in','trade_has_debts','trade_has_payoff') then$b$;
 if position(a in s)=0 then raise exception 'SERVICE_BOOLEAN_ANCHOR';end if;s:=replace(s,a,b);
 a:=$a$if coalesce(v_details->>'plate','')<>''$a$;
 b:=$b$if v_kind='VENDA' then
   foreach v_key in array array['documentation','inspection'] loop
    if coalesce((v_details->>(v_key||'_sold'))::boolean,false) then
     if not(v_details ?& array[v_key||'_cost_cents',v_key||'_sale_cents']) then raise exception 'BANK_ADMIN_INVALID';end if;
    elsif v_details ? (v_key||'_cost_cents') or v_details ? (v_key||'_sale_cents') then raise exception 'BANK_ADMIN_INVALID';end if;
   end loop;
   if coalesce((v_details->>'documentation_cost_cents')::bigint,0)+coalesce((v_details->>'inspection_cost_cents')::bigint,0)>coalesce((v_details->>'vehicle_cost_cents')::bigint,0)
   or coalesce((v_details->>'documentation_sale_cents')::bigint,0)+coalesce((v_details->>'inspection_sale_cents')::bigint,0)>coalesce((v_details->>'sale_cents')::bigint,0) then raise exception 'BANK_ADMIN_INVALID';end if;
  end if;
  if coalesce(v_details->>'plate','')<>''$b$;
 if position(a in s)=0 then raise exception 'SERVICE_VALIDATION_ANCHOR';end if;s:=replace(s,a,b);execute s;
 -- Preparation costs remain checked against the stock ledger. Service costs
 -- belong to this sale and must not be mistaken for stock preparation.
 s:=pg_get_functiondef('icom_bank_internal.guard_stock_entry()'::regprocedure);
 a:=$a$(new.details->>'vehicle_cost_cents')::bigint<>v_cost$a$;
 b:=$b$(new.details->>'vehicle_cost_cents')::bigint-coalesce((new.details->>'documentation_cost_cents')::bigint,0)-coalesce((new.details->>'inspection_cost_cents')::bigint,0)<>v_cost$b$;
 if position(a in s)=0 then raise exception 'SERVICE_STOCK_ANCHOR';end if;s:=replace(s,a,b);execute s;
end $patch$;
notify pgrst,'reload schema';
