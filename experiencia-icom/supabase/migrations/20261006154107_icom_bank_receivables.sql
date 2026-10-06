-- Owner-only receivables. Initial sale cash is never rewritten by a later receipt.
create table public.icom_bank_receivables(
 id uuid primary key default gen_random_uuid(),source_entry_id uuid unique references public.icom_bank_admin_entries(id),
 title text not null check(length(trim(title)) between 2 and 160),payer text not null default '' check(length(payer)<=160),
 kind text not null check(kind in('CLIENTE','BANCO','CARTAO')),bank text not null default '' check(length(bank)<=120),
 amount_cents bigint not null check(amount_cents between 0 and 1000000000),received_cents bigint not null default 0 check(received_cents>=0 and received_cents<=amount_cents),
 due_date date check(due_date between date '2000-01-01' and date '2100-12-31'),notes text not null default '' check(length(notes)<=2000),
 active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp(),
 check(source_entry_id is not null or (amount_cents>0 and due_date is not null))
);
create index bank_receivables_due on public.icom_bank_receivables(due_date,id) where active;
create table public.icom_bank_receipts(
 id uuid primary key,receivable_id uuid not null references public.icom_bank_receivables(id),ledger_entry_id uuid not null unique references public.icom_bank_admin_entries(id),
 amount_cents bigint not null check(amount_cents between 1 and 1000000000),received_at date not null check(received_at between date '2000-01-01' and date '2100-12-31'),
 method text not null check(method in('PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO')),active boolean not null default true,
 reason text not null default '' check(length(reason)<=1000),created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp(),
 check(active or length(trim(reason))>=3)
);
create index bank_receipts_bill on public.icom_bank_receipts(receivable_id,received_at,id);
create table public.icom_bank_receivable_history(id uuid primary key default gen_random_uuid(),receivable_id uuid not null references public.icom_bank_receivables(id),actor_id uuid references auth.users(id),previous jsonb,next jsonb not null,created_at timestamptz not null default now());
create index bank_receivable_history_bill on public.icom_bank_receivable_history(receivable_id,created_at,id);
create index bank_receivable_history_actor on public.icom_bank_receivable_history(actor_id);
alter table public.icom_bank_receivables enable row level security;
alter table public.icom_bank_receipts enable row level security;
alter table public.icom_bank_receivable_history enable row level security;
revoke all on public.icom_bank_receivables,public.icom_bank_receipts,public.icom_bank_receivable_history from public,anon,authenticated;
grant select on public.icom_bank_receivables,public.icom_bank_receipts,public.icom_bank_receivable_history to authenticated;
create policy bank_receivables_owner on public.icom_bank_receivables for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_receipts_owner on public.icom_bank_receipts for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_receivable_history_owner on public.icom_bank_receivable_history for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');

create function icom_bank_internal.sale_receivable_amount(e public.icom_bank_admin_entries) returns bigint language plpgsql immutable set search_path='' as $$
declare sale bigint;trade bigint:=0;debt bigint:=0;begin
 if e.kind<>'VENDA' or e.scope<>'LOJA' or jsonb_typeof(e.details->'trade_in') is distinct from 'boolean' or jsonb_typeof(e.details->'sale_cents') is distinct from 'number' or e.amount_cents is null then return null;end if;
 if (e.details->>'sale_cents')!~'^\d+$' then return null;end if;
 sale:=(e.details->>'sale_cents')::bigint;
 if e.details->>'trade_in'='true' then
  if jsonb_typeof(e.details->'trade_value_cents') is distinct from 'number' or jsonb_typeof(e.details->'trade_has_debts') is distinct from 'boolean' then return null;end if;
  if (e.details->>'trade_value_cents')!~'^\d+$' then return null;end if;
  trade:=(e.details->>'trade_value_cents')::bigint;
  if e.details->>'trade_has_debts'='true' then
   if jsonb_typeof(e.details->'trade_has_payoff') is distinct from 'boolean' or jsonb_typeof(e.details->'trade_ipva_cents') is distinct from 'number' or jsonb_typeof(e.details->'trade_fines_cents') is distinct from 'number' or (e.details->>'trade_ipva_cents')!~'^\d+$' or (e.details->>'trade_fines_cents')!~'^\d+$' then return null;end if;
   if e.details->>'trade_has_payoff'='true' and (jsonb_typeof(e.details->'trade_payoff_cents') is distinct from 'number' or (e.details->>'trade_payoff_cents')!~'^\d+$') then return null;end if;
   debt:=coalesce((e.details->>'trade_ipva_cents')::bigint,0)+coalesce((e.details->>'trade_fines_cents')::bigint,0)+case when e.details->>'trade_has_payoff'='true' then coalesce((e.details->>'trade_payoff_cents')::bigint,0) else 0 end;
  end if;
 end if;
 if sale<0 or sale>1000000000 or trade<0 or debt<0 or debt>trade or trade-debt>sale or e.amount_cents<0 or e.amount_cents>sale-trade+debt then return null;end if;
 return sale-trade+debt-case when e.status='REALIZADO' then e.amount_cents else 0 end;
exception when invalid_text_representation or numeric_value_out_of_range then return null;end $$;
revoke all on function icom_bank_internal.sale_receivable_amount(public.icom_bank_admin_entries) from public,anon,authenticated;

create function icom_bank_internal.audit_receivable() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.icom_bank_receivable_history(receivable_id,actor_id,previous,next) values(new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end $$;
revoke all on function icom_bank_internal.audit_receivable() from public,anon,authenticated;
create trigger bank_receivable_audit after insert or update on public.icom_bank_receivables for each row execute function icom_bank_internal.audit_receivable();

create function icom_bank_internal.sync_sale_receivable() returns trigger language plpgsql security definer set search_path='' as $$
declare principal bigint;k text;b text;r public.icom_bank_receivables;begin
 if new.kind<>'VENDA' and (tg_op='INSERT' or old.kind<>'VENDA') then return new;end if;
 principal:=icom_bank_internal.sale_receivable_amount(new);
 select * into r from public.icom_bank_receivables where source_entry_id=new.id for update;
 if r.id is not null and r.received_cents>0 and (not new.active or new.status<>'REALIZADO' or principal is distinct from r.amount_cents or new.entry_date<>old.entry_date or new.amount_cents is distinct from old.amount_cents or new.kind<>old.kind or new.details->'sale_cents' is distinct from old.details->'sale_cents' or new.details->'trade_in' is distinct from old.details->'trade_in' or new.details->'trade_value_cents' is distinct from old.details->'trade_value_cents' or new.details->'trade_has_debts' is distinct from old.details->'trade_has_debts' or new.details->'trade_ipva_cents' is distinct from old.details->'trade_ipva_cents' or new.details->'trade_fines_cents' is distinct from old.details->'trade_fines_cents' or new.details->'trade_has_payoff' is distinct from old.details->'trade_has_payoff' or new.details->'trade_payoff_cents' is distinct from old.details->'trade_payoff_cents' or new.details->'payment_method' is distinct from old.details->'payment_method' or new.details->'payment_bank' is distinct from old.details->'payment_bank' or new.details->'payment_bank_other' is distinct from old.details->'payment_bank_other' or new.details->'plate' is distinct from old.details->'plate') then raise exception 'BANK_RECEIVABLE_SOURCE_LOCKED';end if;
 if principal is null then
  if r.id is not null then update public.icom_bank_receivables set active=false,updated_at=clock_timestamp() where id=r.id;end if;return new;
 end if;
 k:=case when upper(coalesce(new.details->>'payment_method','')) in('FINANCIAMENTO','FINANCIADO') then 'BANCO' when upper(coalesce(new.details->>'payment_method',''))='CARTAO' then 'CARTAO' else 'CLIENTE' end;
 b:=left(coalesce(case when new.details->>'payment_bank'='OUTRO' then new.details->>'payment_bank_other' else new.details->>'payment_bank' end,''),120);
 if r.id is null then
  if new.active and principal>0 then insert into public.icom_bank_receivables(source_entry_id,title,kind,bank,amount_cents) values(new.id,left('Venda · '||coalesce(new.details->>'plate',new.description),160),k,b,principal);end if;
 elsif r.amount_cents<>principal or r.active<>new.active or new.details->'payment_method' is distinct from old.details->'payment_method' or new.details->'payment_bank' is distinct from old.details->'payment_bank' or new.details->'payment_bank_other' is distinct from old.details->'payment_bank_other' then
  update public.icom_bank_receivables set amount_cents=principal,active=new.active,kind=case when new.details->'payment_method' is distinct from old.details->'payment_method' then k else r.kind end,bank=case when new.details->'payment_bank' is distinct from old.details->'payment_bank' or new.details->'payment_bank_other' is distinct from old.details->'payment_bank_other' then b else r.bank end,updated_at=clock_timestamp() where id=r.id;
 end if;return new;
end $$;
revoke all on function icom_bank_internal.sync_sale_receivable() from public,anon,authenticated;
create trigger bank_admin_sale_receivable after insert or update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.sync_sale_receivable();
-- Only complete existing sales are imported; no cash, guessed dates or legacy trade assumptions.
insert into public.icom_bank_receivables(source_entry_id,title,kind,bank,amount_cents)
select e.id,left('Venda · '||coalesce(e.details->>'plate',e.description),160),case when upper(coalesce(e.details->>'payment_method','')) in('FINANCIAMENTO','FINANCIADO') then 'BANCO' when upper(coalesce(e.details->>'payment_method',''))='CARTAO' then 'CARTAO' else 'CLIENTE' end,left(coalesce(case when e.details->>'payment_bank'='OUTRO' then e.details->>'payment_bank_other' else e.details->>'payment_bank' end,''),120),icom_bank_internal.sale_receivable_amount(e)
from public.icom_bank_admin_entries e where e.active and e.kind='VENDA' and icom_bank_internal.sale_receivable_amount(e)>0;

create function icom_bank_internal.guard_receipt_cash() returns trigger language plpgsql security definer set search_path='' as $$ declare p public.icom_bank_receipts;begin
 select * into p from public.icom_bank_receipts where ledger_entry_id=old.id;
 if found and to_jsonb(old)-'updated_at' is distinct from to_jsonb(new)-'updated_at' then
  if not(not p.active and old.active and not new.active and to_jsonb(old)-array['active','updated_at'] is not distinct from to_jsonb(new)-array['active','updated_at']) then raise exception 'BANK_RECEIVABLE_LEDGER_LOCKED';end if;
 end if;return new;
end $$;
revoke all on function icom_bank_internal.guard_receipt_cash() from public,anon,authenticated;
create trigger bank_receipt_cash_guard before update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_receipt_cash();

create function public.icom_bank_save_receivable(p_payload jsonb,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_title text;v_payer text;v_kind text;v_bank text;v_notes text;v_amount bigint;v_due date;r public.icom_bank_receivables;s public.icom_bank_admin_entries;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>6000 or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('id','title','payer','kind','bank','notes','amount_cents','due_date')) or exists(select 1 from jsonb_each(p_payload) x where x.key in('id','title','payer','kind','bank','notes') and jsonb_typeof(x.value)<>'string') then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 begin
  v_id:=(p_payload->>'id')::uuid;v_title:=trim(p_payload->>'title');v_payer:=trim(coalesce(p_payload->>'payer',''));v_kind:=p_payload->>'kind';v_bank:=trim(coalesce(p_payload->>'bank',''));v_notes:=trim(coalesce(p_payload->>'notes',''));v_due:=(p_payload->>'due_date')::date;
  if jsonb_typeof(p_payload->'amount_cents') is distinct from 'number' or (p_payload->>'amount_cents')!~'^\d+$' then raise exception 'BANK_RECEIVABLE_INVALID';end if;
  v_amount:=(p_payload->>'amount_cents')::bigint;
 exception when others then raise exception 'BANK_RECEIVABLE_INVALID';end;
 if v_id is null or v_title is null or length(v_title) not between 2 and 160 or length(v_payer)>160 or v_kind is null or v_kind not in('CLIENTE','BANCO','CARTAO') or length(v_bank)>120 or length(v_notes)>2000 or v_amount not between 0 and 1000000000 or v_due is not null and (v_due<date '2000-01-01' or v_due>date '2100-12-31' or to_char(v_due,'YYYY-MM-DD')<>p_payload->>'due_date') then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text,4));
 -- Source first, then obligation: same lock order as sale edits and receipt confirmation.
 select e.* into s from public.icom_bank_admin_entries e join public.icom_bank_receivables q on q.source_entry_id=e.id where q.id=v_id for update of e;
 select * into r from public.icom_bank_receivables where id=v_id for update;
 if found then
  if p_expected is null then
   if r.source_entry_id is null and r.title=v_title and r.payer=v_payer and r.kind=v_kind and r.bank=v_bank and r.notes=v_notes and r.amount_cents=v_amount and r.due_date is not distinct from v_due then return to_jsonb(r);end if;raise exception 'BANK_RECEIVABLE_CHANGED';
  end if;
  if r.updated_at is distinct from p_expected then raise exception 'BANK_RECEIVABLE_CHANGED';end if;
  if not r.active or r.received_cents>=r.amount_cents then raise exception 'BANK_RECEIVABLE_CLOSED';end if;
  if r.source_entry_id is not null and r.amount_cents<>v_amount or r.received_cents>0 and r.amount_cents<>v_amount then raise exception 'BANK_RECEIVABLE_SOURCE_LOCKED';end if;
  if r.source_entry_id is null and (v_due is null or v_amount=0) then raise exception 'BANK_RECEIVABLE_INVALID';end if;
  update public.icom_bank_receivables set title=v_title,payer=v_payer,kind=v_kind,bank=v_bank,notes=v_notes,due_date=v_due,amount_cents=v_amount,updated_at=clock_timestamp() where id=v_id returning * into r;return to_jsonb(r);
 end if;
 if p_expected is not null then raise exception 'BANK_RECEIVABLE_CHANGED';end if;
 if v_due is null or v_amount=0 then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 insert into public.icom_bank_receivables(id,title,payer,kind,bank,notes,due_date,amount_cents) values(v_id,v_title,v_payer,v_kind,v_bank,v_notes,v_due,v_amount) returning * into r;return to_jsonb(r);
end $$;
revoke all on function public.icom_bank_save_receivable(jsonb,timestamptz) from public,anon;
grant execute on function public.icom_bank_save_receivable(jsonb,timestamptz) to authenticated;

create function public.icom_bank_receive(p_id uuid,p_request uuid,p_amount numeric,p_date date,p_method text,p_existing uuid,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.icom_bank_receivables;s public.icom_bank_admin_entries;e public.icom_bank_admin_entries;p public.icom_bank_receipts;v_ledger uuid:=coalesce(p_existing,p_request);today date:=(now() at time zone 'America/Sao_Paulo')::date;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_request is null or p_expected is null or p_amount is null or p_amount<>trunc(p_amount) or p_amount not between 1 and 1000000000 or p_date is null or p_date<date '2000-01-01' or p_date>today or p_method is null or p_method not in('PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO') then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 select a.* into s from public.icom_bank_admin_entries a join public.icom_bank_receivables q on q.source_entry_id=a.id where q.id=p_id for update of a;
 select * into r from public.icom_bank_receivables where id=p_id for update;
 if not found then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 select * into p from public.icom_bank_receipts where id=p_request;
 if found then
  if p.active and p.receivable_id=p_id and p.ledger_entry_id=v_ledger and p.amount_cents=p_amount and p.received_at=p_date and p.method=p_method then return to_jsonb(r);end if;raise exception 'BANK_RECEIVABLE_CLOSED';
 end if;
 if r.updated_at is distinct from p_expected then raise exception 'BANK_RECEIVABLE_CHANGED';end if;
 if not r.active or p_amount>r.amount_cents-r.received_cents or r.source_entry_id is not null and (not s.active or s.status<>'REALIZADO' or p_date<s.entry_date) then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_ledger::text,5));
 if exists(select 1 from public.icom_bank_receipts where ledger_entry_id=v_ledger) then raise exception 'BANK_RECEIVABLE_EXISTING';end if;
 if p_existing is not null then
  select * into e from public.icom_bank_admin_entries where id=p_existing for update;
  if not found or not e.active or e.kind<>'ENTRADA' or e.scope<>'LOJA' or e.status<>'REALIZADO' or e.amount_cents<>p_amount or e.entry_date<>p_date or e.details->>'payment_method' is distinct from p_method then raise exception 'BANK_RECEIVABLE_EXISTING';end if;
 else
  if exists(select 1 from public.icom_bank_admin_entries where id=p_request) then raise exception 'BANK_RECEIVABLE_EXISTING';end if;
  perform public.icom_bank_save_admin_entry(jsonb_build_object('id',p_request,'kind','ENTRADA','scope','LOJA','entry_date',p_date,'description',left('Recebimento · '||r.title,160),'category','Contas a receber','status','REALIZADO','amount_cents',p_amount,'details',jsonb_build_object('payment_method',p_method,'notes','Conta a receber '||p_id::text)),null);
 end if;
 insert into public.icom_bank_receipts(id,receivable_id,ledger_entry_id,amount_cents,received_at,method) values(p_request,p_id,v_ledger,p_amount,p_date,p_method);
 update public.icom_bank_receivables set received_cents=received_cents+p_amount,updated_at=clock_timestamp() where id=p_id returning * into r;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'CONTA_RECEBIDA',p_id,'{"module":"CONTAS_A_RECEBER"}');return to_jsonb(r);
exception when unique_violation then raise exception 'BANK_RECEIVABLE_EXISTING';end $$;
revoke all on function public.icom_bank_receive(uuid,uuid,numeric,date,text,uuid,timestamptz) from public,anon;
grant execute on function public.icom_bank_receive(uuid,uuid,numeric,date,text,uuid,timestamptz) to authenticated;

create function public.icom_bank_reverse_receipt(p_id uuid,p_receipt uuid,p_reason text,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.icom_bank_receivables;s public.icom_bank_admin_entries;e public.icom_bank_admin_entries;p public.icom_bank_receipts;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_receipt is null or p_expected is null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 select a.* into s from public.icom_bank_admin_entries a join public.icom_bank_receivables q on q.source_entry_id=a.id where q.id=p_id for update of a;
 select * into r from public.icom_bank_receivables where id=p_id for update;
 if not found or not r.active then raise exception 'BANK_RECEIVABLE_CLOSED';end if;
 select * into p from public.icom_bank_receipts where id=p_receipt and receivable_id=p_id for update;
 if not found then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 if not p.active then return to_jsonb(r);end if;
 if r.updated_at is distinct from p_expected then raise exception 'BANK_RECEIVABLE_CHANGED';end if;
 select * into strict e from public.icom_bank_admin_entries where id=p.ledger_entry_id for update;
 update public.icom_bank_receipts set active=false,reason=trim(p_reason),updated_at=clock_timestamp() where id=p_receipt;
 perform public.icom_bank_archive_admin_entry(e.id,false,e.updated_at);
 update public.icom_bank_receivables set received_cents=received_cents-p.amount_cents,updated_at=clock_timestamp() where id=p_id returning * into r;
 insert into public.icom_bank_receivable_history(receivable_id,actor_id,next) values(p_id,auth.uid(),jsonb_build_object('action','RECEBIMENTO_DESFEITO','receipt_id',p_receipt,'reason',trim(p_reason)));
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'RECEBIMENTO_DESFEITO',p_id,'{"module":"CONTAS_A_RECEBER"}');return to_jsonb(r);
end $$;
revoke all on function public.icom_bank_reverse_receipt(uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.icom_bank_reverse_receipt(uuid,uuid,text,timestamptz) to authenticated;

create function public.icom_bank_archive_receivable(p_id uuid,p_active boolean,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.icom_bank_receivables;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_active is null or p_expected is null then raise exception 'BANK_RECEIVABLE_INVALID';end if;
 select * into r from public.icom_bank_receivables where id=p_id for update;
 if not found or r.source_entry_id is not null or r.received_cents>0 then raise exception 'BANK_RECEIVABLE_CLOSED';end if;
 if r.active=p_active then return to_jsonb(r);end if;
 if r.updated_at is distinct from p_expected then raise exception 'BANK_RECEIVABLE_CHANGED';end if;
 update public.icom_bank_receivables set active=p_active,updated_at=clock_timestamp() where id=p_id returning * into r;return to_jsonb(r);
end $$;
revoke all on function public.icom_bank_archive_receivable(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.icom_bank_archive_receivable(uuid,boolean,timestamptz) to authenticated;
notify pgrst,'reload schema';
