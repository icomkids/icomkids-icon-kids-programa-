
-- Owner-only account classification and property schedules. Existing records remain unchanged.
create table public.icom_bank_accounts(id uuid primary key,owner_id uuid not null default auth.uid(),name text not null check(length(btrim(name)) between 2 and 100),bank text not null check(length(btrim(bank)) between 2 and 100),scope text not null check(scope in('LOJA','PESSOAL')),active boolean not null default true,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(owner_id,name));
create table public.icom_bank_account_links(ledger_entry_id uuid primary key references public.icom_bank_admin_entries(id),account_id uuid not null references public.icom_bank_accounts(id),owner_id uuid not null default auth.uid(),purpose text not null default 'MOVIMENTO' check(purpose in('MOVIMENTO','SALDO_INICIAL','RENDA_PESSOAL')),wealth_id uuid references public.icom_bank_personal_wealth(id),created_at timestamptz not null default clock_timestamp());
create index bank_account_links_account on public.icom_bank_account_links(account_id,ledger_entry_id);
create index bank_account_links_owner on public.icom_bank_account_links(owner_id);
create index bank_account_links_wealth on public.icom_bank_account_links(wealth_id) where wealth_id is not null;
create table public.icom_bank_property_plans(wealth_id uuid primary key references public.icom_bank_personal_wealth(id),owner_id uuid not null default auth.uid(),config jsonb not null check(jsonb_typeof(config)='object'),created_at timestamptz not null default clock_timestamp());
create index bank_property_plans_owner on public.icom_bank_property_plans(owner_id);
create table public.icom_bank_rent_dues(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid(),wealth_id uuid not null references public.icom_bank_personal_wealth(id),title text not null check(length(title) between 2 and 160),due_date date not null,amount_cents bigint not null check(amount_cents between 1 and 1000000000),account_id uuid not null references public.icom_bank_accounts(id),status text not null default 'PENDENTE' check(status in('PENDENTE','RECEBIDO')),received_at date,wealth_income_id uuid references public.icom_bank_personal_wealth(id),ledger_entry_id uuid references public.icom_bank_admin_entries(id),active boolean not null default true,updated_at timestamptz not null default clock_timestamp(),unique(wealth_id,due_date),check((status='PENDENTE' and received_at is null and wealth_income_id is null and ledger_entry_id is null) or (status='RECEBIDO' and received_at is not null and wealth_income_id is not null and ledger_entry_id is not null)));
create index bank_rent_dues_owner_due on public.icom_bank_rent_dues(owner_id,due_date,id);
create index bank_rent_dues_account on public.icom_bank_rent_dues(account_id);
create index bank_rent_dues_wealth_income on public.icom_bank_rent_dues(wealth_income_id) where wealth_income_id is not null;
create index bank_rent_dues_ledger on public.icom_bank_rent_dues(ledger_entry_id) where ledger_entry_id is not null;
create table public.icom_bank_property_loans(payable_id uuid primary key references public.icom_bank_payables(id),wealth_id uuid not null references public.icom_bank_personal_wealth(id),owner_id uuid not null default auth.uid());
create index bank_property_loans_owner on public.icom_bank_property_loans(owner_id);
create index bank_property_loans_wealth on public.icom_bank_property_loans(wealth_id);
create table icom_bank_internal.account_history(id bigint generated always as identity primary key,actor_id uuid not null,entity text not null,entity_id uuid not null,old_data jsonb,new_data jsonb not null,created_at timestamptz not null default clock_timestamp());
alter table icom_bank_internal.account_history enable row level security;
revoke all on icom_bank_internal.account_history from public,anon,authenticated;
create function icom_bank_internal.guard_account_data() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' or new.owner_id<>auth.uid() then raise exception 'BANK_FORBIDDEN';end if;
 if tg_op='UPDATE' and new.owner_id<>old.owner_id then raise exception 'BANK_FORBIDDEN';end if;
 if tg_table_name='icom_bank_accounts' then
  if tg_op='UPDATE' and new.id<>old.id then raise exception 'BANK_ACCOUNT_INVALID';end if;
  new.updated_at:=clock_timestamp();
 elsif tg_table_name='icom_bank_account_links' then
  if not exists(select 1 from public.icom_bank_accounts where id=new.account_id and owner_id=auth.uid()) or not exists(select 1 from public.icom_bank_admin_entries where id=new.ledger_entry_id) then raise exception 'BANK_ACCOUNT_INVALID';end if;
  if tg_op='UPDATE' and (new.ledger_entry_id<>old.ledger_entry_id or new.purpose<>old.purpose or new.wealth_id is distinct from old.wealth_id) then raise exception 'BANK_ACCOUNT_INVALID';end if;
 elsif tg_table_name='icom_bank_property_plans' then
  if (tg_op='UPDATE' and new.wealth_id<>old.wealth_id) or not exists(select 1 from public.icom_bank_personal_wealth where id=new.wealth_id and owner_id=auth.uid() and kind='ATIVO' and category='Imóvel / aluguel') then raise exception 'BANK_PROPERTY_INVALID';end if;
 elsif tg_table_name='icom_bank_property_loans' then
  if tg_op='UPDATE' or not exists(select 1 from public.icom_bank_personal_wealth where id=new.wealth_id and owner_id=auth.uid()) or not exists(select 1 from public.icom_bank_payables where id=new.payable_id and scope='PESSOAL') then raise exception 'BANK_PROPERTY_INVALID';end if;
 elsif tg_table_name='icom_bank_rent_dues' then
  if not exists(select 1 from public.icom_bank_personal_wealth where id=new.wealth_id and owner_id=auth.uid()) or not exists(select 1 from public.icom_bank_accounts where id=new.account_id and owner_id=auth.uid()) then raise exception 'BANK_PROPERTY_INVALID';end if;
  if tg_op='UPDATE' and (new.id<>old.id or new.wealth_id<>old.wealth_id or new.amount_cents<>old.amount_cents or new.due_date<>old.due_date or old.status='RECEBIDO') then raise exception 'BANK_PROPERTY_CHANGED';end if;
  new.updated_at:=clock_timestamp();
 end if;
 insert into icom_bank_internal.account_history(actor_id,entity,entity_id,old_data,new_data) values(auth.uid(),tg_table_name,coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(new)->>'wealth_id')::uuid,(to_jsonb(new)->>'ledger_entry_id')::uuid,(to_jsonb(new)->>'payable_id')::uuid),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
revoke all on function icom_bank_internal.guard_account_data() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['icom_bank_accounts','icom_bank_account_links','icom_bank_property_plans','icom_bank_rent_dues','icom_bank_property_loans'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated,service_role',t);
  execute format('create policy owner_read on public.%I for select to authenticated using(owner_id=(select auth.uid()) and (select icom_bank_internal.role())=''OWNER'')',t);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check(owner_id=(select auth.uid()) and (select icom_bank_internal.role())=''OWNER'')',t);
  execute format('create policy owner_update on public.%I for update to authenticated using(owner_id=(select auth.uid()) and (select icom_bank_internal.role())=''OWNER'') with check(owner_id=(select auth.uid()) and (select icom_bank_internal.role())=''OWNER'')',t);
  execute format('create trigger guard_accounts before insert or update on public.%I for each row execute function icom_bank_internal.guard_account_data()',t);
 end loop;
end $$;
create function public.icom_bank_assign_account(p_entry uuid,p_account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.icom_bank_accounts;l public.icom_bank_account_links;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 select * into a from public.icom_bank_accounts where id=p_account and active and owner_id=auth.uid();
 if not found or not exists(select 1 from public.icom_bank_admin_entries where id=p_entry and active and status='REALIZADO') then raise exception 'BANK_ACCOUNT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_entry::text,11));
 select * into l from public.icom_bank_account_links where ledger_entry_id=p_entry;
 if found then if l.account_id<>p_account then raise exception 'BANK_ACCOUNT_CHANGED';end if;return to_jsonb(l);end if;
 insert into public.icom_bank_account_links(ledger_entry_id,account_id) values(p_entry,p_account) returning * into l;return to_jsonb(l);
end $$;
create function public.icom_bank_save_account(p_payload jsonb,p_expected timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.icom_bank_accounts;identifier uuid;initial bigint;day date;e uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 identifier:=(p_payload->>'id')::uuid;initial:=(p_payload->>'initial_cents')::bigint;day:=(p_payload->>'initial_date')::date;
 if identifier is null or initial is null or abs(initial)>1000000000 or day is null or day<date '2000-01-01' or day>(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'BANK_ACCOUNT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(identifier::text,11));select * into a from public.icom_bank_accounts where id=identifier for update;
 if found then
  if p_expected is null then if a.name=p_payload->>'name' and a.bank=p_payload->>'bank' and a.scope=p_payload->>'scope' and a.active=(p_payload->>'active')::boolean and initial=coalesce((select case when e.kind='ENTRADA' then e.amount_cents else -e.amount_cents end from public.icom_bank_account_links l join public.icom_bank_admin_entries e on e.id=l.ledger_entry_id where l.account_id=a.id and l.purpose='SALDO_INICIAL'),0) then return to_jsonb(a);end if;raise exception 'BANK_ACCOUNT_CHANGED';end if;
  if a.updated_at<>p_expected or initial<>0 then raise exception 'BANK_ACCOUNT_CHANGED';end if;
  update public.icom_bank_accounts set name=btrim(p_payload->>'name'),bank=btrim(p_payload->>'bank'),scope=p_payload->>'scope',active=(p_payload->>'active')::boolean where id=identifier returning * into a;
 else
  if p_expected is not null then raise exception 'BANK_ACCOUNT_CHANGED';end if;
  insert into public.icom_bank_accounts(id,name,bank,scope,active) values(identifier,btrim(p_payload->>'name'),btrim(p_payload->>'bank'),p_payload->>'scope',(p_payload->>'active')::boolean) returning * into a;
  if initial<>0 then
   e:=gen_random_uuid();perform public.icom_bank_save_admin_entry(jsonb_build_object('id',e,'kind',case when initial>0 then 'ENTRADA' else 'CUSTO' end,'scope','LOJA','entry_date',day,'description','Saldo inicial · '||a.name,'category','Saldo inicial de conta','status','REALIZADO','amount_cents',abs(initial),'details',jsonb_build_object('payment_method','TRANSFERENCIA','notes','Saldo inicial informado. Não representa lucro ou despesa.')),null);
   insert into public.icom_bank_account_links(ledger_entry_id,account_id,purpose) values(e,a.id,'SALDO_INICIAL');
  end if;
 end if;return to_jsonb(a);
end $$;
create function public.icom_bank_account_post(p_operation text,p_args jsonb,p_account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v jsonb;e uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 if p_account is null and exists(select 1 from public.icom_bank_accounts where active) then raise exception 'BANK_ACCOUNT_REQUIRED';end if;
 if p_account is not null and not exists(select 1 from public.icom_bank_accounts where id=p_account and owner_id=auth.uid() and active) then raise exception 'BANK_ACCOUNT_INVALID';end if;
 if jsonb_typeof(p_args) is distinct from 'object' or length(p_args::text)>12000 then raise exception 'BANK_ACCOUNT_INVALID';end if;
 case p_operation
 when 'LANCAMENTO' then v:=public.icom_bank_save_admin_entry(p_args->'p_payload',(p_args->>'p_expected')::timestamptz);e:=(p_args->'p_payload'->>'id')::uuid;
 when 'RETIRADA' then v:=public.icom_bank_record_withdrawal(p_args->'p_payload');e:=(p_args->'p_payload'->>'id')::uuid;
 when 'PAGAR_CONTA' then v:=public.icom_bank_pay_trade_debt((p_args->>'p_id')::uuid,(p_args->>'p_request')::uuid,(p_args->>'p_paid')::date,p_args->>'p_method',(p_args->>'p_receipt')::uuid,(p_args->>'p_existing')::uuid,(p_args->>'p_expected')::timestamptz);e:=(v->>'ledger_entry_id')::uuid;
 when 'RECEBER_CONTA' then v:=public.icom_bank_receive((p_args->>'p_id')::uuid,(p_args->>'p_request')::uuid,(p_args->>'p_amount')::numeric,(p_args->>'p_date')::date,p_args->>'p_method',(p_args->>'p_existing')::uuid,(p_args->>'p_expected')::timestamptz);e:=coalesce((p_args->>'p_existing')::uuid,(p_args->>'p_request')::uuid);
 else raise exception 'BANK_ACCOUNT_INVALID';end case;
 if p_account is not null then perform public.icom_bank_assign_account(e,p_account);end if;return v;
end $$;
create function public.icom_bank_save_property(p_payload jsonb,p_property jsonb,p_expected timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.icom_bank_personal_wealth;p public.icom_bank_property_plans;rent bigint;loan bigint;first_r date;first_l date;months_r integer;months_l integer;account uuid;i integer;d date;base date;loan_id uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 if p_payload->>'kind' is distinct from 'ATIVO' or p_payload->>'category' is distinct from 'Imóvel / aluguel' or jsonb_typeof(p_property) is distinct from 'object' or length(p_property::text)>1000 then raise exception 'BANK_PROPERTY_INVALID';end if;
 rent:=(p_property->>'rent_cents')::bigint;loan:=(p_property->>'loan_cents')::bigint;first_r:=(p_property->>'rent_first')::date;first_l:=(p_property->>'loan_first')::date;months_r:=(p_property->>'rent_months')::integer;months_l:=(p_property->>'loan_months')::integer;account:=(p_property->>'rent_account_id')::uuid;
 if rent is null or loan is null or rent not between 0 and 1000000000 or loan not between 0 and 1000000000 or months_r is null or months_l is null or rent>0 and (first_r is null or first_r<date '2000-01-01' or first_r+make_interval(months=>months_r-1)>date '2100-12-31' or months_r not between 1 and 60 or account is null) or loan>0 and (first_l is null or first_l<date '2000-01-01' or first_l+make_interval(months=>months_l-1)>date '2100-12-31' or months_l not between 1 and 60 or (p_payload->>'debt_cents')::bigint<=0) then raise exception 'BANK_PROPERTY_INVALID';end if;
 if rent>0 and not exists(select 1 from public.icom_bank_accounts where id=account and active and owner_id=auth.uid()) then raise exception 'BANK_ACCOUNT_INVALID';end if;
 w:=public.icom_bank_save_personal_wealth(p_payload,p_expected);
 select * into p from public.icom_bank_property_plans where wealth_id=w.id;
 if found then
  if p.config=p_property then return to_jsonb(w);end if;
  if (p.config->>'rent_cents')::bigint>0 or (p.config->>'loan_cents')::bigint>0 then raise exception 'BANK_PROPERTY_PLAN_EXISTS';end if;
  update public.icom_bank_property_plans set config=p_property where wealth_id=w.id;
 else insert into public.icom_bank_property_plans(wealth_id,config) values(w.id,p_property);end if;
 if rent>0 then for i in 0..months_r-1 loop
  base:=(date_trunc('month',first_r)+make_interval(months=>i))::date;d:=base+least(extract(day from first_r)::integer,extract(day from base+interval '1 month - 1 day')::integer)-1;
  insert into public.icom_bank_rent_dues(wealth_id,title,due_date,amount_cents,account_id) values(w.id,left('Aluguel · '||w.name,160),d,rent,account);
 end loop;end if;
 if loan>0 then
  loan_id:=gen_random_uuid();perform public.icom_bank_save_expense(jsonb_build_object('id',loan_id,'scope','PESSOAL','person','AMBOS','title',left('Parcela do imóvel · '||w.name,160),'category','Financiamento de imóvel','notes','Patrimônio: '||w.id::text||'. Dívida pessoal; o saldo da dívida é atualizado manualmente conforme o extrato, pois a parcela pode conter juros.','amount_cents',loan,'due_date',first_l,'months',months_l),null);
  insert into public.icom_bank_property_loans(payable_id,wealth_id) select id,w.id from public.icom_bank_payables where id=loan_id or series_id=loan_id;
 end if;return to_jsonb(w);
end $$;
create function public.icom_bank_receive_rent(p_id uuid,p_request uuid,p_account uuid,p_date date,p_method text,p_expected timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_rent_dues;w public.icom_bank_personal_wealth;income uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 select * into r from public.icom_bank_rent_dues where id=p_id for update;
 if not found or p_request is null then raise exception 'BANK_PROPERTY_INVALID';end if;
 if r.status='RECEBIDO' then if r.ledger_entry_id=p_request and r.account_id=p_account and r.received_at=p_date and exists(select 1 from public.icom_bank_admin_entries where id=p_request and details->>'payment_method'=p_method) then return to_jsonb(r);end if;raise exception 'BANK_PROPERTY_CHANGED';end if;
 if not r.active or p_expected is distinct from r.updated_at or p_date is null or p_date<date '2000-01-01' or p_date>(clock_timestamp() at time zone 'America/Sao_Paulo')::date or p_method is null or p_method not in('PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO') then raise exception 'BANK_PROPERTY_CHANGED';end if;
 if not exists(select 1 from public.icom_bank_accounts where id=p_account and active and owner_id=auth.uid()) then raise exception 'BANK_ACCOUNT_INVALID';end if;
 select * into w from public.icom_bank_personal_wealth where id=r.wealth_id and active;
 if not found then raise exception 'BANK_PROPERTY_INVALID';end if;
 income:=gen_random_uuid();perform public.icom_bank_save_personal_wealth(jsonb_build_object('id',income,'kind','RENDA','category','Imóvel / aluguel','name',r.title,'record_date',p_date,'amount_cents',r.amount_cents,'debt_cents',0,'invested_cents',0,'rate_percent',null,'rate_period','MENSAL','source_id',w.id,'notes','Aluguel do vencimento '||r.due_date::text,'active',true),null);
 perform public.icom_bank_save_admin_entry(jsonb_build_object('id',p_request,'kind','ENTRADA','scope','LOJA','entry_date',p_date,'description',r.title,'category','Renda pessoal recebida','status','REALIZADO','amount_cents',r.amount_cents,'details',jsonb_build_object('payment_method',p_method,'notes','Renda pessoal em conta cadastrada. Lucro empresarial não inclui este valor.')),null);
 insert into public.icom_bank_account_links(ledger_entry_id,account_id,purpose,wealth_id) values(p_request,p_account,'RENDA_PESSOAL',income);
 update public.icom_bank_rent_dues set status='RECEBIDO',received_at=p_date,account_id=p_account,wealth_income_id=income,ledger_entry_id=p_request where id=r.id returning * into r;return to_jsonb(r);
end $$;
-- Bot-only path; authorization comes from the existing verified sender and inbox lease.
create function public.icom_bank_whatsapp_account_commit(p_id uuid,p_claim uuid,p_operation text,p_args jsonb,p_account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;b public.icom_bank_whatsapp_bot;v jsonb;claims text;sub text;e uuid;begin
 select * into m from public.icom_bank_whatsapp_inbox where id=p_id for update;
 if not found then raise exception 'BANK_BOT_MISSING';end if;
 if m.status='LANCADO' then return jsonb_build_object('entry_id',m.entry_id,'already',true);end if;
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO' and owner_id=m.owner_id;
 if not found or m.status<>'PROCESSANDO' or m.claim_id is distinct from p_claim or not(m.sender=any(b.allowed_phones)) or not exists(select 1 from public.icom_bank_user_access where user_id=m.owner_id and active and role='OWNER') then raise exception 'BANK_FORBIDDEN';end if;
 if p_operation not in('LANCAMENTO','PAGAR_CONTA') or p_operation='LANCAMENTO' and (p_args->'p_payload'->>'kind' not in('PESSOAL','CUSTO') or p_args->'p_payload'->>'id'<>m.id::text or p_args->'p_payload'->>'status'<>'REALIZADO' or coalesce(p_args->'p_payload'->>'category','') in('Retirada / Pix','Devolução ao investidor')) or p_operation='PAGAR_CONTA' and (p_args->>'p_request'<>m.id::text or p_args->>'p_existing' is not null) then raise exception 'BANK_BOT_INVALID';end if;
 claims:=current_setting('request.jwt.claims',true);sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',m.owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',m.owner_id,'role','authenticated')::text,true);
 v:=public.icom_bank_account_post(p_operation,p_args,p_account);
 e:=case when p_operation='LANCAMENTO' then m.id else (v->>'ledger_entry_id')::uuid end;
 perform set_config('request.jwt.claims',coalesce(claims,''),true);perform set_config('request.jwt.claim.sub',coalesce(sub,''),true);
 update public.icom_bank_whatsapp_inbox set status='LANCADO',entry_id=e,updated_at=clock_timestamp() where id=m.id;
 return jsonb_build_object('entry_id',e,'already',false);
end $$;
revoke all on function public.icom_bank_whatsapp_account_commit(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.icom_bank_whatsapp_account_commit(uuid,uuid,text,jsonb,uuid) to service_role;
do $$declare f regprocedure;begin
 foreach f in array array['public.icom_bank_assign_account(uuid,uuid)'::regprocedure,'public.icom_bank_save_account(jsonb,timestamptz)'::regprocedure,'public.icom_bank_account_post(text,jsonb,uuid)'::regprocedure,'public.icom_bank_save_property(jsonb,jsonb,timestamptz)'::regprocedure,'public.icom_bank_receive_rent(uuid,uuid,uuid,date,text,timestamptz)'::regprocedure] loop execute format('revoke all on function %s from public,anon',f);execute format('grant execute on function %s to authenticated',f);end loop;
end $$;

-- A linked rental income and its cash mirror must always agree.
create function icom_bank_internal.guard_linked_income() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='icom_bank_personal_wealth' then
  if exists(select 1 from public.icom_bank_account_links where wealth_id=old.id and purpose='RENDA_PESSOAL') and to_jsonb(new)-'updated_at'-'notes' is distinct from to_jsonb(old)-'updated_at'-'notes' then raise exception 'BANK_INCOME_LINKED';end if;
 else
  if exists(select 1 from public.icom_bank_account_links where ledger_entry_id=old.id and purpose in('RENDA_PESSOAL','SALDO_INICIAL')) and to_jsonb(new)-'updated_at' is distinct from to_jsonb(old)-'updated_at' then raise exception 'BANK_INCOME_LINKED';end if;
 end if;return new;
end $$;
revoke all on function icom_bank_internal.guard_linked_income() from public,anon,authenticated;
create trigger guard_linked_income before update on public.icom_bank_personal_wealth for each row execute function icom_bank_internal.guard_linked_income();
create trigger guard_linked_income before update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_linked_income();
create function public.icom_bank_save_account_income(p_payload jsonb,p_expected timestamptz,p_account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.icom_bank_personal_wealth;eid uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' or p_payload->>'kind' is distinct from 'RENDA' then raise exception 'BANK_FORBIDDEN';end if;
 if p_account is null and exists(select 1 from public.icom_bank_accounts where active) then raise exception 'BANK_ACCOUNT_REQUIRED';end if;
 if p_account is not null and not exists(select 1 from public.icom_bank_accounts where id=p_account and active and owner_id=auth.uid()) then raise exception 'BANK_ACCOUNT_INVALID';end if;
 w:=public.icom_bank_save_personal_wealth(p_payload,p_expected);
 if p_account is null then return to_jsonb(w);end if;
 if exists(select 1 from public.icom_bank_account_links where wealth_id=w.id and purpose='RENDA_PESSOAL') then
  if not exists(select 1 from public.icom_bank_account_links where wealth_id=w.id and account_id=p_account) then raise exception 'BANK_ACCOUNT_CHANGED';end if;return to_jsonb(w);
 end if;
 if p_expected is not null then return to_jsonb(w);end if;
 eid:=gen_random_uuid();perform public.icom_bank_save_admin_entry(jsonb_build_object('id',eid,'kind','ENTRADA','scope','LOJA','entry_date',w.record_date,'description',w.name,'category','Renda pessoal recebida','status','REALIZADO','amount_cents',w.amount_cents,'details',jsonb_build_object('payment_method','TRANSFERENCIA','notes','Renda pessoal em conta cadastrada. Não compõe lucro da loja.')),null);
 insert into public.icom_bank_account_links(ledger_entry_id,account_id,purpose,wealth_id) values(eid,p_account,'RENDA_PESSOAL',w.id);return to_jsonb(w);
end $$;
revoke all on function public.icom_bank_save_account_income(jsonb,timestamptz,uuid) from public,anon;
grant execute on function public.icom_bank_save_account_income(jsonb,timestamptz,uuid) to authenticated;

notify pgrst,'reload schema';
