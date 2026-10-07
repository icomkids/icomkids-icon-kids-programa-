-- Preserve the existing audited/CAS save and bot commit, extending only personal metadata.
do $migration$
declare body text; old text; new text;
begin
 body:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 old:='when ''MENSAL'' then array[''due_day'',''notes'',''payment_method''] else array[''notes'',''payment_method''] end;';
 new:='when ''MENSAL'' then array[''due_day'',''notes'',''payment_method'',''trip_name''] when ''PESSOAL'' then array[''notes'',''payment_method'',''trip_name''] else array[''notes'',''payment_method''] end;';
 if position(old in body)=0 then raise exception 'BANK_PERSONAL_MIGRATION_BASE_CHANGED';end if;
 body:=replace(body,old,new);
 old:=' if coalesce(v_details->>''plate'','''')<>''''';
 new:=' if v_details ? ''trip_name'' then
  if v_scope<>''PESSOAL'' or length(trim(v_details->>''trip_name''))>80 or (v_details->>''trip_name'') ~ ''[[:cntrl:]]'' then raise exception ''BANK_ADMIN_INVALID'';end if;
  v_details:=jsonb_set(v_details,''{trip_name}'',to_jsonb(trim(v_details->>''trip_name'')));
 end if;
 if coalesce(v_details->>''plate'','''')<>''''';
 if position(old in body)=0 then raise exception 'BANK_PERSONAL_MIGRATION_VALIDATION_CHANGED';end if;
 execute replace(body,old,new);
 body:=pg_get_functiondef('public.icom_bank_whatsapp_commit(uuid,uuid,jsonb)'::regprocedure);
 old:='k not in(''notes'',''payment_method'',''stock_id'',''plate'',''vehicle'')';
 new:='k not in(''notes'',''payment_method'',''stock_id'',''plate'',''vehicle'',''trip_name'')';
 if position(old in body)=0 then raise exception 'BANK_PERSONAL_MIGRATION_BOT_CHANGED';end if;
 execute replace(body,old,new);
end $migration$;
