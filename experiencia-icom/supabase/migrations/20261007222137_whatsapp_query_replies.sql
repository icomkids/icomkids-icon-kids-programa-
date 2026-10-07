-- Resolved read-only queries also need an acknowledgement; keep the delivery claim atomic.
do $migration$
declare body text;
begin
 body:=pg_get_functiondef('public.icom_bank_whatsapp_reply_claim(uuid)'::regprocedure);
 if position('status in(''LANCADO'',''ESCLARECER'',''ERRO'')' in body)=0 then raise exception 'BANK_REPLY_MIGRATION_BASE_CHANGED';end if;
 execute replace(body,'status in(''LANCADO'',''ESCLARECER'',''ERRO'')','status in(''LANCADO'',''ESCLARECER'',''ERRO'',''RESOLVIDO'')');
end $migration$;

