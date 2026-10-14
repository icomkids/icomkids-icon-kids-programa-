-- Display classification only. Consignments use the existing investor capital
-- reserve/payment rules. No historical sale, expense or profit is changed.
do $patch$
declare s text;old_fragment text;
begin
 s:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 old_fragment:=$old$when 'VENDA' then array[$old$;
 if position(old_fragment in s)=0 then raise exception 'SALE_DETAILS_ALLOWLIST_NOT_FOUND';end if;
 s:=replace(s,old_fragment,$new$when 'VENDA' then array['capital_owner_type',$new$);
 execute s;
 s:=pg_get_functiondef('icom_bank_internal.guard_cash_ownership()'::regprocedure);
 old_fragment:=$old$if new.kind='VENDA' and new.details ? 'sale_owner' then$old$;
 if position(old_fragment in s)=0 then raise exception 'CASH_OWNER_GUARD_NOT_FOUND';end if;
 s:=replace(s,old_fragment,old_fragment||$new$
  if new.details ? 'capital_owner_type' and
  (new.details->>'sale_owner' is distinct from 'INVESTIDOR'
   or coalesce(new.details->>'capital_owner_type','') not in('INVESTIDOR','CONSIGNADO'))
  then raise exception 'BANK_CASH_INVALID';end if;
$new$);
 execute s;
end $patch$;
