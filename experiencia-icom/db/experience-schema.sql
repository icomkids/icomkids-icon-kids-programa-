-- Esquema exclusivo da Experiência Icom. Aplicar via migration em projeto novo.
create table public.experience_users(id uuid primary key references auth.users(id),name text not null,role text not null check(role in ('admin','manager','owner')),leadership_access boolean not null default false,active boolean not null default true);
create table public.customers(id uuid primary key default gen_random_uuid(),name text not null,phone text not null default '',customer_type text not null default 'novo',created_at timestamptz not null default now());
create unique index customer_phone on public.customers(phone) where phone<>'';
create table public.salespeople(id uuid primary key default gen_random_uuid(),name text not null unique,photo_url text);
create table public.vehicles(id uuid primary key default gen_random_uuid(),name text not null unique);
create table public.sales(id uuid primary key default gen_random_uuid(),customer_id uuid references public.customers(id),salesperson_id uuid references public.salespeople(id),vehicle_id uuid references public.vehicles(id),purchase_date date,delivery_date date,payment_method text,trade_in boolean default false);
create table public.customer_experiences(id uuid primary key default gen_random_uuid(),token uuid not null unique default gen_random_uuid(),customer_id uuid not null references public.customers(id),salesperson_id uuid not null references public.salespeople(id),vehicle_id uuid not null references public.vehicles(id),sale_id uuid references public.sales(id),purchase_date date not null,delivery_date date not null,payment_method text,trade_in boolean not null default false,status text not null default 'criada' check(status in ('criada','enviada','aberta','iniciada','respondida','atendimento necessário','em tratamento','resolvida','arquivada')),sent_at timestamptz,opened_at timestamptz,started_at timestamptz,completed_at timestamptz,expires_at timestamptz,is_demo boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index experience_dates on public.customer_experiences(created_at);
create index experience_customer on public.customer_experiences(customer_id);
create index experience_seller on public.customer_experiences(salesperson_id);
create index experience_vehicle on public.customer_experiences(vehicle_id);
create index experience_sale on public.customer_experiences(sale_id);
create table public.experience_responses(id uuid primary key default gen_random_uuid(),experience_id uuid not null unique references public.customer_experiences(id),answers jsonb not null default '{}',nps_score integer check(nps_score between 0 and 10),nps_category text check(nps_category in ('promoter','passive','detractor')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.experience_alerts(id uuid primary key default gen_random_uuid(),experience_id uuid not null unique references public.customer_experiences(id),alert_level text not null check(alert_level in ('attention','critical')),alert_reason text not null,resolution_status text not null default 'Novo' check(resolution_status in ('Novo','Em análise','Contato iniciado','Aguardando cliente','Resolvido','Não resolvido')),assigned_to uuid references public.experience_users(id),assigned_at timestamptz,resolution_notes text,resolved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index alert_assignee on public.experience_alerts(assigned_to);
create table public.experience_alert_events(id uuid primary key default gen_random_uuid(),alert_id uuid not null references public.experience_alerts(id),user_id uuid references public.experience_users(id),event_type text not null,description text not null,created_at timestamptz not null default now());
create index event_alert on public.experience_alert_events(alert_id,created_at);
create index event_user on public.experience_alert_events(user_id);
create table public.experience_audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid references public.experience_users(id),action text not null,entity_id text not null,created_at timestamptz not null default now());
create index audit_user on public.experience_audit_logs(user_id);
create table public.experience_settings(id integer primary key check(id=1),google_review_url text not null default '',whatsapp_message_template text not null default E'Olá, [Nome]! 👋\n\nEsperamos que você esteja curtindo seu novo carro. 🚘\n\nA Icom gostaria de saber como foi sua experiência conosco.\n\nCriamos a Experiência Icom, uma pesquisa rápida que nos ajuda a entender o que estamos fazendo bem e onde podemos melhorar.\n\nLeva menos de 2 minutos.\n\n👉 [LINK]\n\nSua opinião é muito importante para nós.',company_name text not null default 'Icom Veículos',survey_active boolean not null default true,intro_text text not null default 'Sua compra terminou, mas o nosso compromisso com a sua experiência continua. Conte como foi sua jornada com a Icom e nos ajude a melhorar cada detalhe.',final_text text not null default 'Seu feedback ajuda a Icom a melhorar continuamente.',estimated_time text not null default 'Menos de 2 minutos',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
insert into public.experience_settings(id) values(1);
create table public.experience_leadership(id uuid primary key default gen_random_uuid(),name text not null unique,position text not null);
insert into public.experience_leadership(name,position) values('Luiz Lázaro','Gerente'),('Bruno Lira','Proprietário') on conflict(name) do nothing;
-- O navegador nunca acessa tabelas diretamente. O servidor valida usuário e
-- permissão a cada chamada e controla o acesso público exclusivamente por token.
do $$ declare t text; begin foreach t in array array['experience_users','customers','salespeople','vehicles','sales','customer_experiences','experience_responses','experience_alerts','experience_alert_events','experience_audit_logs','experience_settings','experience_leadership'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); execute format('grant all on public.%I to service_role',t); end loop; end $$;
create function public.experience_open(p_token uuid) returns void language sql security invoker set search_path='' as $$ update public.customer_experiences set opened_at=coalesce(opened_at,now()),status=case when status in ('criada','enviada') then 'aberta' else status end,updated_at=now() where token=p_token and status<>'arquivada'; $$;
create function public.experience_save(p_token uuid,p_answers jsonb,p_complete boolean,p_nps integer,p_category text,p_alert text,p_reason text) returns void language plpgsql security invoker set search_path='' as $$ declare e public.customer_experiences; a uuid; begin
 select * into e from public.customer_experiences where token=p_token for update;
 if e.id is null or e.completed_at is not null or e.status='arquivada' or (e.expires_at is not null and e.expires_at<now()) then raise exception 'Experience unavailable'; end if;
 if not exists(select 1 from public.experience_settings where id=1 and survey_active) then raise exception 'Survey disabled'; end if;
 if p_complete and (p_nps is null or p_nps<0 or p_nps>10) then raise exception 'Invalid NPS'; end if;
 insert into public.experience_responses(experience_id,answers,nps_score,nps_category) values(e.id,p_answers,p_nps,p_category) on conflict(experience_id) do update set answers=excluded.answers,nps_score=excluded.nps_score,nps_category=excluded.nps_category,updated_at=now();
 update public.customer_experiences set started_at=coalesce(started_at,now()),completed_at=case when p_complete then now() else null end,status=case when p_complete and p_alert='critical' then 'atendimento necessário' when p_complete then 'respondida' else 'iniciada' end,updated_at=now() where id=e.id;
 if p_complete and p_alert<>'none' then insert into public.experience_alerts(experience_id,alert_level,alert_reason) values(e.id,p_alert,case when p_reason='' then 'NPS passivo: oportunidade de melhoria' else p_reason end) on conflict(experience_id) do update set alert_level=excluded.alert_level,alert_reason=excluded.alert_reason,resolution_status='Novo',resolved_at=null,updated_at=now() returning id into a; insert into public.experience_alert_events(alert_id,event_type,description) values(a,'alert_created','Cliente respondeu; alerta criado automaticamente.'); end if;
 end $$;
create function public.experience_treat_alert(p_id uuid,p_user uuid,p_assigned uuid,p_status text,p_notes text) returns void language plpgsql security invoker set search_path='' as $$ declare e uuid; begin
 update public.experience_alerts set assigned_at=case when assigned_to is distinct from p_assigned then now() else assigned_at end,assigned_to=p_assigned,resolution_status=p_status,resolution_notes=p_notes,resolved_at=case when p_status in ('Resolvido','Não resolvido') then now() else null end,updated_at=now() where id=p_id returning experience_id into e;
 if e is null then raise exception 'Alert not found'; end if;
 insert into public.experience_alert_events(alert_id,user_id,event_type,description) values(p_id,p_user,case when p_status='Contato iniciado' then 'customer_contact_started' else 'status_updated' end,p_status||': '||p_notes);
 update public.customer_experiences set status=case when p_status='Resolvido' then 'resolvida' else 'em tratamento' end,updated_at=now() where id=e;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'alert_updated',p_id::text); end $$;
create function public.experience_manual_alert(p_experience uuid,p_user uuid,p_reason text) returns void language plpgsql security invoker set search_path='' as $$ declare a uuid; begin
 if length(trim(p_reason))=0 then raise exception 'Reason required'; end if;
 insert into public.experience_alerts(experience_id,alert_level,alert_reason) values(p_experience,'critical',p_reason) on conflict(experience_id) do update set alert_level='critical',alert_reason=excluded.alert_reason,resolution_status='Novo',resolved_at=null returning id into a;
 insert into public.experience_alert_events(alert_id,user_id,event_type,description) values(a,p_user,'manual_alert',p_reason);
 update public.customer_experiences set status='atendimento necessário',updated_at=now() where id=p_experience;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'manual_alert',p_experience::text); end $$;
create function public.experience_admin_action(p_experience uuid,p_user uuid,p_action text) returns void language plpgsql security invoker set search_path='' as $$ begin
 perform 1 from public.customer_experiences where id=p_experience for update;
 if not found then raise exception 'Experience not found'; end if;
 if p_action='reopen' then update public.customer_experiences set completed_at=null,status='iniciada',updated_at=now() where id=p_experience;
 elsif p_action='archive' then update public.customer_experiences set status='arquivada',updated_at=now() where id=p_experience;
 elsif p_action='sent' then update public.customer_experiences set sent_at=coalesce(sent_at,now()),status=case when status='criada' then 'enviada' else status end,updated_at=now() where id=p_experience;
 else raise exception 'Unknown action'; end if;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,p_action,p_experience::text); end $$;
create function public.experience_create_demo(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$ declare c uuid;s uuid;v uuid; begin
 select id into c from public.customers where name='João da Silva (DEMO)' limit 1;
 if c is null then insert into public.customers(name,customer_type) values('João da Silva (DEMO)','demo') returning id into c; end if;
 insert into public.salespeople(name) values('Vendedor Demonstração') on conflict(name) do update set name=excluded.name returning id into s;
 insert into public.vehicles(name) values('Jeep Compass 2025 (DEMO)') on conflict(name) do update set name=excluded.name returning id into v;
 insert into public.customer_experiences(customer_id,salesperson_id,vehicle_id,purchase_date,delivery_date,is_demo) values(c,s,v,current_date,current_date,true);
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'demo_created','demo'); end $$;
revoke all on function public.experience_open(uuid),public.experience_save(uuid,jsonb,boolean,integer,text,text,text),public.experience_treat_alert(uuid,uuid,uuid,text,text),public.experience_manual_alert(uuid,uuid,text),public.experience_admin_action(uuid,uuid,text),public.experience_create_demo(uuid) from public,anon,authenticated;
grant execute on function public.experience_open(uuid),public.experience_save(uuid,jsonb,boolean,integer,text,text,text),public.experience_treat_alert(uuid,uuid,uuid,text,text),public.experience_manual_alert(uuid,uuid,text),public.experience_admin_action(uuid,uuid,text),public.experience_create_demo(uuid) to service_role;
create function public.experience_create(p_customer uuid,p_seller uuid,p_vehicle uuid,p_purchase date,p_delivery date,p_payment text,p_trade boolean,p_demo boolean,p_user uuid) returns uuid language plpgsql security invoker set search_path='' as $$ declare s uuid;e uuid;t uuid;begin
 if p_delivery<p_purchase then raise exception 'Delivery before purchase'; end if;
 insert into public.sales(customer_id,salesperson_id,vehicle_id,purchase_date,delivery_date,payment_method,trade_in) values(p_customer,p_seller,p_vehicle,p_purchase,p_delivery,p_payment,p_trade) returning id into s;
 insert into public.customer_experiences(customer_id,salesperson_id,vehicle_id,sale_id,purchase_date,delivery_date,payment_method,trade_in,is_demo) values(p_customer,p_seller,p_vehicle,s,p_purchase,p_delivery,p_payment,p_trade,p_demo) returning id,token into e,t;
 insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'experience_created',e::text);
 return t;end $$;
revoke all on function public.experience_create(uuid,uuid,uuid,date,date,text,boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function public.experience_create(uuid,uuid,uuid,date,date,text,boolean,boolean,uuid) to service_role;
