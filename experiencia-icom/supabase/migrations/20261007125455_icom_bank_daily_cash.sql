-- Immutable owner-only reconciliation snapshots. Withdrawals use the existing
-- audited, idempotent ledger writer; no bank/payment integration is invoked.
create table public.icom_bank_cash_checks (
 id uuid primary key,
 check_date date not null check(check_date between date '2000-01-01' and date '2100-12-31'),
 observed_cents bigint not null check(abs(observed_cents::numeric)<=1000000000000),
 metrics jsonb not null check(jsonb_typeof(metrics)='object'),
 difference_cents bigint generated always as (observed_cents-(metrics->>'gross')::bigint) stored,
 notes text not null default '' check(length(notes)<=2000),
 ledger_revision text not null check(ledger_revision ~ '^[a-f0-9]{32}$'),
 actor_id uuid not null,
 actor_name text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index bank_cash_checks_day on public.icom_bank_cash_checks(check_date,created_at desc);
alter table public.icom_bank_cash_checks enable row level security;
revoke all on public.icom_bank_cash_checks from public,anon,authenticated;
grant select on public.icom_bank_cash_checks to authenticated;
create policy bank_cash_check_owner_read on public.icom_bank_cash_checks for select to authenticated
 using ((select auth.uid()) is not null and (select icom_bank_internal.role())='OWNER');

create function public.icom_bank_daily_context(p_day date) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare entries jsonb;revision text;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_day is null or p_day<date '2000-01-01' or p_day>(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'BANK_CHECK_INVALID';end if;
 entries:=public.icom_bank_cash_entries();
 select md5(coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb)::text) into revision
 from jsonb_array_elements(entries) where (value->>'entry_date')::date<=p_day;
 return jsonb_build_object('entries',entries,'revision',revision);
end $$;
revoke all on function public.icom_bank_daily_context(date) from public,anon;
grant execute on function public.icom_bank_daily_context(date) to authenticated;

create function public.icom_bank_save_cash_check(p_id uuid,p_day date,p_observed bigint,p_notes text,p_revision text,p_metrics jsonb)
 returns public.icom_bank_cash_checks language plpgsql security definer set search_path='' as $$
declare r public.icom_bank_cash_checks;ctx jsonb;k text;name text;gross bigint;income bigint;expenses bigint;personal bigint;opening bigint;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_day is null or p_observed is null or abs(p_observed::numeric)>1000000000000 or p_notes is null or length(p_notes)>2000 or p_revision is null or p_revision!~'^[a-f0-9]{32}$' or jsonb_typeof(p_metrics) is distinct from 'object' or length(p_metrics::text)>2500 then raise exception 'BANK_CHECK_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into r from public.icom_bank_cash_checks where id=p_id;
 if found then
  if r.actor_id=auth.uid() and r.check_date=p_day and r.observed_cents=p_observed and r.notes=btrim(p_notes) then return r;end if;
  raise exception 'BANK_CHECK_CHANGED';
 end if;
 ctx:=public.icom_bank_daily_context(p_day);
 if ctx->>'revision' is distinct from p_revision then raise exception 'BANK_CHECK_CHANGED';end if;
 if not (p_metrics ?& array['opening_gross','opening_available','income','expenses','personal','gross','investor','capital','costs','review','available']) or (select count(*) from jsonb_object_keys(p_metrics))<>11 then raise exception 'BANK_CHECK_INVALID';end if;
 for k in select jsonb_object_keys(p_metrics) loop
  if jsonb_typeof(p_metrics->k) is distinct from 'number' or (p_metrics->>k)!~'^-?\d+$' or abs((p_metrics->>k)::numeric)>1000000000000000 then raise exception 'BANK_CHECK_INVALID';end if;
  if k in ('income','expenses','personal','investor','capital','costs','review') and (p_metrics->>k)::bigint<0 then raise exception 'BANK_CHECK_INVALID';end if;
 end loop;
 -- Independently verify actual recorded money and the day's movement in SQL.
 with e as (select value x from jsonb_array_elements(ctx->'entries') where value->>'active'='true' and value->>'status'='REALIZADO' and (value->>'entry_date')::date<=p_day),
 a as (select x,(x->>'entry_date')::date as entry_day,case when x->>'kind' in ('VENDA','ENTRADA','RETORNO') then coalesce((x->>'amount_cents')::bigint,0) else 0 end i,
 case when x->>'scope'='LOJA' and x->>'kind' in ('CUSTO','MENSAL') then coalesce((x->>'amount_cents')::bigint,0) when x->>'kind'='RETORNO' then coalesce((x->'details'->>'tax_cents')::bigint,0)+coalesce((x->'details'->>'manager_cents')::bigint,0)+coalesce((x->'details'->>'seller_cents')::bigint,0) else 0 end o,
 case when x->>'scope'='PESSOAL' then coalesce((x->>'amount_cents')::bigint,0) else 0 end p from e)
 select coalesce(sum(i-o-p),0),coalesce(sum(i) filter(where entry_day=p_day),0),coalesce(sum(o) filter(where entry_day=p_day),0),coalesce(sum(p) filter(where entry_day=p_day),0),coalesce(sum(i-o-p) filter(where entry_day<p_day),0)
 into gross,income,expenses,personal,opening from a;
 if (p_metrics->>'gross')::bigint<>gross or (p_metrics->>'income')::bigint<>income or (p_metrics->>'expenses')::bigint<>expenses or (p_metrics->>'personal')::bigint<>personal or (p_metrics->>'opening_gross')::bigint<>opening then raise exception 'BANK_CHECK_CHANGED';end if;
 if p_observed<>gross and length(btrim(p_notes))<5 then raise exception 'BANK_CHECK_NOTE';end if;
 select a.name into name from public.icom_bank_user_access a where a.user_id=auth.uid() and a.active and a.role='OWNER';
 insert into public.icom_bank_cash_checks(id,check_date,observed_cents,metrics,notes,ledger_revision,actor_id,actor_name)
 values(p_id,p_day,p_observed,p_metrics,btrim(p_notes),p_revision,auth.uid(),coalesce(name,'Proprietário')) returning * into r;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'CONFERENCIA_CAIXA',p_id,'{"module":"ADMINISTRATIVO"}');
 return r;
end $$;
revoke all on function public.icom_bank_save_cash_check(uuid,date,bigint,text,text,jsonb) from public,anon;
grant execute on function public.icom_bank_save_cash_check(uuid,date,bigint,text,text,jsonb) to authenticated;

create function public.icom_bank_record_withdrawal(p_payload jsonb) returns jsonb
 language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'kind' is null or p_payload->>'kind' not in ('CUSTO','PESSOAL') or p_payload->>'status' is distinct from 'REALIZADO' or p_payload->>'category' is null or p_payload->>'category' not in ('Retirada / Pix','Devolução ao investidor') or coalesce(p_payload->>'amount_cents','')!~'^\d+$' or (p_payload->>'amount_cents')::numeric<=0 or coalesce(p_payload->'details'->>'payment_method','') not in ('PIX','TRANSFERENCIA','DINHEIRO') or length(coalesce(p_payload->'details'->>'notes',''))<10 then raise exception 'BANK_WITHDRAWAL_INVALID';end if;
 if p_payload->>'entry_date' is null or (p_payload->>'entry_date')::date>(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'BANK_WITHDRAWAL_INVALID';end if;
 if p_payload->>'category'='Devolução ao investidor' then
  if p_payload->>'kind' is distinct from 'CUSTO' or p_payload->'details'->>'settlement_part' is distinct from 'INVESTIDOR' or coalesce(p_payload->'details'->>'sale_cost_id','')='' then raise exception 'BANK_WITHDRAWAL_INVALID';end if;
 elsif (p_payload->'details') ?| array['sale_cost_id','settlement_part','stock_id'] then raise exception 'BANK_WITHDRAWAL_INVALID';end if;
 return public.icom_bank_save_admin_entry(p_payload,null);
end $$;
revoke all on function public.icom_bank_record_withdrawal(jsonb) from public,anon;
grant execute on function public.icom_bank_record_withdrawal(jsonb) to authenticated;
notify pgrst,'reload schema';
