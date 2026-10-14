-- Recover an expired third send as uncertain without sending a duplicate.
do $patch$ declare s text;begin
 s:=pg_get_functiondef('public.icom_bank_agenda_notification_claim()'::regprocedure);
 if position('or r.attempts>=3' in s)=0 then raise exception 'AGENDA_CLAIM_BASE_CHANGED';end if;
 s:=replace(s,'if r.status in(''ACEITO'',''INCERTO'') or r.attempts>=3 then return null;end if;','if r.status in(''ACEITO'',''INCERTO'') then return null;end if;');
 s:=replace(s,'if r.next_attempt_at>clock_timestamp() then return null;end if;','if r.attempts>=3 or r.next_attempt_at>clock_timestamp() then return null;end if;');
 execute s;
 s:=pg_get_functiondef('icom_bank_internal.whatsapp_tick()'::regprocedure);
 if position('or attempts>=3 or status=' in s)=0 then raise exception 'AGENDA_TICK_BASE_CHANGED';end if;
 s:=replace(s,'or attempts>=3 or status=','or attempts>=3 and status<>''ENVIANDO'' or status=');
 execute s;
end $patch$;
notify pgrst,'reload schema';