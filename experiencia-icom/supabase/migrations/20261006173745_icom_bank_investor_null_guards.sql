-- Missing ownership/profile values must be rejected, not treated as SQL unknown.
do $patch$ declare s text;begin
 s:=pg_get_functiondef('icom_bank_internal.guard_entry_investors()'::regprocedure);
 s:=replace(s,$a$new.details->>'sale_owner'<>'INVESTIDOR'$a$,$a$new.details->>'sale_owner' is distinct from 'INVESTIDOR'$a$);
 s:=replace(s,$a$new.details->>'trade_destination'<>'INVESTIDOR'$a$,$a$new.details->>'trade_destination' is distinct from 'INVESTIDOR'$a$);
 execute s;
 s:=pg_get_functiondef('public.icom_bank_save_investor(jsonb,timestamptz)'::regprocedure);
 s:=replace(s,$a$icom_bank_internal.role()<>'OWNER'$a$,$a$icom_bank_internal.role() is distinct from 'OWNER'$a$);execute s;
 s:=pg_get_functiondef('icom_bank_internal.guard_investor()'::regprocedure);
 s:=replace(s,$a$icom_bank_internal.role()<>'OWNER'$a$,$a$icom_bank_internal.role() is distinct from 'OWNER'$a$);execute s;
end $patch$;
