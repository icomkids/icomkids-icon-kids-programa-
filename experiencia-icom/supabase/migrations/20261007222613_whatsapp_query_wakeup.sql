-- Wake the worker for pending replies to completed read-only queries too.
do $migration$
declare body text;
begin
 body:=pg_get_functiondef('icom_bank_internal.whatsapp_tick()'::regprocedure);
 if position('status in(''LANCADO'',''ESCLARECER'',''ERRO'')' in body)=0 then raise exception 'BANK_TICK_MIGRATION_BASE_CHANGED';end if;
 execute replace(body,'status in(''LANCADO'',''ESCLARECER'',''ERRO'')','status in(''LANCADO'',''ESCLARECER'',''ERRO'',''RESOLVIDO'')');
end $migration$;
