-- Dedicated bot credentials are server-only. Inbox is visible only to its active OWNER.
create table public.icom_bank_whatsapp_bot(
 id integer primary key check(id=1),owner_id uuid not null references auth.users(id),phone text not null check(phone ~ '^55[0-9]{10,11}$'),
 allowed_phones text[] not null check(cardinality(allowed_phones) between 1 and 10),enabled boolean not null default false,
 status text not null default 'NOVO' check(status in('NOVO','CRIANDO','PRONTO','INCERTO','FALHOU')),claim_id uuid,
 instance_id text,token_cipher text,hook_cipher text not null,worker_secret text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp()
);
alter table public.icom_bank_whatsapp_bot enable row level security;
create index bank_whatsapp_bot_owner on public.icom_bank_whatsapp_bot(owner_id);
revoke all on public.icom_bank_whatsapp_bot from public,anon,authenticated;
grant all on public.icom_bank_whatsapp_bot to service_role;

create table public.icom_bank_whatsapp_inbox(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),provider_id text not null unique check(length(provider_id) between 1 and 180),
 sender text not null check(sender ~ '^55[0-9]{10,11}$'),type text not null check(type in('audio','text')),text text not null default '' check(length(text)<=4000),
 transcript text not null default '' check(length(transcript)<=4000),sent_at timestamptz not null,
 status text not null default 'FILA' check(status in('FILA','PROCESSANDO','LANCADO','ESCLARECER','ERRO','RESOLVIDO')),
 claim_id uuid,attempts integer not null default 0,entry_id uuid references public.icom_bank_admin_entries(id),reply text not null default '' check(length(reply)<=2000),
 reply_status text not null default 'NAO_ENVIADO' check(reply_status in('NAO_ENVIADO','ENVIANDO','ACEITO','FALHOU','INCERTO')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp()
);
create index bank_whatsapp_queue on public.icom_bank_whatsapp_inbox(status,created_at) where status in('FILA','PROCESSANDO');
create index bank_whatsapp_sender on public.icom_bank_whatsapp_inbox(sender,created_at desc);
create index bank_whatsapp_owner on public.icom_bank_whatsapp_inbox(owner_id);
create index bank_whatsapp_entry on public.icom_bank_whatsapp_inbox(entry_id);
alter table public.icom_bank_whatsapp_inbox enable row level security;
revoke all on public.icom_bank_whatsapp_inbox from public,anon,authenticated;
grant all on public.icom_bank_whatsapp_inbox to service_role;
grant select on public.icom_bank_whatsapp_inbox to authenticated;
create policy bank_whatsapp_owner on public.icom_bank_whatsapp_inbox for select to authenticated using(owner_id=(select auth.uid()) and (select icom_bank_internal.role())='OWNER');

create function public.icom_bank_whatsapp_provision_claim(p_owner uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.icom_bank_whatsapp_bot;begin
 select * into b from public.icom_bank_whatsapp_bot where id=1 and owner_id=p_owner for update;
 if not found or not exists(select 1 from public.icom_bank_user_access where user_id=p_owner and active and role='OWNER') then raise exception 'BANK_FORBIDDEN';end if;
 if b.status not in('NOVO','FALHOU') then return jsonb_build_object('acquired',false);end if;
 update public.icom_bank_whatsapp_bot set status='CRIANDO',claim_id=gen_random_uuid(),updated_at=clock_timestamp() where id=1 returning * into b;
 return jsonb_build_object('acquired',true,'claim',b.claim_id);
end $$;

create function public.icom_bank_whatsapp_receive(p_message jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare b public.icom_bank_whatsapp_bot;v_id uuid;begin
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO';
 if not found or not((p_message->>'sender')=any(b.allowed_phones)) or not exists(select 1 from public.icom_bank_user_access where user_id=b.owner_id and active and role='OWNER') then return null;end if;
 if (p_message->>'sent_at')::timestamptz<now()-interval '10 minutes' or (p_message->>'sent_at')::timestamptz>now()+interval '1 minute' then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bank-bot-'||(p_message->>'sender'),0));
 if (select count(*) from public.icom_bank_whatsapp_inbox where sender=p_message->>'sender' and created_at>now()-interval '1 hour')>=60 then return null;end if;
 insert into public.icom_bank_whatsapp_inbox(owner_id,provider_id,sender,type,text,sent_at) values(b.owner_id,p_message->>'provider_id',p_message->>'sender',p_message->>'type',coalesce(p_message->>'text',''),(p_message->>'sent_at')::timestamptz) on conflict(provider_id) do nothing returning id into v_id;
 return v_id;
end $$;

create function public.icom_bank_whatsapp_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;begin
 perform pg_catalog.pg_advisory_xact_lock(48274311);
 update public.icom_bank_whatsapp_inbox set status=case when attempts>=3 then 'ERRO' else 'FILA' end,reply=case when attempts>=3 then 'Não foi possível processar. Confira o histórico e envie novamente.' else reply end where status='PROCESSANDO' and updated_at<now()-interval '5 minutes';
 select i.* into m from public.icom_bank_whatsapp_inbox i join public.icom_bank_whatsapp_bot b on b.id=1 and b.enabled and b.status='PRONTO' and b.owner_id=i.owner_id
 where i.status='FILA' and i.sender=any(b.allowed_phones) and exists(select 1 from public.icom_bank_user_access a where a.user_id=i.owner_id and a.active and a.role='OWNER')
 and not exists(select 1 from public.icom_bank_whatsapp_inbox p where p.sender=i.sender and p.status='PROCESSANDO') order by i.created_at for update of i skip locked limit 1;
 if not found then return null;end if;
 update public.icom_bank_whatsapp_inbox set status='PROCESSANDO',claim_id=gen_random_uuid(),attempts=attempts+1,updated_at=clock_timestamp() where id=m.id returning * into m;return to_jsonb(m);
end $$;

-- Only the trusted server can reach this wrapper. It rechecks the phone and active OWNER,
-- limits the operation to one expense, and uses the existing ledger validation/audit atomically.
create function public.icom_bank_whatsapp_commit(p_id uuid,p_claim uuid,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;b public.icom_bank_whatsapp_bot;v jsonb;previous_claims text;previous_sub text;begin
 select * into m from public.icom_bank_whatsapp_inbox where id=p_id for update;
 if not found then raise exception 'BANK_BOT_MISSING';end if;
 if m.status='LANCADO' then return jsonb_build_object('entry_id',m.entry_id,'already',true);end if;
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO' and owner_id=m.owner_id;
 if not found or m.status<>'PROCESSANDO' or m.claim_id is distinct from p_claim or not(m.sender=any(b.allowed_phones)) or not exists(select 1 from public.icom_bank_user_access where user_id=m.owner_id and active and role='OWNER') then raise exception 'BANK_FORBIDDEN';end if;
 if p_payload->>'id' is distinct from m.id::text or p_payload->>'kind' not in('PESSOAL','CUSTO') or p_payload->>'status' is distinct from 'REALIZADO' or coalesce((p_payload->>'amount_cents')::bigint,0)<=0 or (p_payload->>'entry_date')::date>(now() at time zone 'America/Sao_Paulo')::date or exists(select 1 from jsonb_object_keys(p_payload->'details') k where k not in('notes','payment_method','stock_id','plate','vehicle')) then raise exception 'BANK_BOT_INVALID';end if;
 previous_claims:=current_setting('request.jwt.claims',true);
 previous_sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',m.owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',m.owner_id,'role','authenticated')::text,true);
 v:=public.icom_bank_save_admin_entry(p_payload,null);
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 update public.icom_bank_whatsapp_inbox set status='LANCADO',entry_id=m.id,updated_at=clock_timestamp() where id=m.id;
 update public.icom_bank_whatsapp_inbox set status='RESOLVIDO',updated_at=clock_timestamp() where sender=m.sender and status='ESCLARECER' and created_at<m.created_at and created_at>m.created_at-interval '15 minutes';
 return jsonb_build_object('entry_id',m.id,'already',false);
end $$;
revoke all on function public.icom_bank_whatsapp_provision_claim(uuid),public.icom_bank_whatsapp_receive(jsonb),public.icom_bank_whatsapp_claim(),public.icom_bank_whatsapp_commit(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.icom_bank_whatsapp_provision_claim(uuid),public.icom_bank_whatsapp_receive(jsonb),public.icom_bank_whatsapp_claim(),public.icom_bank_whatsapp_commit(uuid,uuid,jsonb) to service_role;
grant execute on function public.icom_bank_save_admin_entry(jsonb,timestamptz) to service_role;

create function public.icom_bank_whatsapp_reply_claim(p_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 update public.icom_bank_whatsapp_inbox set reply_status='ENVIANDO',updated_at=clock_timestamp() where id=p_id and reply_status='NAO_ENVIADO' and status in('LANCADO','ESCLARECER','ERRO') and length(reply)>0;
 get diagnostics n=row_count;return n=1;
end $$;
revoke all on function public.icom_bank_whatsapp_reply_claim(uuid) from public,anon,authenticated;
grant execute on function public.icom_bank_whatsapp_reply_claim(uuid) to service_role;

-- Persistent recovery after deployments/restarts. No phone, transcript or credentials in cron SQL.
create function icom_bank_internal.whatsapp_tick() returns void language plpgsql security invoker set search_path='' as $$
declare secret text;begin
 select worker_secret into secret from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO';
 if secret is not null and exists(select 1 from public.icom_bank_whatsapp_inbox where status in('FILA','PROCESSANDO') or (reply_status='NAO_ENVIADO' and status in('LANCADO','ESCLARECER','ERRO') and length(reply)>0)) then
  perform net.http_post(url:='https://sistema.icomkids.com.br/experiencia-icom/icom-bank/api/whatsapp/worker',headers:=jsonb_build_object('Content-Type','application/json','X-ICOM-Worker',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end $$;
revoke all on function icom_bank_internal.whatsapp_tick() from public,anon,authenticated,service_role;
select cron.schedule('icom-bank-whatsapp-expenses','* * * * *','select icom_bank_internal.whatsapp_tick();');
notify pgrst,'reload schema';
