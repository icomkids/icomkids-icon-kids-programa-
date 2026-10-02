create table public.experience_warranty_config(id integer primary key check(id=1),version uuid not null default gen_random_uuid(),legal_text text not null,extra_text text not null default '',video_url text not null default '',video_seconds integer not null default 0,updated_at timestamptz not null default now());
create table public.experience_warranty_sessions(id uuid primary key default gen_random_uuid(),experience_id uuid not null references public.customer_experiences(id),version uuid not null,legal_text text not null,extra_text text not null,video_url text not null,video_seconds integer not null,watched_seconds numeric not null default 0,last_seen_at timestamptz not null default now(),started_at timestamptz not null default now(),acknowledged_at timestamptz,outcome text check(outcome in ('understood','questions')),user_agent text not null default '',unique(experience_id,version));
create table public.experience_warranty_events(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.experience_warranty_sessions(id),event_type text not null,watched_seconds numeric not null default 0,created_at timestamptz not null default now());
create table public.experience_referrals(id uuid primary key default gen_random_uuid(),experience_id uuid unique not null references public.customer_experiences(id),name text not null,phone text not null,permission_confirmed boolean not null check(permission_confirmed),created_at timestamptz not null default now());
create table public.experience_referral_reminders(id uuid primary key default gen_random_uuid(),experience_id uuid unique not null references public.customer_experiences(id),due_at timestamptz not null default now()+interval '24 hours',expires_at timestamptz not null default now()+interval '7 days',status text not null default 'pending' check(status in ('pending','sending','accepted','failed','unknown','cancelled','expired')),attempted_at timestamptz,accepted_at timestamptz,provider_id text);
alter table public.experience_warranty_config enable row level security;
alter table public.experience_warranty_sessions enable row level security;
alter table public.experience_warranty_events enable row level security;
alter table public.experience_referrals enable row level security;
alter table public.experience_referral_reminders enable row level security;
revoke all on public.experience_warranty_config,public.experience_warranty_sessions,public.experience_warranty_events,public.experience_referrals,public.experience_referral_reminders from anon,authenticated;
grant all on public.experience_warranty_config,public.experience_warranty_sessions,public.experience_warranty_events,public.experience_referrals,public.experience_referral_reminders to service_role;
insert into public.experience_warranty_config(id,legal_text) values(1,'Garantia legal do veículo

O Código de Defesa do Consumidor prevê 90 dias para reclamar de vícios aparentes ou de fácil constatação em produtos duráveis, a partir da entrega efetiva. Para vícios ocultos, o prazo começa quando o problema se torna evidente (art. 26).

A garantia legal independe de documento específico e não pode ser afastada por contrato (art. 24). Em veículo vendido por fornecedor, ela não se limita apenas ao motor e ao câmbio. Desgaste natural, conservação e eventual uso inadequado precisam ser avaliados no caso concreto; não existe exclusão automática de toda uma peça ou sistema.

Em regra, não sendo sanado o vício em até 30 dias, o consumidor pode escolher as alternativas previstas no art. 18, observadas as hipóteses e exceções legais. Uma garantia contratual adicional deve constar de termo escrito e complementa a legal (art. 50).

Ao perceber um problema, comunique a Icom, descreva os sintomas e guarde os registros. Em situação que comprometa a segurança, interrompa o uso do veículo.

Sua confirmação registra o acesso às orientações. Ela não limita a garantia, não impede reclamações futuras e não representa renúncia aos direitos previstos no CDC.');

create function public.experience_warranty_settings(p_actor uuid,p_video text,p_seconds integer,p_extra text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.experience_users where id=p_actor and active and role in ('owner','admin')) then raise exception 'Unauthorized'; end if;
 if p_video is null or p_extra is null or length(p_extra)>4000 or (p_video<>'' and (p_video !~ '^https://[^[:space:]]+\.mp4(\?[^[:space:]]*)?$' or p_seconds not between 10 and 1200)) then raise exception 'Invalid video'; end if;
 update public.experience_warranty_config set video_url=p_video,video_seconds=case when p_video='' then 0 else p_seconds end,extra_text=p_extra,version=gen_random_uuid(),updated_at=now() where id=1 and (video_url<>p_video or video_seconds<>case when p_video='' then 0 else p_seconds end or extra_text<>p_extra);
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_actor,'warranty_settings_updated','1');
end $$;

create function public.experience_warranty_start(p_token uuid,p_agent text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences; cfg public.experience_warranty_config; s public.experience_warranty_sessions;
begin
 select * into e from public.customer_experiences where token=p_token for share;
 if e.id is null or e.status='arquivada' or (e.expires_at is not null and e.expires_at<now()) then raise exception 'Experience unavailable'; end if;
 select * into cfg from public.experience_warranty_config where id=1 for share;
 if e.completed_at is not null then select * into s from public.experience_warranty_sessions where experience_id=e.id and acknowledged_at is not null order by acknowledged_at desc limit 1; return case when s.id is null then null else to_jsonb(s) end; end if;
 insert into public.experience_warranty_sessions(experience_id,version,legal_text,extra_text,video_url,video_seconds,user_agent) values(e.id,cfg.version,cfg.legal_text,cfg.extra_text,cfg.video_url,cfg.video_seconds,left(coalesce(p_agent,''),512)) on conflict(experience_id,version) do nothing;
 select * into s from public.experience_warranty_sessions where experience_id=e.id and version=cfg.version;
 if not exists(select 1 from public.experience_warranty_events where session_id=s.id) then insert into public.experience_warranty_events(session_id,event_type) values(s.id,'opened'); end if;
 return to_jsonb(s);
end $$;

create function public.experience_warranty_progress(p_token uuid,p_session uuid,p_position numeric) returns numeric language plpgsql security invoker set search_path='' as $$
declare s public.experience_warranty_sessions; elapsed numeric; delta numeric;
begin
 select ws.* into s from public.experience_warranty_sessions ws join public.customer_experiences e on e.id=ws.experience_id where ws.id=p_session and e.token=p_token and e.completed_at is null and e.status<>'arquivada' and (e.expires_at is null or e.expires_at>now()) for update of ws;
 if s.id is null or s.version<>(select version from public.experience_warranty_config where id=1) then raise exception 'Warranty unavailable'; end if;
 if s.acknowledged_at is not null then return s.watched_seconds; end if;
 if p_position is null or p_position<0 or p_position>s.video_seconds+1 then raise exception 'Invalid playback'; end if;
 elapsed:=greatest(0,extract(epoch from clock_timestamp()-s.last_seen_at));
 delta:=greatest(0,p_position-s.watched_seconds);
 -- Reject jumps. Server time caps credit; replaying an earlier interval earns no extra credit.
 if delta>least(elapsed,10)+1.5 then raise exception 'Playback skipped'; end if;
 delta:=least(delta,elapsed,10);
 update public.experience_warranty_sessions set watched_seconds=least(video_seconds,watched_seconds+delta),last_seen_at=clock_timestamp() where id=s.id returning * into s;
 insert into public.experience_warranty_events(session_id,event_type,watched_seconds) values(s.id,'playback_progress',s.watched_seconds);
 return s.watched_seconds;
end $$;

create function public.experience_warranty_ack(p_token uuid,p_session uuid,p_outcome text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.experience_warranty_sessions;
begin
 select ws.* into s from public.experience_warranty_sessions ws join public.customer_experiences e on e.id=ws.experience_id where ws.id=p_session and e.token=p_token and e.completed_at is null and e.status<>'arquivada' and (e.expires_at is null or e.expires_at>now()) for update of ws;
 if s.id is null or s.version<>(select version from public.experience_warranty_config where id=1) then raise exception 'Warranty unavailable'; end if;
 if p_outcome is null or p_outcome not in ('understood','questions') then raise exception 'Invalid confirmation'; end if;
 if s.video_url<>'' and s.watched_seconds<greatest(0,s.video_seconds-1) then raise exception 'Finish the warranty video'; end if;
 if s.acknowledged_at is null then update public.experience_warranty_sessions set acknowledged_at=clock_timestamp(),outcome=p_outcome where id=s.id returning * into s; insert into public.experience_warranty_events(session_id,event_type,watched_seconds) values(s.id,'acknowledged_'||p_outcome,s.watched_seconds); end if;
 return to_jsonb(s);
end $$;

create function public.experience_referral_add(p_token uuid,p_name text,p_phone text,p_permission boolean) returns void language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences;
begin
 select * into e from public.customer_experiences where token=p_token for update;
 if e.id is null or e.completed_at is null or e.status='arquivada' or (e.expires_at is not null and e.expires_at<now()) then raise exception 'Experience unavailable'; end if;
 if not exists(select 1 from public.experience_responses where experience_id=e.id and answers->>'referral_choice' in ('Sim, indicar agora','Sim, mais tarde')) then raise exception 'Referral not requested'; end if;
 if p_permission is distinct from true or length(trim(p_name)) not between 2 and 120 or p_phone !~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' then raise exception 'Invalid referral'; end if;
 insert into public.experience_referrals(experience_id,name,phone,permission_confirmed) values(e.id,trim(p_name),p_phone,true) on conflict(experience_id) do nothing;
 update public.experience_referral_reminders set status='cancelled' where experience_id=e.id and status='pending';
end $$;

create function public.experience_save_with_warranty(p_token uuid,p_answers jsonb,p_complete boolean,p_nps integer,p_category text,p_alert text,p_reason text) returns void language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences; cfg public.experience_warranty_config; s public.experience_warranty_sessions;
begin
 select * into e from public.customer_experiences where token=p_token for update;
 select * into cfg from public.experience_warranty_config where id=1 for share;
 if p_complete then
  select * into s from public.experience_warranty_sessions where experience_id=e.id and version=cfg.version and acknowledged_at is not null;
  if s.id is null then raise exception 'Warranty confirmation required'; end if;
  if s.outcome='questions' then p_alert:='critical'; p_reason:=concat_ws('; ',nullif(p_reason,''),'Cliente tem dúvidas sobre a garantia'); end if;
  if p_answers->>'referral_choice'='Sim, indicar agora' and (length(trim(coalesce(p_answers->>'referral_name','')))<2 or coalesce(p_answers->>'referral_phone','') !~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' or p_answers->>'referral_permission' is distinct from 'Sim, a pessoa autorizou o contato') then raise exception 'Invalid referral'; end if;
 end if;
 perform public.experience_save(p_token,p_answers,p_complete,p_nps,p_category,p_alert,p_reason);
 if p_complete and p_answers->>'referral_choice'='Sim, indicar agora' then perform public.experience_referral_add(p_token,p_answers->>'referral_name',p_answers->>'referral_phone',true); end if;
 if p_complete and p_answers->>'referral_choice'='Sim, mais tarde' and p_answers->>'referral_reminder'='Sim, pode me lembrar pelo WhatsApp' and not e.is_demo and not exists(select 1 from public.experience_referrals where experience_id=e.id) then insert into public.experience_referral_reminders(experience_id) values(e.id) on conflict(experience_id) do nothing; end if;
end $$;
revoke all on function public.experience_warranty_settings(uuid,text,integer,text),public.experience_warranty_start(uuid,text),public.experience_warranty_progress(uuid,uuid,numeric),public.experience_warranty_ack(uuid,uuid,text),public.experience_referral_add(uuid,text,text,boolean),public.experience_save_with_warranty(uuid,jsonb,boolean,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.experience_warranty_settings(uuid,text,integer,text),public.experience_warranty_start(uuid,text),public.experience_warranty_progress(uuid,uuid,numeric),public.experience_warranty_ack(uuid,uuid,text),public.experience_referral_add(uuid,text,text,boolean),public.experience_save_with_warranty(uuid,jsonb,boolean,integer,text,text,text) to service_role;
