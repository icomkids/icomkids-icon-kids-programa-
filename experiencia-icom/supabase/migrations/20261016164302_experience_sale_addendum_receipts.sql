begin;
create table public.experience_sale_addenda(
 id uuid primary key default gen_random_uuid(),
 experience_id uuid not null unique references public.customer_experiences(id),
 created_by uuid not null references public.experience_users(id),
 has_discount boolean not null,
 original_price_cents bigint,
 final_price_cents bigint,
 discount_cents bigint generated always as (coalesce(original_price_cents-final_price_cents,0)) stored,
 details text not null default '' check(length(details)<=4000),
 contract_reference text not null default '' check(length(contract_reference)<=120),
 notice_text text not null default 'O abatimento registra a condição comercial e os itens expressamente descritos neste adendo. A garantia legal do veículo permanece assegurada, inclusive quanto a vícios ocultos, conforme o Código de Defesa do Consumidor. Esta ciência não representa renúncia de direitos nem exclusão automática de peças ou sistemas da garantia.',
 version integer not null default 1 check(version=1),
 created_at timestamptz not null default now(),
 check((has_discount and original_price_cents is not null and final_price_cents is not null and original_price_cents between 1 and 10000000000 and final_price_cents between 1 and 10000000000 and final_price_cents<original_price_cents) or (not has_discount and original_price_cents is null and final_price_cents is null))
);
create table public.experience_addendum_receipts(
 id uuid primary key default gen_random_uuid(),
 addendum_id uuid not null unique references public.experience_sale_addenda(id),
 outcome text not null check(outcome in ('agreed','questions')),
 acknowledgement_text text not null,
 recorded_at timestamptz not null default clock_timestamp(),
 user_agent text not null default '' check(length(user_agent)<=512)
);
alter table public.experience_sale_addenda enable row level security;
alter table public.experience_addendum_receipts enable row level security;
revoke all on public.experience_sale_addenda,public.experience_addendum_receipts from public,anon,authenticated,service_role;
grant select,insert on public.experience_sale_addenda,public.experience_addendum_receipts to service_role;

create function public.experience_addendum_terms(p_terms jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare original bigint; final bigint; discounted boolean; details text; reference text;
begin
 if p_terms is null or jsonb_typeof(p_terms)<>'object' or jsonb_typeof(p_terms->'has_discount') is distinct from 'boolean' or jsonb_typeof(p_terms->'details') is distinct from 'string' or jsonb_typeof(p_terms->'contract_reference') is distinct from 'string' then raise exception 'Informe o desconto e as observações antes de enviar o link'; end if;
 discounted:=(p_terms->>'has_discount')::boolean;details:=btrim(p_terms->>'details');reference:=btrim(p_terms->>'contract_reference');
 if length(details)>4000 or length(reference)>120 then raise exception 'Observações do adendo excedem o limite'; end if;
 if discounted then
  if coalesce(p_terms->>'original_price_cents','') !~ '^[0-9]{1,11}$' or coalesce(p_terms->>'final_price_cents','') !~ '^[0-9]{1,11}$' then raise exception 'Valores do adendo inválidos'; end if;
  original:=(p_terms->>'original_price_cents')::bigint;final:=(p_terms->>'final_price_cents')::bigint;
  if original not between 1 and 10000000000 or final not between 1 and 10000000000 or final>=original then raise exception 'O preço final deve ser menor que o preço original'; end if;
 end if;
 return jsonb_build_object('has_discount',discounted,'original_price_cents',original,'final_price_cents',final,'discount_cents',coalesce(original-final,0),'details',details,'contract_reference',reference);
end $$;

create function public.experience_addendum_attach(p_experience uuid,p_actor uuid,p_terms jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences; a public.experience_sale_addenda; terms jsonb;
begin
 terms:=public.experience_addendum_terms(p_terms);
 select * into e from public.customer_experiences where id=p_experience for update;
 if e.id is null or not exists(select 1 from public.experience_users u where u.id=p_actor and u.active and (u.role in ('owner','admin','manager') or (u.role='seller' and u.salesperson_id=e.salesperson_id))) then raise exception 'Unauthorized'; end if;
 select * into a from public.experience_sale_addenda where experience_id=e.id;
 if a.id is not null then
  if jsonb_build_object('has_discount',a.has_discount,'original_price_cents',a.original_price_cents,'final_price_cents',a.final_price_cents,'discount_cents',a.discount_cents,'details',a.details,'contract_reference',a.contract_reference)<>terms then raise exception 'Este atendimento já foi registrado com outro adendo. A versão enviada foi preservada'; end if;
  return;
 end if;
 if e.sent_at is not null or e.completed_at is not null or e.status<>'criada' then raise exception 'O adendo precisa ser registrado antes do envio do link'; end if;
 insert into public.experience_sale_addenda(experience_id,created_by,has_discount,original_price_cents,final_price_cents,details,contract_reference) values(e.id,p_actor,(terms->>'has_discount')::boolean,(terms->>'original_price_cents')::bigint,(terms->>'final_price_cents')::bigint,terms->>'details',terms->>'contract_reference');
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_actor,'sale_addendum_registered',e.id::text);
end $$;

create function public.experience_seller_create_with_addendum(p_user uuid,p_customer text,p_vehicle text,p_plate text,p_request uuid,p_phone text,p_due timestamptz,p_purchase date,p_terms jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_token uuid; experience uuid;
begin
 perform public.experience_addendum_terms(p_terms);
 v_token:=public.experience_seller_create_sale(p_user,p_customer,p_vehicle,p_plate,p_request,p_phone,p_due,p_purchase);
 select id into experience from public.customer_experiences e where e.token=v_token;
 perform public.experience_addendum_attach(experience,p_user,p_terms);
 return v_token;
end $$;

create function public.experience_create_with_addendum(p_customer uuid,p_seller uuid,p_vehicle uuid,p_purchase date,p_delivery date,p_payment text,p_trade boolean,p_demo boolean,p_user uuid,p_terms jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_token uuid; experience uuid;
begin
 perform public.experience_addendum_terms(p_terms);
 v_token:=public.experience_create(p_customer,p_seller,p_vehicle,p_purchase,p_delivery,p_payment,p_trade,p_demo,p_user);
 select id into experience from public.customer_experiences e where e.token=v_token;
 perform public.experience_addendum_attach(experience,p_user,p_terms);
 return v_token;
end $$;

create function public.experience_addendum_ack(p_token uuid,p_addendum uuid,p_outcome text,p_read boolean,p_agent text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences; a public.experience_sale_addenda; receipt public.experience_addendum_receipts; alert uuid;
begin
 select * into e from public.customer_experiences ce where ce.token=p_token for update;
 if e.id is null or e.status='arquivada' or e.completed_at is not null or (e.expires_at is not null and e.expires_at<now()) then raise exception 'Experiência indisponível'; end if;
 select * into a from public.experience_sale_addenda where id=p_addendum and experience_id=e.id;
 if a.id is null or (not a.has_discount and a.details='') then raise exception 'Adendo indisponível. Atualize a página'; end if;
 if p_read is distinct from true or p_outcome is null or p_outcome not in ('agreed','questions') then raise exception 'Leia o adendo e selecione sua resposta'; end if;
 select * into receipt from public.experience_addendum_receipts where addendum_id=a.id;
 if receipt.id is not null then
  if receipt.outcome<>p_outcome then raise exception 'A ciência desta versão já está registrada. Entre em contato com a Icom para esclarecer dúvidas'; end if;
  return to_jsonb(receipt)-'user_agent';
 end if;
 insert into public.experience_addendum_receipts(addendum_id,outcome,acknowledgement_text,user_agent) values(a.id,p_outcome,case when p_outcome='agreed' then 'Li os valores e as observações deste adendo e estou de acordo com o registro apresentado, sem renúncia aos meus direitos.' else 'Li o adendo e tenho dúvidas que precisam ser esclarecidas pela Icom.' end,left(coalesce(p_agent,''),512)) returning * into receipt;
 insert into public.experience_audit_logs(action,entity_id) values('customer_addendum_'||p_outcome,a.id::text);
 if p_outcome='questions' then
  insert into public.experience_alerts(experience_id,alert_level,alert_reason) values(e.id,'critical','Cliente tem dúvidas sobre o adendo da venda') on conflict(experience_id) do update set alert_level='critical',alert_reason=concat_ws('; ',public.experience_alerts.alert_reason,'Cliente tem dúvidas sobre o adendo da venda'),resolution_status='Novo',resolved_at=null,updated_at=now() returning id into alert;
  insert into public.experience_alert_events(alert_id,event_type,description) values(alert,'sale_addendum_questions','Cliente solicitou esclarecimentos sobre os valores ou observações do adendo.');
 end if;
 return to_jsonb(receipt)-'user_agent';
end $$;

revoke all on function public.experience_addendum_terms(jsonb),public.experience_addendum_attach(uuid,uuid,jsonb),public.experience_seller_create_with_addendum(uuid,text,text,text,uuid,text,timestamptz,date,jsonb),public.experience_create_with_addendum(uuid,uuid,uuid,date,date,text,boolean,boolean,uuid,jsonb),public.experience_addendum_ack(uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.experience_addendum_terms(jsonb),public.experience_addendum_attach(uuid,uuid,jsonb),public.experience_seller_create_with_addendum(uuid,text,text,text,uuid,text,timestamptz,date,jsonb),public.experience_create_with_addendum(uuid,uuid,uuid,date,date,text,boolean,boolean,uuid,jsonb),public.experience_addendum_ack(uuid,uuid,text,boolean,text) to service_role;

create or replace function public.experience_warranty_ack(p_token uuid,p_session uuid,p_outcome text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.experience_warranty_sessions;
begin
 select ws.* into s from public.experience_warranty_sessions ws join public.customer_experiences e on e.id=ws.experience_id where ws.id=p_session and e.token=p_token and e.completed_at is null and e.status<>'arquivada' and (e.expires_at is null or e.expires_at>now()) for update of ws;
 if s.id is null or s.version<>(select version from public.experience_warranty_config where id=1) then raise exception 'Warranty unavailable'; end if;

 if exists(select 1 from public.experience_sale_addenda a where a.experience_id=s.experience_id and (a.has_discount or a.details<>'') and not exists(select 1 from public.experience_addendum_receipts r where r.addendum_id=a.id)) then raise exception 'Registre a ciência ou suas dúvidas sobre o adendo antes de continuar'; end if;
 if p_outcome is null or p_outcome not in ('understood','questions') then raise exception 'Invalid confirmation'; end if;
 if s.video_url<>'' and s.watched_seconds<greatest(0,s.video_seconds-1) then raise exception 'Finish the warranty video'; end if;
 if s.acknowledged_at is null then update public.experience_warranty_sessions set acknowledged_at=clock_timestamp(),outcome=p_outcome where id=s.id returning * into s; insert into public.experience_warranty_events(session_id,event_type,watched_seconds) values(s.id,'acknowledged_'||p_outcome,s.watched_seconds); end if;
 return to_jsonb(s);
end $$;

create or replace function public.experience_save_with_warranty(p_token uuid,p_answers jsonb,p_complete boolean,p_nps integer,p_category text,p_alert text,p_reason text) returns void language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences; cfg public.experience_warranty_config; s public.experience_warranty_sessions;
begin
 select * into e from public.customer_experiences where token=p_token for update;
 select * into cfg from public.experience_warranty_config where id=1 for share;
 if p_complete then
 if exists(select 1 from public.experience_sale_addenda a where a.experience_id=e.id and (a.has_discount or a.details<>'') and not exists(select 1 from public.experience_addendum_receipts r where r.addendum_id=a.id)) then raise exception 'Registre a ciência ou suas dúvidas sobre o adendo antes de continuar'; end if;
 if exists(select 1 from public.experience_sale_addenda a join public.experience_addendum_receipts r on r.addendum_id=a.id where a.experience_id=e.id and r.outcome='questions') then p_alert:='critical';p_reason:=concat_ws('; ',nullif(p_reason,''),'Cliente tem dúvidas sobre o adendo da venda');end if;

  select * into s from public.experience_warranty_sessions where experience_id=e.id and version=cfg.version and acknowledged_at is not null;
  if s.id is null then raise exception 'Warranty confirmation required'; end if;
  if s.outcome='questions' then p_alert:='critical'; p_reason:=concat_ws('; ',nullif(p_reason,''),'Cliente tem dúvidas sobre a garantia'); end if;
  if p_answers->>'referral_choice'='Sim, indicar agora' and (length(trim(coalesce(p_answers->>'referral_name','')))<2 or coalesce(p_answers->>'referral_phone','') !~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' or p_answers->>'referral_permission' is distinct from 'Sim, a pessoa autorizou o contato') then raise exception 'Invalid referral'; end if;
 end if;
 perform public.experience_save(p_token,p_answers,p_complete,p_nps,p_category,p_alert,p_reason);
 if p_complete and p_answers->>'referral_choice'='Sim, indicar agora' then perform public.experience_referral_add(p_token,p_answers->>'referral_name',p_answers->>'referral_phone',true); end if;
 if p_complete and p_answers->>'referral_choice'='Sim, mais tarde' and p_answers->>'referral_reminder'='Sim, pode me lembrar pelo WhatsApp' and not e.is_demo and not exists(select 1 from public.experience_referrals where experience_id=e.id) then insert into public.experience_referral_reminders(experience_id) values(e.id) on conflict(experience_id) do nothing; end if;
end $$;
notify pgrst, 'reload schema';
commit;
