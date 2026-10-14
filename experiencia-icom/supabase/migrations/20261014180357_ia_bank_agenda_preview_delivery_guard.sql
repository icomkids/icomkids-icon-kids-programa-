-- Never approve a preview whose WhatsApp delivery has not been accepted.
do $patch$ declare s text;begin
 s:=pg_get_functiondef('public.icom_bank_whatsapp_agenda_confirm(uuid,uuid,uuid,uuid)'::regprocedure);
 if position('if d.id is null or m.status' in s)=0 then raise exception 'AGENDA_CONFIRM_BASE_CHANGED';end if;
 s:=replace(s,'if d.id is null or m.status',
 'if d.id is null or not exists(select 1 from public.icom_bank_whatsapp_inbox source where source.id=d.id and source.reply_status=''ACEITO'') or m.status');
 execute s;
end $patch$;
notify pgrst,'reload schema';