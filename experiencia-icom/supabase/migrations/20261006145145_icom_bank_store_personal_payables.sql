-- Extend the owner's existing obligation ledger; recording an obligation never creates cash.
alter table public.icom_bank_payables alter column stock_id drop not null;
alter table public.icom_bank_payables drop constraint icom_bank_payables_kind_check;
alter table public.icom_bank_payables add constraint bank_payable_kind check(kind in('IPVA','MULTAS','QUITACAO','DESPESA'));
alter table public.icom_bank_payables
 add column scope text not null default 'LOJA' check(scope in('LOJA','PESSOAL')),
 add column person text not null default 'AMBOS' check(person in('BRUNO','GISELA','AMBOS')),
 add column title text not null default '' check(length(title)<=160),
 add column category text not null default '' check(length(category)<=80),
 add column series_id uuid,add column series_index smallint,add column series_count smallint not null default 1 check(series_count between 1 and 60),
 add constraint bank_payable_origin check((stock_id is not null and kind<>'DESPESA' and scope='LOJA' and person='AMBOS' and series_id is null) or (stock_id is null and kind='DESPESA' and length(trim(title))>=2 and amount_cents>0 and due_date is not null and bank='' and (scope='PESSOAL' or person='AMBOS'))),
 add constraint bank_payable_series check((series_id is null and series_index is null and series_count=1) or (kind='DESPESA' and series_id is not null and series_count>1 and series_index between 1 and series_count)),
 add constraint bank_payable_series_unique unique(series_id,series_index);
create index bank_payables_scope_due on public.icom_bank_payables(scope,due_date,id) where active and status='PENDENTE';

create function public.icom_bank_save_expense(p_payload jsonb,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_scope text;v_person text;v_title text;v_category text;v_notes text;v_amount bigint;v_due date;v_count integer;v_month date;v_date date;i integer;p public.icom_bank_payables;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>6000 or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('id','scope','person','title','category','notes','amount_cents','due_date','months')) then raise exception 'BANK_EXPENSE_INVALID';end if;
 if exists(select 1 from jsonb_each(p_payload) x where x.key in('id','scope','person','title','category','notes','due_date') and jsonb_typeof(x.value)<>'string') then raise exception 'BANK_EXPENSE_INVALID';end if;
 begin
  v_id:=(p_payload->>'id')::uuid;v_scope:=p_payload->>'scope';v_person:=p_payload->>'person';v_title:=trim(p_payload->>'title');v_category:=trim(coalesce(p_payload->>'category',''));v_notes:=trim(coalesce(p_payload->>'notes',''));v_due:=(p_payload->>'due_date')::date;
  if jsonb_typeof(p_payload->'amount_cents') is distinct from 'number' or (p_payload->>'amount_cents')!~'^\d+$' or jsonb_typeof(p_payload->'months') is distinct from 'number' or (p_payload->>'months')!~'^\d+$' then raise exception 'BANK_EXPENSE_INVALID';end if;
  v_amount:=(p_payload->>'amount_cents')::bigint;v_count:=(p_payload->>'months')::integer;
 exception when others then raise exception 'BANK_EXPENSE_INVALID';end;
 if v_id is null or v_scope is null or v_scope not in('LOJA','PESSOAL') or v_person is null or v_person not in('BRUNO','GISELA','AMBOS') or v_scope='LOJA' and v_person<>'AMBOS' or v_title is null or length(v_title) not between 2 and 160 or length(v_category)>80 or length(v_notes)>2000 or v_amount not between 1 and 1000000000 or v_count not between 1 and 60 or v_due is null or v_due<date '2000-01-01' or v_due>date '2100-12-31' or (p_payload->>'due_date')!~'^\d{4}-\d{2}-\d{2}$' or to_char(v_due,'YYYY-MM-DD')<>p_payload->>'due_date' then raise exception 'BANK_EXPENSE_INVALID';end if;
 if date_trunc('month',v_due)+make_interval(months=>v_count-1)>date '2100-12-01' then raise exception 'BANK_EXPENSE_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text,3));
 select * into p from public.icom_bank_payables where id=v_id for update;
 if found then
  if p.stock_id is not null then raise exception 'BANK_EXPENSE_INVALID';end if;
  if p_expected is null then
   if p.title=v_title and p.scope=v_scope and p.person=v_person and p.category=v_category and p.notes=v_notes and p.amount_cents=v_amount and p.due_date=v_due and p.series_count=v_count then return jsonb_build_object('created',false,'count',v_count,'row',to_jsonb(p));end if;raise exception 'BANK_PAYABLE_CHANGED';
  end if;
  if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;
  if not p.active or p.status<>'PENDENTE' then raise exception 'BANK_PAYABLE_CLOSED';end if;
  if v_count<>1 then raise exception 'BANK_EXPENSE_INVALID';end if;
  update public.icom_bank_payables set title=v_title,scope=v_scope,person=v_person,category=v_category,notes=v_notes,amount_cents=v_amount,due_date=v_due,updated_at=clock_timestamp() where id=v_id returning * into p;
  return jsonb_build_object('created',false,'count',1,'row',to_jsonb(p));
 end if;
 if p_expected is not null then raise exception 'BANK_PAYABLE_CHANGED';end if;
 for i in 0..v_count-1 loop
  v_month:=(date_trunc('month',v_due)+make_interval(months=>i))::date;
  v_date:=v_month+least(extract(day from v_due)::integer,extract(day from v_month+interval '1 month - 1 day')::integer)-1;
  insert into public.icom_bank_payables(id,stock_id,kind,scope,person,title,category,notes,amount_cents,due_date,series_id,series_index,series_count)
   values(case when i=0 then v_id else gen_random_uuid() end,null,'DESPESA',v_scope,v_person,v_title,v_category,v_notes,v_amount,v_date,case when v_count>1 then v_id end,case when v_count>1 then i+1 end,v_count);
 end loop;
 select * into p from public.icom_bank_payables where id=v_id;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'CONTAS_CADASTRADAS',v_id,'{"module":"CONTAS_A_PAGAR"}');
 return jsonb_build_object('created',true,'count',v_count,'row',to_jsonb(p));
end $$;
revoke all on function public.icom_bank_save_expense(jsonb,timestamptz) from public,anon;
grant execute on function public.icom_bank_save_expense(jsonb,timestamptz) to authenticated;

create function public.icom_bank_archive_expense(p_id uuid,p_active boolean,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$ declare p public.icom_bank_payables;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_active is null or p_expected is null then raise exception 'BANK_EXPENSE_INVALID';end if;
 select * into p from public.icom_bank_payables where id=p_id for update;
 if not found or p.stock_id is not null or p.status<>'PENDENTE' then raise exception 'BANK_PAYABLE_CLOSED';end if;
 if p.active=p_active then return to_jsonb(p);end if;
 if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;
 update public.icom_bank_payables set active=p_active,updated_at=clock_timestamp() where id=p_id returning * into p;return to_jsonb(p);
end $$;
revoke all on function public.icom_bank_archive_expense(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.icom_bank_archive_expense(uuid,boolean,timestamptz) to authenticated;

create or replace function public.icom_bank_schedule_payable(p_id uuid,p_due date,p_notes text,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.icom_bank_payables;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_expected is null or p_notes is null or length(p_notes)>2000 or p_due<date '2000-01-01' or p_due>date '2100-12-31' then raise exception 'BANK_PAYABLE_INVALID';end if;
 select * into p from public.icom_bank_payables where id=p_id for update;
 if p.stock_id is null and p_due is null then raise exception 'BANK_EXPENSE_INVALID';end if;
 if not found or not p.active or p.status<>'PENDENTE' then raise exception 'BANK_PAYABLE_CLOSED';end if;
 if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;
 update public.icom_bank_payables set due_date=p_due,notes=trim(p_notes),updated_at=clock_timestamp() where id=p_id returning * into p;return to_jsonb(p);
end $$;

create or replace function public.icom_bank_pay_trade_debt(p_id uuid,p_request uuid,p_paid date,p_method text,p_receipt uuid,p_existing uuid,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.icom_bank_payables;s public.icom_bank_stock_vehicles;e public.icom_bank_admin_entries;row_json jsonb;v_ledger uuid;v_kind text;v_desc text;v_details jsonb;today date:=(now() at time zone 'America/Sao_Paulo')::date;begin
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
 if not p.active or p.amount_cents<=0 or p.stock_id is not null and (not s.active or s.status='PREVISTO' or p_paid<s.entry_date) then raise exception 'BANK_PAYABLE_INVALID';end if;
 if p.updated_at is distinct from p_expected then raise exception 'BANK_PAYABLE_CHANGED';end if;
 if p_receipt is not null and not exists(select 1 from public.icom_bank_payable_files f where f.id=p_receipt and f.payable_id=p_id and f.status='ANEXADO') then raise exception 'BANK_PAYABLE_FILE';end if;
 if p_existing is not null then
  select * into e from public.icom_bank_admin_entries where id=p_existing and active and scope=p.scope and ((p.scope='LOJA' and kind in('CUSTO','MENSAL')) or (p.scope='PESSOAL' and kind in('PESSOAL','MENSAL'))) and status='REALIZADO' and not(details ? 'stock_id') for update;
  if e.id is null or e.amount_cents<>p.amount_cents or e.entry_date<>p_paid or e.details->>'payment_method' is distinct from p_method or exists(select 1 from icom_bank_internal.payable_ledger_links where ledger_entry_id=e.id) then raise exception 'BANK_PAYABLE_EXISTING';end if;
 else
  if exists(select 1 from public.icom_bank_admin_entries where id=p_request) then raise exception 'BANK_PAYABLE_EXISTING';end if;
  v_kind:=case when p.scope='PESSOAL' then 'PESSOAL' else 'CUSTO' end;
  v_desc:=case when p.stock_id is null then p.title else case p.kind when 'QUITACAO' then 'Quitação' when 'MULTAS' then 'Multas' else 'IPVA' end||' da troca · '||s.plate end;
  v_details:=jsonb_build_object('payment_method',p_method,'notes','Conta a pagar '||p.id::text);
  if p.stock_id is not null then v_details:=v_details||jsonb_build_object('vehicle',left(coalesce(s.vehicle->>'brand','')||' '||coalesce(s.vehicle->>'model',''),160),'plate',s.plate);end if;
  row_json:=public.icom_bank_save_admin_entry(jsonb_build_object('id',p_request,'kind',v_kind,'scope',p.scope,'entry_date',p_paid,'description',v_desc,'category',case when p.stock_id is not null then 'Débitos da troca' else p.category end,'status','REALIZADO','amount_cents',p.amount_cents,'details',v_details),null);
 end if;
 insert into icom_bank_internal.payable_ledger_links(ledger_entry_id,payable_id) values(v_ledger,p_id);
 update public.icom_bank_payables set status='PAGO',paid_at=p_paid,method=p_method,ledger_entry_id=v_ledger,receipt_id=p_receipt,updated_at=clock_timestamp() where id=p_id returning * into p;
 if s.status='AGUARDANDO_QUITACAO' and not exists(select 1 from public.icom_bank_payables where stock_id=s.id and active and status='PENDENTE') then update public.icom_bank_stock_vehicles set status='EM_PREPARACAO',updated_at=clock_timestamp() where id=s.id;end if;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'CONTA_PAGA',p.id,'{"module":"CONTAS_A_PAGAR"}');return to_jsonb(p);
exception when unique_violation then raise exception 'BANK_PAYABLE_EXISTING';end $$;

create or replace function public.icom_bank_reverse_payable(p_id uuid,p_reason text,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if p.stock_id is not null and s.status<>'VENDIDO' then update public.icom_bank_stock_vehicles set status='AGUARDANDO_QUITACAO',updated_at=clock_timestamp() where id=s.id;end if;
 insert into public.icom_bank_payable_history(payable_id,actor_id,previous,next) values(p.id,auth.uid(),null,jsonb_build_object('action','BAIXA_DESFEITA','reason',trim(p_reason),'ledger_entry_id',e.id));
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'BAIXA_DESFEITA',p.id,'{"module":"CONTAS_A_PAGAR"}');return to_jsonb(p);
end $$;


notify pgrst,'reload schema';
