-- Agenda holds commitments only. Bills reuse the existing payables, never a new ledger.
create table public.icom_bank_agenda_events (
 id uuid primary key,owner_id uuid not null default auth.uid() references auth.users(id),
 scope text not null check(scope in('LOJA','PESSOAL')),
 title text not null check(length(btrim(title)) between 2 and 160 and title !~ '[[:cntrl:]]'),
 due_date date not null check(due_date between date '2000-01-01' and date '2100-12-31'),
 due_time text check(due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 notes text not null default '' check(length(notes)<=2000),
 status text not null default 'PENDENTE' check(status in('PENDENTE','CONCLUIDO')),
 origin text not null default 'PAINEL' check(origin in('PAINEL','WHATSAPP','VOICE')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.icom_bank_agenda_events enable row level security;
revoke all on public.icom_bank_agenda_events from public,anon,authenticated;
grant select,insert,update on public.icom_bank_agenda_events to authenticated,service_role;
create policy agenda_events_owner on public.icom_bank_agenda_events for all to authenticated
 using(owner_id=(select auth.uid()) and icom_bank_internal.role()='OWNER')
 with check(owner_id=(select auth.uid()) and icom_bank_internal.role()='OWNER');
create index agenda_events_due on public.icom_bank_agenda_events(owner_id,due_date) where status='PENDENTE';
create function icom_bank_internal.agenda_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.owner_id<>old.owner_id or new.origin<>old.origin or new.created_at<>old.created_at) then raise exception 'BANK_AGENDA_INVALID';end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function icom_bank_internal.agenda_guard() from public,anon,authenticated;
create trigger agenda_event_guard before update on public.icom_bank_agenda_events for each row execute function icom_bank_internal.agenda_guard();
create function public.icom_bank_save_agenda(p_payload jsonb,p_expected timestamptz default null) returns jsonb
language plpgsql set search_path='' as $$
declare actor uuid:=auth.uid();oldrow public.icom_bank_agenda_events;row public.icom_bank_agenda_events;foundrow boolean;begin
 if actor is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>6000 or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('id','scope','title','due_date','due_time','notes','status','origin')) or
 jsonb_typeof(p_payload->'title') is distinct from 'string' or jsonb_typeof(p_payload->'scope') is distinct from 'string' or jsonb_typeof(p_payload->'due_date') is distinct from 'string' or
 p_payload->>'status' not in('PENDENTE','CONCLUIDO') or coalesce(p_payload->>'origin','PAINEL') not in('PAINEL','WHATSAPP','VOICE') then raise exception 'BANK_AGENDA_INVALID';end if;
 select * into oldrow from public.icom_bank_agenda_events where id=(p_payload->>'id')::uuid and owner_id=actor for update;foundrow:=found;
 if foundrow and p_expected is null then
  if oldrow.scope=p_payload->>'scope' and oldrow.title=btrim(p_payload->>'title') and oldrow.due_date=(p_payload->>'due_date')::date and oldrow.due_time is not distinct from nullif(p_payload->>'due_time','') and oldrow.notes=coalesce(p_payload->>'notes','') and oldrow.status=p_payload->>'status' then return to_jsonb(oldrow);end if;
  raise exception 'BANK_AGENDA_STALE';
 end if;
 if foundrow and p_expected is distinct from oldrow.updated_at or not foundrow and p_expected is not null then raise exception 'BANK_AGENDA_STALE';end if;
 if foundrow then
  update public.icom_bank_agenda_events set scope=p_payload->>'scope',title=btrim(p_payload->>'title'),due_date=(p_payload->>'due_date')::date,due_time=nullif(p_payload->>'due_time',''),notes=coalesce(p_payload->>'notes',''),status=p_payload->>'status' where id=oldrow.id and owner_id=actor returning * into row;
 else
  insert into public.icom_bank_agenda_events(id,owner_id,scope,title,due_date,due_time,notes,status,origin)
  values((p_payload->>'id')::uuid,actor,p_payload->>'scope',btrim(p_payload->>'title'),(p_payload->>'due_date')::date,nullif(p_payload->>'due_time',''),coalesce(p_payload->>'notes',''),p_payload->>'status',coalesce(p_payload->>'origin','PAINEL')) returning * into row;
 end if;
 return to_jsonb(row);
end $$;
revoke all on function public.icom_bank_save_agenda(jsonb,timestamptz) from public,anon;
grant execute on function public.icom_bank_save_agenda(jsonb,timestamptz) to authenticated,service_role;

-- Adding the menu cannot change grants or any user's saved relative order.
do $patch$ declare c record;s text;begin
 for c in select conname from pg_constraint where conrelid='public.icom_bank_user_preferences'::regclass and contype='c' and pg_get_constraintdef(oid) like '%menu_order%' loop
 execute format('alter table public.icom_bank_user_preferences drop constraint %I',c.conname);
 end loop;
 alter table public.icom_bank_user_preferences add constraint bank_preferences_menu_order_size check(jsonb_typeof(menu_order)='array' and jsonb_array_length(menu_order)<=13);
 s:=pg_get_functiondef('public.icom_bank_save_preferences(jsonb)'::regprocedure);
 if position('>12' in s)=0 or position('''administrativo'',''parcelas''' in s)=0 then raise exception 'PREFERENCES_BASE_CHANGED';end if;
 s:=replace(s,'>12','>13');s:=replace(s,'''administrativo'',''parcelas''','''administrativo'',''agenda'',''parcelas''');execute s;
 s:=pg_get_functiondef('public.icom_bank_whatsapp_read_rows(uuid,uuid,text)'::regprocedure);
 if position('when ''icom_bank_accounts'' then' in s)=0 then raise exception 'WHATSAPP_READER_BASE_CHANGED';end if;
 s:=replace(s,'when ''icom_bank_accounts'' then','when ''icom_bank_agenda_events'' then ''id,scope,title,due_date,due_time,status,origin,created_at,updated_at'' when ''icom_bank_accounts'' then');
 s:=replace(s,'''icom_bank_accounts'',''icom_bank_prolabore''','''icom_bank_agenda_events'',''icom_bank_accounts'',''icom_bank_prolabore''');execute s;
end $patch$;

create function public.icom_bank_whatsapp_agenda_commit(p_id uuid,p_claim uuid,p_operation text,p_args jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;b public.icom_bank_whatsapp_bot;v jsonb;claims text;sub text;begin
 if current_user<>'service_role' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 select * into m from public.icom_bank_whatsapp_inbox where id=p_id for update;
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO' and owner_id=m.owner_id;
 if m.id is null or b.id is null or m.claim_id is distinct from p_claim or not(m.sender=any(b.allowed_phones)) or
 not exists(select 1 from public.icom_bank_user_access where user_id=m.owner_id and active and role='OWNER') or
 (select count(*) from public.icom_bank_user_access where active and role='OWNER')<>1 then raise exception 'BANK_FORBIDDEN';end if;
 if m.reply not like 'Agenda:%' or coalesce(p_operation,'') not in('AGENDA','CONTA_PAGAR') or
 p_args->'p_payload'->>'id' is distinct from m.id::text or p_args->>'p_expected' is not null then raise exception 'BANK_AGENDA_INVALID';end if;
 if m.status='RESOLVIDO' then return jsonb_build_object('already',true);end if;
 if m.status<>'PROCESSANDO' then raise exception 'BANK_FORBIDDEN';end if;
 if p_operation='AGENDA' and (p_args->'p_payload'->>'status' is distinct from 'PENDENTE' or p_args->'p_payload'->>'origin' is distinct from 'WHATSAPP') then raise exception 'BANK_AGENDA_INVALID';end if;
 claims:=current_setting('request.jwt.claims',true);sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',m.owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',m.owner_id,'role','authenticated')::text,true);
 if p_operation='AGENDA' then v:=public.icom_bank_save_agenda(p_args->'p_payload',null);
 else v:=public.icom_bank_save_expense(p_args->'p_payload',null);end if;
 perform set_config('request.jwt.claims',coalesce(claims,''),true);perform set_config('request.jwt.claim.sub',coalesce(sub,''),true);
 update public.icom_bank_whatsapp_inbox set status='RESOLVIDO',updated_at=clock_timestamp() where id=m.id;
 return jsonb_build_object('row',v,'already',false);
end $$;
revoke all on function public.icom_bank_whatsapp_agenda_commit(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.icom_bank_whatsapp_agenda_commit(uuid,uuid,text,jsonb) to service_role;

create table public.icom_bank_agenda_notifications (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 notification_day date not null,recipient text not null check(recipient ~ '^55[0-9]{10,11}$'),
 content jsonb not null check(jsonb_typeof(content)='object'),status text not null check(status in('ENVIANDO','ACEITO','FALHOU','INCERTO','IGNORADO')),
 claim_id uuid not null default gen_random_uuid(),attempts integer not null default 1 check(attempts between 1 and 3),
 next_attempt_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_id,notification_day)
);
alter table public.icom_bank_agenda_notifications enable row level security;
revoke all on public.icom_bank_agenda_notifications from public,anon,authenticated;
grant select on public.icom_bank_agenda_notifications to authenticated;
grant select,insert,update on public.icom_bank_agenda_notifications to service_role;
create policy agenda_notifications_owner on public.icom_bank_agenda_notifications for select to authenticated
 using(owner_id=(select auth.uid()) and icom_bank_internal.role()='OWNER');

create function icom_bank_internal.agenda_due_content(p_owner uuid,p_day date) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('day',p_day,
 'events_count',(select count(*) from public.icom_bank_agenda_events where owner_id=p_owner and status='PENDENTE' and due_date<=p_day),
 'bills_count',(select count(*) from public.icom_bank_payables p where p.active and p.status='PENDENTE' and p.due_date<=p_day and (p.stock_id is null or exists(select 1 from public.icom_bank_stock_vehicles s where s.id=p.stock_id and s.active and s.status<>'PREVISTO'))),
 'bills_total',(select coalesce(sum(p.amount_cents),0) from public.icom_bank_payables p where p.active and p.status='PENDENTE' and p.due_date<=p_day and (p.stock_id is null or exists(select 1 from public.icom_bank_stock_vehicles s where s.id=p.stock_id and s.active and s.status<>'PREVISTO'))),
 'events',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select id,'COMPROMISSO' as type,scope,title,due_date,due_time,null::bigint as amount_cents,due_date<p_day as overdue from public.icom_bank_agenda_events where owner_id=p_owner and status='PENDENTE' and due_date<=p_day order by due_date,due_time nulls last,id limit 12) x),
 'bills',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select p.id,'PAGAMENTO' as type,p.scope,coalesce(nullif(p.title,''),p.kind) as title,p.due_date,null::text as due_time,p.amount_cents,p.due_date<p_day as overdue from public.icom_bank_payables p where p.active and p.status='PENDENTE' and p.due_date<=p_day and (p.stock_id is null or exists(select 1 from public.icom_bank_stock_vehicles s where s.id=p.stock_id and s.active and s.status<>'PREVISTO')) order by p.due_date,p.id limit 12) x));
$$;
revoke all on function icom_bank_internal.agenda_due_content(uuid,date) from public,anon,authenticated;
grant execute on function icom_bank_internal.agenda_due_content(uuid,date) to service_role;

create function public.icom_bank_agenda_notification_claim() returns jsonb language plpgsql set search_path='' as $$
declare b public.icom_bank_whatsapp_bot;r public.icom_bank_agenda_notifications;c jsonb;day date:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date;hour integer:=extract(hour from clock_timestamp() at time zone 'America/Sao_Paulo');begin
 if current_user<>'service_role' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if hour<8 or hour>=20 then return null;end if;
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO';
 if b.id is null or b.allowed_phones[1] is null or b.allowed_phones[1]=b.phone or
 not exists(select 1 from public.icom_bank_user_access where user_id=b.owner_id and role='OWNER' and active) or
 (select count(*) from public.icom_bank_user_access where role='OWNER' and active)<>1 then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bank-agenda:'||b.owner_id::text||':'||day::text,0));
 select * into r from public.icom_bank_agenda_notifications where owner_id=b.owner_id and notification_day=day for update;
 if found then
  if r.status in('ACEITO','INCERTO') or r.attempts>=3 then return null;end if;
  if r.status='ENVIANDO' then
   if r.updated_at<clock_timestamp()-interval '10 minutes' then update public.icom_bank_agenda_notifications set status='INCERTO',updated_at=clock_timestamp() where id=r.id;end if;
   return null;
  end if;
  if r.next_attempt_at>clock_timestamp() then return null;end if;
 end if;
 c:=icom_bank_internal.agenda_due_content(b.owner_id,day);
 if (c->>'events_count')::integer+(c->>'bills_count')::integer=0 then
  if r.id is not null then update public.icom_bank_agenda_notifications set status='IGNORADO',updated_at=clock_timestamp() where id=r.id;end if;return null;
 end if;
 if r.id is null then
  insert into public.icom_bank_agenda_notifications(owner_id,notification_day,recipient,content,status) values(b.owner_id,day,b.allowed_phones[1],c,'ENVIANDO') returning * into r;
 else
  update public.icom_bank_agenda_notifications set recipient=b.allowed_phones[1],content=c,status='ENVIANDO',claim_id=gen_random_uuid(),attempts=attempts+1,updated_at=clock_timestamp(),next_attempt_at=null where id=r.id returning * into r;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.icom_bank_agenda_notification_claim() from public,anon,authenticated;
grant execute on function public.icom_bank_agenda_notification_claim() to service_role;
create function public.icom_bank_agenda_notification_finish(p_id uuid,p_claim uuid,p_status text) returns void language plpgsql set search_path='' as $$
begin
 if current_user<>'service_role' or p_status not in('ACEITO','FALHOU','INCERTO') then raise exception 'BANK_FORBIDDEN';end if;
 update public.icom_bank_agenda_notifications set status=p_status,next_attempt_at=case when p_status='FALHOU' then clock_timestamp()+interval '10 minutes' else null end,updated_at=clock_timestamp()
 where id=p_id and claim_id=p_claim and status='ENVIANDO';
 if not found then raise exception 'BANK_AGENDA_STALE';end if;
end $$;
revoke all on function public.icom_bank_agenda_notification_finish(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.icom_bank_agenda_notification_finish(uuid,uuid,text) to service_role;

-- Keep the existing single scheduler/secret. Wake it for due reminders even without inbox messages.
create or replace function icom_bank_internal.whatsapp_tick() returns void language plpgsql set search_path='' as $$
declare b public.icom_bank_whatsapp_bot;today date:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date;h integer:=extract(hour from clock_timestamp() at time zone 'America/Sao_Paulo');begin
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO';
 if b.id is null or b.worker_secret is null then return;end if;
 if exists(select 1 from public.icom_bank_whatsapp_inbox where status in('FILA','PROCESSANDO') or reply_status='NAO_ENVIADO' and status in('LANCADO','ESCLARECER','ERRO','RESOLVIDO') and length(reply)>0)
 or h>=8 and h<20 and b.allowed_phones[1] is not null and
 not exists(select 1 from public.icom_bank_agenda_notifications where owner_id=b.owner_id and notification_day=today and (status in('ACEITO','INCERTO') or attempts>=3 or status='ENVIANDO' and updated_at>clock_timestamp()-interval '10 minutes' or next_attempt_at>clock_timestamp())) and
 (exists(select 1 from public.icom_bank_agenda_events where owner_id=b.owner_id and status='PENDENTE' and due_date<=today)
 or exists(select 1 from public.icom_bank_payables p where p.active and p.status='PENDENTE' and p.due_date<=today and (p.stock_id is null or exists(select 1 from public.icom_bank_stock_vehicles s where s.id=p.stock_id and s.active and s.status<>'PREVISTO'))))
 then
  perform net.http_post(url:='https://sistema.icomkids.com.br/experiencia-icom/icom-bank/api/whatsapp/worker',headers:=jsonb_build_object('Content-Type','application/json','X-ICOM-Worker',b.worker_secret),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end $$;
revoke all on function icom_bank_internal.whatsapp_tick() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
