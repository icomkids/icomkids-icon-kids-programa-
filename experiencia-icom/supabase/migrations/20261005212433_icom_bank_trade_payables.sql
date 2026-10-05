-- Trade obligations remain owner-only. Confirmations record internal cash outflows, not bank transfers.
create table public.icom_bank_payables(
 id uuid primary key default gen_random_uuid(),stock_id uuid not null references public.icom_bank_stock_vehicles(id),
 kind text not null check(kind in('IPVA','MULTAS','QUITACAO')),amount_cents bigint not null check(amount_cents between 0 and 1000000000),bank text not null default '',
 due_date date check(due_date between date '2000-01-01' and date '2100-12-31'),notes text not null default '' check(length(notes)<=2000),active boolean not null default true,
 status text not null default 'PENDENTE' check(status in('PENDENTE','PAGO')),paid_at date,method text,ledger_entry_id uuid unique references public.icom_bank_admin_entries(id),receipt_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp(),unique(stock_id,kind),
 check((status='PAGO' and paid_at is not null and ledger_entry_id is not null and method is not null and method in('PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO')) or (status='PENDENTE' and paid_at is null and ledger_entry_id is null and method is null and receipt_id is null))
);
create index bank_payables_due on public.icom_bank_payables(due_date,id) where active and status='PENDENTE';
create table public.icom_bank_payable_files(
 id uuid primary key,payable_id uuid not null references public.icom_bank_payables(id),submitted_by uuid not null references auth.users(id),object_path text not null unique,
 mime_type text not null check(mime_type in('image/jpeg','image/png','application/pdf')),size_bytes bigint not null check(size_bytes between 1 and 10485760),file_sha256 text not null check(file_sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'RESERVADO' check(status in('RESERVADO','ANEXADO')),expires_at timestamptz not null default now()+interval '1 hour',created_at timestamptz not null default now()
);
create index bank_payable_files_bill on public.icom_bank_payable_files(payable_id);
create index bank_payable_files_actor on public.icom_bank_payable_files(submitted_by);
alter table public.icom_bank_payables add foreign key(receipt_id) references public.icom_bank_payable_files(id);
create index bank_payables_receipt on public.icom_bank_payables(receipt_id);
create table public.icom_bank_payable_history(id uuid primary key default gen_random_uuid(),payable_id uuid not null references public.icom_bank_payables(id),actor_id uuid references auth.users(id),previous jsonb,next jsonb not null,created_at timestamptz not null default now());
create index bank_payable_history_bill on public.icom_bank_payable_history(payable_id,created_at);
create index bank_payable_history_actor on public.icom_bank_payable_history(actor_id);
create table icom_bank_internal.payable_ledger_links(ledger_entry_id uuid primary key references public.icom_bank_admin_entries(id),payable_id uuid not null references public.icom_bank_payables(id),reversed boolean not null default false);
create index bank_payable_links_bill on icom_bank_internal.payable_ledger_links(payable_id);
revoke all on icom_bank_internal.payable_ledger_links from public,anon,authenticated;
alter table public.icom_bank_payables enable row level security;
alter table public.icom_bank_payable_files enable row level security;
alter table public.icom_bank_payable_history enable row level security;
revoke all on public.icom_bank_payables,public.icom_bank_payable_files,public.icom_bank_payable_history from anon,authenticated;
grant select on public.icom_bank_payables,public.icom_bank_payable_files,public.icom_bank_payable_history to authenticated;
create policy bank_payables_owner on public.icom_bank_payables for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_payable_files_owner on public.icom_bank_payable_files for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_payable_history_owner on public.icom_bank_payable_history for select to authenticated using((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');
create policy bank_payable_files_storage_read on storage.objects for select to authenticated using(bucket_id='icom-bank-documents' and (select icom_bank_internal.role())='OWNER' and exists(select 1 from public.icom_bank_payable_files f where f.object_path=objects.name and f.status='ANEXADO'));
create policy bank_payable_files_storage_insert on storage.objects for insert to authenticated with check(bucket_id='icom-bank-documents' and (select icom_bank_internal.role())='OWNER' and exists(select 1 from public.icom_bank_payable_files f where f.object_path=objects.name and f.submitted_by=(select auth.uid()) and f.status='RESERVADO' and f.expires_at>now()));

create function icom_bank_internal.audit_payable() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.icom_bank_payable_history(payable_id,actor_id,previous,next) values(new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end $$;
revoke all on function icom_bank_internal.audit_payable() from public,anon,authenticated;
create trigger bank_payable_audit after insert or update on public.icom_bank_payables for each row execute function icom_bank_internal.audit_payable();

create function icom_bank_internal.sync_trade_payables() returns trigger language plpgsql security definer set search_path='' as $$
declare k text;a bigint;b text;enabled boolean;p public.icom_bank_payables;begin
 foreach k in array array['IPVA','MULTAS','QUITACAO'] loop
  a:=case when new.source_details->>'trade_has_debts'='true' then case k when 'IPVA' then coalesce((new.source_details->>'trade_ipva_cents')::bigint,0) when 'MULTAS' then coalesce((new.source_details->>'trade_fines_cents')::bigint,0) else case when new.source_details->>'trade_has_payoff'='true' then coalesce((new.source_details->>'trade_payoff_cents')::bigint,0) else 0 end end else 0 end;
  b:=case when k='QUITACAO' then coalesce(case when new.source_details->>'trade_payoff_bank'='OUTRO' then new.source_details->>'trade_payoff_bank_other' else new.source_details->>'trade_payoff_bank' end,'') else '' end;
  enabled:=new.active and a>0;
  select * into p from public.icom_bank_payables where stock_id=new.id and kind=k for update;
  if p.id is not null and p.status='PAGO' and (not enabled or p.amount_cents<>a or p.bank<>b or new.status='PREVISTO' or p.paid_at<new.entry_date or tg_op='UPDATE' and old.plate<>new.plate) then raise exception 'BANK_PAYABLE_SOURCE_LOCKED';end if;
  if p.id is null then
   if a>0 then insert into public.icom_bank_payables(stock_id,kind,amount_cents,bank,active) values(new.id,k,a,b,enabled);end if;
  elsif p.amount_cents<>a or p.bank<>b or p.active<>enabled then
   update public.icom_bank_payables set amount_cents=a,bank=b,active=enabled,updated_at=clock_timestamp() where id=p.id;
  end if;
 end loop;return new;
end $$;
revoke all on function icom_bank_internal.sync_trade_payables() from public,anon,authenticated;
create trigger bank_stock_trade_payables after insert or update on public.icom_bank_stock_vehicles for each row execute function icom_bank_internal.sync_trade_payables();
-- Backfill obligations without touching historical stock rows, due dates or cash.
insert into public.icom_bank_payables(stock_id,kind,amount_cents,bank,active)
select s.id,v.kind,v.amount,case when v.kind='QUITACAO' then coalesce(case when s.source_details->>'trade_payoff_bank'='OUTRO' then s.source_details->>'trade_payoff_bank_other' else s.source_details->>'trade_payoff_bank' end,'') else '' end,s.active
from public.icom_bank_stock_vehicles s cross join lateral(values
 ('IPVA',coalesce((s.source_details->>'trade_ipva_cents')::bigint,0)),
 ('MULTAS',coalesce((s.source_details->>'trade_fines_cents')::bigint,0)),
 ('QUITACAO',case when s.source_details->>'trade_has_payoff'='true' then coalesce((s.source_details->>'trade_payoff_cents')::bigint,0) else 0 end)
) v(kind,amount) where s.source_details->>'trade_has_debts'='true' and v.amount>0;

create function icom_bank_internal.guard_paid_payable_entry() returns trigger language plpgsql security definer set search_path='' as $$ declare link icom_bank_internal.payable_ledger_links;begin
 select * into link from icom_bank_internal.payable_ledger_links where ledger_entry_id=old.id;
 if found and to_jsonb(old)-'updated_at' is distinct from to_jsonb(new)-'updated_at' then
  if not(link.reversed and old.active and not new.active and to_jsonb(old)-array['active','updated_at'] is not distinct from to_jsonb(new)-array['active','updated_at'] and exists(select 1 from public.icom_bank_payables p where p.id=link.payable_id and p.status='PENDENTE')) then raise exception 'BANK_PAYABLE_LEDGER_LOCKED';end if;
 end if;return new;
end $$;
revoke all on function icom_bank_internal.guard_paid_payable_entry() from public,anon,authenticated;
create trigger bank_payable_entry_guard before update on public.icom_bank_admin_entries for each row execute function icom_bank_internal.guard_paid_payable_entry();

create function public.icom_bank_schedule_payable(p_id uuid,p_due date,p_notes text,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.icom_bank_payables;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_expected is null or p_notes is null or length(p_notes)>2000 or p_due<date '2000-01-01' or p_due>date '2100-12-31' then raise exception 'BANK_PAYABLE_INVALID';end if;
 select * into p from public.icom_bank_payables where id=p_id for update;
 if not found or not p.active or p.status<>'PENDENTE' then raise exception 'BANK_PAYABLE_CLOSED';end if;
 if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;
 update public.icom_bank_payables set due_date=p_due,notes=trim(p_notes),updated_at=clock_timestamp() where id=p_id returning * into p;return to_jsonb(p);
end $$;

create function public.icom_bank_pay_trade_debt(p_id uuid,p_request uuid,p_paid date,p_method text,p_receipt uuid,p_existing uuid,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.icom_bank_payables;s public.icom_bank_stock_vehicles;e public.icom_bank_admin_entries;row_json jsonb;v_ledger uuid;today date:=(now() at time zone 'America/Sao_Paulo')::date;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_request is null or p_expected is null or p_paid is null or p_paid<date '2000-01-01' or p_paid>today or p_method is null or p_method not in('PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO') then raise exception 'BANK_PAYABLE_INVALID';end if;
 select v.* into s from public.icom_bank_stock_vehicles v join public.icom_bank_payables q on q.stock_id=v.id where q.id=p_id for update of v;
 select * into p from public.icom_bank_payables where id=p_id for update;
 if p.id is null then raise exception 'BANK_PAYABLE_INVALID';end if;
 v_ledger:=coalesce(p_existing,p_request);
 if p.status='PAGO' then
  if p.ledger_entry_id=v_ledger and p.paid_at=p_paid and p.method=p_method and p.receipt_id is not distinct from p_receipt then return to_jsonb(p);end if;
  raise exception 'BANK_PAYABLE_CLOSED';
 end if;
 if not p.active or not s.active or s.status='PREVISTO' or p_paid<s.entry_date or p.amount_cents<=0 then raise exception 'BANK_PAYABLE_INVALID';end if;
 if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;
 if p_receipt is not null and not exists(select 1 from public.icom_bank_payable_files f where f.id=p_receipt and f.payable_id=p_id and f.status='ANEXADO') then raise exception 'BANK_PAYABLE_FILE';end if;
 if p_existing is not null then
  select * into e from public.icom_bank_admin_entries where id=p_existing and active and kind='CUSTO' and scope='LOJA' and status='REALIZADO' and not(details ? 'stock_id') for update;
  if e.id is null or e.amount_cents<>p.amount_cents or e.entry_date<>p_paid or e.details->>'payment_method' is distinct from p_method or exists(select 1 from icom_bank_internal.payable_ledger_links where ledger_entry_id=e.id) then raise exception 'BANK_PAYABLE_EXISTING';end if;
 else
  if exists(select 1 from public.icom_bank_admin_entries where id=p_request) then raise exception 'BANK_PAYABLE_EXISTING';end if;
  row_json:=public.icom_bank_save_admin_entry(jsonb_build_object('id',p_request,'kind','CUSTO','scope','LOJA','entry_date',p_paid,'description',case p.kind when 'QUITACAO' then 'Quitação' when 'MULTAS' then 'Multas' else 'IPVA' end||' da troca · '||s.plate,'category','Débitos da troca','status','REALIZADO','amount_cents',p.amount_cents,'details',jsonb_build_object('vehicle',left(coalesce(s.vehicle->>'brand','')||' '||coalesce(s.vehicle->>'model',''),160),'plate',s.plate,'payment_method',p_method,'notes','Conta a pagar '||p.id::text)),null);
 end if;
 insert into icom_bank_internal.payable_ledger_links(ledger_entry_id,payable_id) values(v_ledger,p_id);
 update public.icom_bank_payables set status='PAGO',paid_at=p_paid,method=p_method,ledger_entry_id=v_ledger,receipt_id=p_receipt,updated_at=clock_timestamp() where id=p_id returning * into p;
 if s.status='AGUARDANDO_QUITACAO' and not exists(select 1 from public.icom_bank_payables where stock_id=s.id and active and status='PENDENTE') then update public.icom_bank_stock_vehicles set status='EM_PREPARACAO',updated_at=clock_timestamp() where id=s.id;end if;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'CONTA_PAGA',p.id,'{"module":"CONTAS_A_PAGAR"}');return to_jsonb(p);
exception when unique_violation then raise exception 'BANK_PAYABLE_EXISTING';end $$;

create function public.icom_bank_reverse_payable(p_id uuid,p_reason text,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.icom_bank_payables;s public.icom_bank_stock_vehicles;e public.icom_bank_admin_entries;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_expected is null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'BANK_PAYABLE_INVALID';end if;
 select v.* into s from public.icom_bank_stock_vehicles v join public.icom_bank_payables q on q.stock_id=v.id where q.id=p_id for update of v;
 select * into p from public.icom_bank_payables where id=p_id for update;
 if p.id is null or not p.active then raise exception 'BANK_PAYABLE_CLOSED';end if;
 if p.status='PENDENTE' then return to_jsonb(p);end if;
 if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;
 select * into strict e from public.icom_bank_admin_entries where id=p.ledger_entry_id for update;
 update icom_bank_internal.payable_ledger_links set reversed=true where ledger_entry_id=e.id;
 update public.icom_bank_payables set status='PENDENTE',paid_at=null,method=null,ledger_entry_id=null,receipt_id=null,updated_at=clock_timestamp() where id=p_id returning * into p;
 perform public.icom_bank_archive_admin_entry(e.id,false,e.updated_at);
 if s.status<>'VENDIDO' then update public.icom_bank_stock_vehicles set status='AGUARDANDO_QUITACAO',updated_at=clock_timestamp() where id=s.id;end if;
 insert into public.icom_bank_payable_history(payable_id,actor_id,previous,next) values(p.id,auth.uid(),null,jsonb_build_object('action','BAIXA_DESFEITA','reason',trim(p_reason),'ledger_entry_id',e.id));
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'BAIXA_DESFEITA',p.id,'{"module":"CONTAS_A_PAGAR"}');return to_jsonb(p);
end $$;

create function public.icom_bank_reserve_payable_file(p_id uuid,p_bill uuid,p_mime text,p_size bigint,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.icom_bank_payable_files;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_bill is null or p_mime is null or p_mime not in('image/jpeg','image/png','application/pdf') or p_size is null or p_size not between 1 and 10485760 or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or not exists(select 1 from public.icom_bank_payables where id=p_bill and active and status='PENDENTE') then raise exception 'BANK_PAYABLE_FILE';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,2));
 select * into f from public.icom_bank_payable_files where id=p_id;
 if found then
  if f.payable_id<>p_bill or f.submitted_by<>auth.uid() or f.mime_type<>p_mime or f.size_bytes<>p_size or f.file_sha256<>p_hash or f.status='RESERVADO' and f.expires_at<=now() then raise exception 'BANK_PAYABLE_FILE';end if;return to_jsonb(f);
 end if;
 insert into public.icom_bank_payable_files(id,payable_id,submitted_by,object_path,mime_type,size_bytes,file_sha256) values(p_id,p_bill,auth.uid(),'payables/'||auth.uid()::text||'/'||p_id::text||case p_mime when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end,p_mime,p_size,p_hash) returning * into f;return to_jsonb(f);
end $$;
create function public.icom_bank_submit_payable_file(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.icom_bank_payable_files;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 select * into f from public.icom_bank_payable_files where id=p_id for update;
 if not found then raise exception 'BANK_PAYABLE_FILE';end if;
 if f.status='ANEXADO' then return to_jsonb(f);end if;
 if f.expires_at<=now() or not exists(select 1 from storage.objects o where o.bucket_id='icom-bank-documents' and o.name=f.object_path and (o.metadata->>'size')::bigint=f.size_bytes and o.metadata->>'mimetype'=f.mime_type) then raise exception 'BANK_PAYABLE_FILE';end if;
 update public.icom_bank_payable_files set status='ANEXADO' where id=p_id returning * into f;return to_jsonb(f);
end $$;
revoke all on function public.icom_bank_schedule_payable(uuid,date,text,timestamptz),public.icom_bank_pay_trade_debt(uuid,uuid,date,text,uuid,uuid,timestamptz),public.icom_bank_reverse_payable(uuid,text,timestamptz),public.icom_bank_reserve_payable_file(uuid,uuid,text,bigint,text),public.icom_bank_submit_payable_file(uuid) from public,anon;
grant execute on function public.icom_bank_schedule_payable(uuid,date,text,timestamptz),public.icom_bank_pay_trade_debt(uuid,uuid,date,text,uuid,uuid,timestamptz),public.icom_bank_reverse_payable(uuid,text,timestamptz),public.icom_bank_reserve_payable_file(uuid,uuid,text,bigint,text),public.icom_bank_submit_payable_file(uuid) to authenticated;
notify pgrst,'reload schema';
