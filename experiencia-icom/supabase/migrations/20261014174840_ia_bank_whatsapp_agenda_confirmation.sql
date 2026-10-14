
-- Pending WhatsApp previews are private and do not create events, bills or cash entries.
create table icom_bank_internal.whatsapp_agenda_drafts(
 id uuid primary key references public.icom_bank_whatsapp_inbox(id),
 owner_id uuid not null references auth.users(id),sender text not null,
 operation text not null check(operation in('AGENDA','CONTA_PAGAR')),
 args jsonb not null check(jsonb_typeof(args)='object'),summary jsonb not null check(jsonb_typeof(summary)='array' and jsonb_array_length(summary)<=15),
 source text not null check(length(source) between 1 and 12000),
 status text not null check(status in('PENDENTE','EDITANDO','CONFIRMADO','SUBSTITUIDO','CANCELADO','EXPIRADO')),
 version uuid not null default gen_random_uuid(),confirmed_message_id uuid unique references public.icom_bank_whatsapp_inbox(id),
 expires_at timestamptz not null default (clock_timestamp()+interval '30 minutes'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table icom_bank_internal.whatsapp_agenda_drafts enable row level security;
revoke all on icom_bank_internal.whatsapp_agenda_drafts from public,anon,authenticated;
grant select,insert,update on icom_bank_internal.whatsapp_agenda_drafts to service_role;
create unique index whatsapp_agenda_one_pending on icom_bank_internal.whatsapp_agenda_drafts(owner_id,sender) where status in('PENDENTE','EDITANDO');

create function icom_bank_internal.agenda_message(p_id uuid,p_claim uuid) returns public.icom_bank_whatsapp_inbox language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;b public.icom_bank_whatsapp_bot;begin
 if current_user<>'service_role' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 select * into m from public.icom_bank_whatsapp_inbox where id=p_id for update;
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO' and owner_id=m.owner_id;
 if m.id is null or b.id is null or m.claim_id is distinct from p_claim or not(m.sender=any(b.allowed_phones)) or m.status not in('PROCESSANDO','RESOLVIDO') or
 not exists(select 1 from public.icom_bank_user_access where user_id=m.owner_id and active and role='OWNER') or
 (select count(*) from public.icom_bank_user_access where active and role='OWNER')<>1 then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('agenda-preview:'||m.owner_id::text||':'||m.sender,0));return m;
end $$;
revoke all on function icom_bank_internal.agenda_message(uuid,uuid) from public,anon,authenticated;
grant execute on function icom_bank_internal.agenda_message(uuid,uuid) to service_role;

create function public.icom_bank_whatsapp_agenda_draft(p_id uuid,p_claim uuid) returns jsonb language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;d icom_bank_internal.whatsapp_agenda_drafts;begin
 m:=icom_bank_internal.agenda_message(p_id,p_claim);
 update icom_bank_internal.whatsapp_agenda_drafts set status='EXPIRADO',updated_at=clock_timestamp() where owner_id=m.owner_id and sender=m.sender and status in('PENDENTE','EDITANDO') and expires_at<=clock_timestamp();
 select * into d from icom_bank_internal.whatsapp_agenda_drafts where owner_id=m.owner_id and sender=m.sender and status in('PENDENTE','EDITANDO') and created_at<=m.created_at order by created_at desc limit 1;
 if d.id is null then return null;end if;return to_jsonb(d);
end $$;

create function public.icom_bank_whatsapp_agenda_prepare(p_id uuid,p_claim uuid,p_operation text,p_args jsonb,p_summary jsonb,p_source text) returns jsonb language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;d icom_bank_internal.whatsapp_agenda_drafts;begin
 m:=icom_bank_internal.agenda_message(p_id,p_claim);
 select * into d from icom_bank_internal.whatsapp_agenda_drafts where id=m.id;
 if d.id is not null then return to_jsonb(d);end if;
 if m.status<>'PROCESSANDO' or m.reply not like 'Agenda: Confira%' or coalesce(p_operation,'') not in('AGENDA','CONTA_PAGAR') or
 p_args->'p_payload'->>'id' is distinct from m.id::text or p_args->>'p_expected' is not null or jsonb_typeof(p_summary) is distinct from 'array' then raise exception 'BANK_AGENDA_INVALID';end if;
 if p_operation='AGENDA' and (p_args->'p_payload'->>'status' is distinct from 'PENDENTE' or p_args->'p_payload'->>'origin' is distinct from 'WHATSAPP') then raise exception 'BANK_AGENDA_INVALID';end if;
 if exists(select 1 from icom_bank_internal.whatsapp_agenda_drafts where owner_id=m.owner_id and sender=m.sender and status in('PENDENTE','EDITANDO') and created_at>m.created_at) then raise exception 'BANK_AGENDA_STALE';end if;
 update icom_bank_internal.whatsapp_agenda_drafts set status='SUBSTITUIDO',updated_at=clock_timestamp() where owner_id=m.owner_id and sender=m.sender and status in('PENDENTE','EDITANDO');
 insert into icom_bank_internal.whatsapp_agenda_drafts(id,owner_id,sender,operation,args,summary,source,status,created_at)
 values(m.id,m.owner_id,m.sender,p_operation,p_args,p_summary,p_source,'PENDENTE',m.created_at) returning * into d;
 update public.icom_bank_whatsapp_inbox set status='RESOLVIDO',updated_at=clock_timestamp() where id=m.id;return to_jsonb(d);
end $$;

create function public.icom_bank_whatsapp_agenda_edit(p_id uuid,p_claim uuid,p_draft uuid,p_version uuid,p_cancel boolean default false,p_finish_message boolean default true) returns jsonb language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;d icom_bank_internal.whatsapp_agenda_drafts;begin
 m:=icom_bank_internal.agenda_message(p_id,p_claim);
 select * into d from icom_bank_internal.whatsapp_agenda_drafts where id=p_draft and owner_id=m.owner_id and sender=m.sender for update;
 if d.id is null or d.version is distinct from p_version or d.status not in('PENDENTE','EDITANDO') or d.expires_at<=clock_timestamp() or d.created_at>=m.created_at then raise exception 'BANK_AGENDA_STALE';end if;
 update icom_bank_internal.whatsapp_agenda_drafts set status=case when p_cancel then 'CANCELADO' else 'EDITANDO' end,version=gen_random_uuid(),updated_at=clock_timestamp() where id=d.id returning * into d;
 if p_finish_message then update public.icom_bank_whatsapp_inbox set status='RESOLVIDO',updated_at=clock_timestamp() where id=m.id;end if;return to_jsonb(d);
end $$;

-- The existing commit now requires an approval made by the confirmation function below.
do $patch$ declare s text;begin
 s:=pg_get_functiondef('public.icom_bank_whatsapp_agenda_commit(uuid,uuid,text,jsonb)'::regprocedure);
 if position('if m.reply not like ''Agenda:%''' in s)=0 then raise exception 'AGENDA_COMMIT_BASE_CHANGED';end if;
 s:=replace(s,'if m.reply not like ''Agenda:%''',
 'if not exists(select 1 from icom_bank_internal.whatsapp_agenda_drafts d where d.owner_id=m.owner_id and d.sender=m.sender and d.status=''CONFIRMADO'' and d.confirmed_message_id=m.id and d.operation=p_operation and d.args=p_args) then raise exception ''BANK_AGENDA_CONFIRMATION_REQUIRED'';end if;
 if m.reply not like ''Agenda:%''');
 execute s;
end $patch$;

create function public.icom_bank_whatsapp_agenda_confirm(p_id uuid,p_claim uuid,p_draft uuid,p_version uuid) returns jsonb language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;d icom_bank_internal.whatsapp_agenda_drafts;v_args jsonb;result jsonb;begin
 m:=icom_bank_internal.agenda_message(p_id,p_claim);
 select * into d from icom_bank_internal.whatsapp_agenda_drafts where id=p_draft and owner_id=m.owner_id and sender=m.sender for update;
 if d.status='CONFIRMADO' and d.confirmed_message_id=m.id then return jsonb_build_object('already',true);end if;
 if d.id is null or m.status<>'PROCESSANDO' or d.version is distinct from p_version or d.status<>'PENDENTE' or d.expires_at<=clock_timestamp() or d.created_at>=m.created_at or
 lower(btrim(coalesce(nullif(m.transcript,''),m.text))) !~ '^(1|confirmo|confirmar|confirma|confirmado|sim|pode confirmar)[[:space:].!]*$' then raise exception 'BANK_AGENDA_CONFIRMATION_REQUIRED';end if;
 v_args:=jsonb_set(d.args,'{p_payload,id}',to_jsonb(m.id::text));
 update icom_bank_internal.whatsapp_agenda_drafts set status='CONFIRMADO',args=v_args,confirmed_message_id=m.id,updated_at=clock_timestamp() where id=d.id;
 result:=public.icom_bank_whatsapp_agenda_commit(m.id,p_claim,d.operation,v_args);return result;
end $$;
revoke all on function public.icom_bank_whatsapp_agenda_draft(uuid,uuid),public.icom_bank_whatsapp_agenda_prepare(uuid,uuid,text,jsonb,jsonb,text),public.icom_bank_whatsapp_agenda_edit(uuid,uuid,uuid,uuid,boolean,boolean),public.icom_bank_whatsapp_agenda_confirm(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.icom_bank_whatsapp_agenda_draft(uuid,uuid),public.icom_bank_whatsapp_agenda_prepare(uuid,uuid,text,jsonb,jsonb,text),public.icom_bank_whatsapp_agenda_edit(uuid,uuid,uuid,uuid,boolean,boolean),public.icom_bank_whatsapp_agenda_confirm(uuid,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
