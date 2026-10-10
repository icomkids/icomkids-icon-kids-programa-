create schema if not exists ia_bank_platform_internal;
revoke all on schema ia_bank_platform_internal from public,anon,authenticated;
grant usage on schema ia_bank_platform_internal to authenticated,service_role;
create table ia_bank_platform_internal.owners(user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
alter table ia_bank_platform_internal.owners enable row level security;
revoke all on ia_bank_platform_internal.owners from public,anon,authenticated;
do $$declare n integer;begin
 select count(*) into n from auth.users u join public.icom_bank_user_access a on a.user_id=u.id where lower(u.email)='brunolira0312@icloud.com' and a.active and a.role='OWNER';
 if n<>1 then raise exception 'PLATFORM_OWNER_NOT_UNIQUE';end if;
 insert into ia_bank_platform_internal.owners(user_id) select u.id from auth.users u join public.icom_bank_user_access a on a.user_id=u.id where lower(u.email)='brunolira0312@icloud.com' and a.active and a.role='OWNER';
end $$;
create function ia_bank_platform_internal.is_owner() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from ia_bank_platform_internal.owners o join public.icom_bank_user_access a on a.user_id=o.user_id where o.user_id=auth.uid() and a.active and a.role='OWNER');
$$;
revoke all on function ia_bank_platform_internal.is_owner() from public,anon;
grant execute on function ia_bank_platform_internal.is_owner() to authenticated;
create function public.ia_bank_platform_access() returns boolean language sql stable security invoker set search_path='' as $$select ia_bank_platform_internal.is_owner()$$;
revoke all on function public.ia_bank_platform_access() from public,anon;
grant execute on function public.ia_bank_platform_access() to authenticated;

create table public.ia_bank_saas_plans(
 id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 2 and 100),description text not null default '' check(char_length(description)<=1000),price_cents bigint not null check(price_cents between 1 and 100000000),cycle_months integer not null check(cycle_months in(1,12)),trial_days integer not null default 0 check(trial_days between 0 and 90),enabled boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.ia_bank_saas_subscribers(
 id uuid primary key default gen_random_uuid(),store_name text not null check(char_length(store_name) between 2 and 160),contact_name text not null check(char_length(contact_name) between 2 and 160),email text not null check(char_length(email) between 3 and 254),phone text not null default '' check(char_length(phone)<=30),city text not null default '' check(char_length(city)<=100),plan_id uuid references public.ia_bank_saas_plans(id),price_cents bigint not null default 0 check(price_cents between 0 and 100000000),cycle_months integer not null default 1 check(cycle_months in(1,12)),status text not null default 'PROSPECTO' check(status in('PROSPECTO','TESTE','ATIVO','ATRASADO','CANCELADO')),started_at date not null,canceled_at date,provider text not null default 'MANUAL' check(provider in('MANUAL','ASAAS','STRIPE','MERCADO_PAGO')),external_subscription_id text check(char_length(external_subscription_id)<=120),deployment_status text not null default 'PENDENTE' check(deployment_status in('PENDENTE','PREPARANDO','ISOLADO_VALIDADO')),notes text not null default '' check(char_length(notes)<=2000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((status='CANCELADO')=(canceled_at is not null)),check(canceled_at is null or canceled_at>=started_at)
);
create unique index ia_bank_saas_subscription_external on public.ia_bank_saas_subscribers(provider,external_subscription_id) where external_subscription_id is not null;
create index ia_bank_saas_subscribers_plan on public.ia_bank_saas_subscribers(plan_id);
create table public.ia_bank_saas_charges(
 id uuid primary key default gen_random_uuid(),subscriber_id uuid not null references public.ia_bank_saas_subscribers(id),description text not null check(char_length(description) between 2 and 200),amount_cents bigint not null check(amount_cents between 1 and 100000000),fee_cents bigint check(fee_cents between 0 and amount_cents),due_date date not null,status text not null check(status in('PENDENTE','CONFIRMADO','RECEBIDO','CANCELADO','ESTORNADO','REVISAO')),paid_at date,received_at date,refunded_cents bigint not null default 0 check(refunded_cents between 0 and amount_cents),refunded_at date,source text not null default 'MANUAL' check(source in('MANUAL','ASAAS')),external_payment_id text unique check(char_length(external_payment_id)<=120),environment text not null default 'PRODUCTION' check(environment in('PRODUCTION','SANDBOX')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(status not in('CONFIRMADO','RECEBIDO','ESTORNADO') or paid_at is not null),check(status not in('RECEBIDO','ESTORNADO') or received_at is not null),check(refunded_cents=0 or refunded_at is not null),check(received_at is null or (paid_at is not null and received_at>=paid_at)),check(status not in('PENDENTE','CANCELADO') or (paid_at is null and received_at is null)),check(status<>'CONFIRMADO' or received_at is null)
);
create index ia_bank_saas_charges_subscriber on public.ia_bank_saas_charges(subscriber_id);
create index ia_bank_saas_charges_due on public.ia_bank_saas_charges(due_date,status);
create table public.ia_bank_saas_costs(
 id uuid primary key default gen_random_uuid(),description text not null check(char_length(description) between 2 and 200),category text not null check(category in('HOSPEDAGEM','IA','WHATSAPP','MARKETING','SUPORTE','IMPOSTOS','OUTROS')),amount_cents bigint not null check(amount_cents between 1 and 100000000),due_date date not null,paid_at date,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.ia_bank_saas_settings(id integer primary key check(id=1),provider text not null default 'NAO_CONFIGURADO' check(provider in('NAO_CONFIGURADO','ASAAS','STRIPE','MERCADO_PAGO')),environment text not null default 'SANDBOX' check(environment in('PRODUCTION','SANDBOX')),grace_days integer not null default 7 check(grace_days between 0 and 30),notes text not null default '' check(char_length(notes)<=2000),updated_at timestamptz not null default now());
insert into public.ia_bank_saas_settings(id) values(1);
create table public.ia_bank_saas_events(id text primary key check(char_length(id) between 1 and 200),provider text not null,environment text not null,kind text not null,processed_at timestamptz not null default now(),outcome text not null);
create table public.ia_bank_saas_audit(id bigint generated always as identity primary key,actor uuid references auth.users(id),entity text not null,record_id uuid,action text not null,created_at timestamptz not null default now());
do $$declare t text;begin
 foreach t in array array['plans','subscribers','charges','costs','settings','events','audit'] loop
  execute format('alter table public.ia_bank_saas_%I enable row level security',t);
  execute format('revoke all on public.ia_bank_saas_%I from public,anon,authenticated',t);
  execute format('grant select on public.ia_bank_saas_%I to authenticated',t);
  execute format('grant all on public.ia_bank_saas_%I to service_role',t);
  execute format('create policy platform_read on public.ia_bank_saas_%I for select to authenticated using((select ia_bank_platform_internal.is_owner()))',t);
  if t not in('events','audit') then
   execute format('grant insert,update on public.ia_bank_saas_%I to authenticated',t);
   execute format('create policy platform_insert on public.ia_bank_saas_%I for insert to authenticated with check((select ia_bank_platform_internal.is_owner()))',t);
   execute format('create policy platform_update on public.ia_bank_saas_%I for update to authenticated using((select ia_bank_platform_internal.is_owner())) with check((select ia_bank_platform_internal.is_owner()))',t);
  end if;
 end loop;
end $$;
drop policy platform_insert on public.ia_bank_saas_charges;
drop policy platform_update on public.ia_bank_saas_charges;
create policy platform_insert on public.ia_bank_saas_charges for insert to authenticated with check((select ia_bank_platform_internal.is_owner()) and source='MANUAL' and external_payment_id is null and environment='PRODUCTION' and refunded_cents=0);
create policy platform_update on public.ia_bank_saas_charges for update to authenticated using((select ia_bank_platform_internal.is_owner()) and source='MANUAL' and status not in('CONFIRMADO','RECEBIDO','ESTORNADO')) with check((select ia_bank_platform_internal.is_owner()) and source='MANUAL' and external_payment_id is null and environment='PRODUCTION' and refunded_cents=0);
create function ia_bank_platform_internal.audit_write() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='ia_bank_saas_charges' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_setting('request.jwt.claim.role',true))='authenticated' then
  if new.source<>'MANUAL' or new.external_payment_id is not null or new.environment<>'PRODUCTION' or new.refunded_cents<>0 or (tg_op='UPDATE' and (old.source<>'MANUAL' or old.status in('CONFIRMADO','RECEBIDO','ESTORNADO'))) then raise exception 'PLATFORM_CHARGE_LOCKED';end if;
 end if;
 new.updated_at=clock_timestamp();
 insert into public.ia_bank_saas_audit(actor,entity,record_id,action) values(auth.uid(),tg_table_name,case when tg_table_name='ia_bank_saas_settings' then null else new.id::text::uuid end,tg_op);
 return new;
end $$;
revoke all on function ia_bank_platform_internal.audit_write() from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['plans','subscribers','charges','costs','settings'] loop execute format('create trigger platform_audit before insert or update on public.ia_bank_saas_%I for each row execute function ia_bank_platform_internal.audit_write()',t);end loop;end $$;

create function public.ia_bank_saas_apply_asaas(p_event_id text,p_kind text,p_environment text,p_payment jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ia_bank_saas_subscribers;c public.ia_bank_saas_charges; st text;amount bigint;fees bigint;pd date;rd date;ref bigint;refdate date;
begin
 if p_environment not in('PRODUCTION','SANDBOX') or char_length(p_event_id) not between 1 and 200 or p_kind not like 'PAYMENT_%' or octet_length(p_payment::text)>12000 then raise exception 'PLATFORM_EVENT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('ia-bank-saas:'||(p_payment->>'id'),0));
 if exists(select 1 from public.ia_bank_saas_events where id=p_event_id) then return jsonb_build_object('duplicate',true);end if;
 select * into s from public.ia_bank_saas_subscribers where provider='ASAAS' and external_subscription_id=p_payment->>'subscription';
 if not found then insert into public.ia_bank_saas_events(id,provider,environment,kind,outcome) values(p_event_id,'ASAAS',p_environment,p_kind,'ASSINATURA_NAO_VINCULADA');return jsonb_build_object('ignored',true);end if;
 st:=p_payment->>'status';
 if st not in('PENDENTE','CONFIRMADO','RECEBIDO','CANCELADO','ESTORNADO','REVISAO') then raise exception 'PLATFORM_EVENT_INVALID';end if;
 amount:=(p_payment->>'amount_cents')::bigint;fees:=(p_payment->>'fee_cents')::bigint;pd:=(p_payment->>'paid_at')::date;rd:=(p_payment->>'received_at')::date;ref:=coalesce((p_payment->>'refunded_cents')::bigint,0);refdate:=(p_payment->>'refunded_at')::date;
 select * into c from public.ia_bank_saas_charges where external_payment_id=p_payment->>'id' for update;
 if found and (c.environment<>p_environment or c.subscriber_id<>s.id or c.status in('ESTORNADO','CANCELADO') and st not in('ESTORNADO','CANCELADO') or c.received_at is not null and rd is null) then raise exception 'PLATFORM_EVENT_REVIEW';end if;
 insert into public.ia_bank_saas_charges(subscriber_id,description,amount_cents,fee_cents,due_date,status,paid_at,received_at,refunded_cents,refunded_at,source,external_payment_id,environment)
 values(s.id,'Assinatura IA Bank Automotive',amount,fees,(p_payment->>'due_date')::date,st,pd,rd,ref,refdate,'ASAAS',p_payment->>'id',p_environment)
 on conflict(external_payment_id) do update set amount_cents=excluded.amount_cents,fee_cents=excluded.fee_cents,due_date=excluded.due_date,status=excluded.status,paid_at=excluded.paid_at,received_at=excluded.received_at,refunded_cents=excluded.refunded_cents,refunded_at=excluded.refunded_at;
 insert into public.ia_bank_saas_events(id,provider,environment,kind,outcome) values(p_event_id,'ASAAS',p_environment,p_kind,'PROCESSADO');
 return jsonb_build_object('processed',true);
end $$;
revoke all on function public.ia_bank_saas_apply_asaas(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ia_bank_saas_apply_asaas(text,text,text,jsonb) to service_role;
