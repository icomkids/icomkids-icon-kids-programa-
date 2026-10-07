-- Extend personal classifications through the existing audited owner-only save.
do $migration$
declare body text; old text; new text;
begin
 body:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 old:='''payment_method'',''trip_name'']';
 new:='''payment_method'',''trip_name'',''expense_audience'',''expense_nature'']';
 if position(old in body)=0 then raise exception 'BANK_CONTEXT_MIGRATION_BASE_CHANGED';end if;
 body:=replace(body,old,new);
 old:=' if v_details ? ''trip_name'' then';
 new:=' if v_details ? ''expense_audience'' then
  if v_scope<>''PESSOAL'' or coalesce(v_details->>''expense_audience'','''') not in(''FAMILIA'',''INDIVIDUAL'',''NAO_INFORMADO'') then raise exception ''BANK_ADMIN_INVALID'';end if;
 end if;
 if v_details ? ''expense_nature'' then
  if v_scope<>''PESSOAL'' or coalesce(v_details->>''expense_nature'','''') not in(''ESSENCIAL'',''OPCIONAL'',''NAO_CLASSIFICADO'') then raise exception ''BANK_ADMIN_INVALID'';end if;
 end if;
 if v_details ? ''trip_name'' then';
 if position(old in body)=0 then raise exception 'BANK_CONTEXT_VALIDATION_CHANGED';end if;
 execute replace(body,old,new);
 body:=pg_get_functiondef('public.icom_bank_whatsapp_commit(uuid,uuid,jsonb)'::regprocedure);
 old:='''vehicle'',''trip_name'')';
 new:='''vehicle'',''trip_name'',''expense_audience'',''expense_nature'')';
 if position(old in body)=0 then raise exception 'BANK_CONTEXT_BOT_CHANGED';end if;
 execute replace(body,old,new);
end $migration$;
