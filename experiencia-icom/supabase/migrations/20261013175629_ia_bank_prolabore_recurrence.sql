-- Monthly schedules are forecasts until the owner confirms actual receipt.
alter table public.icom_bank_prolabore add column due_date date,add column series_id uuid,add column sequence_number integer not null default 1,add column months_count integer not null default 1;
alter table public.icom_bank_prolabore disable trigger guard_prolabore;
update public.icom_bank_prolabore set due_date=paid_at;
alter table public.icom_bank_prolabore enable trigger guard_prolabore;
alter table public.icom_bank_prolabore alter column due_date set not null,alter column paid_at drop not null;
alter table public.icom_bank_prolabore drop constraint icom_bank_prolabore_status_check;
alter table public.icom_bank_prolabore add constraint icom_bank_prolabore_status_check check(status in('PREVISTO','REALIZADO','CANCELADO')),
 add constraint bank_prolabore_schedule_check check(due_date between date '2000-01-01' and date '2100-12-31' and months_count between 1 and 60 and sequence_number between 1 and months_count and (series_id is not null or months_count=1) and (status<>'REALIZADO' or paid_at is not null) and (status<>'PREVISTO' or paid_at is null));
create unique index bank_prolabore_series_sequence on public.icom_bank_prolabore(series_id,sequence_number) where series_id is not null;
create index bank_prolabore_owner_due on public.icom_bank_prolabore(owner_id,due_date,id) where status='PREVISTO';

create or replace function icom_bank_internal.guard_prolabore() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' or new.owner_id<>auth.uid() then raise exception 'BANK_FORBIDDEN';end if;
 if tg_op='INSERT' then
  new.due_date:=coalesce(new.due_date,new.paid_at);
  if new.status not in('REALIZADO','PREVISTO') or new.reference_month<'2000-01' or new.reference_month>'2100-12' then raise exception 'BANK_PROLABORE_INVALID';end if;
  if new.series_id is not null and not (new.id=new.series_id and new.sequence_number=1) and not exists(select 1 from public.icom_bank_prolabore where id=new.series_id and owner_id=auth.uid() and sequence_number=1 and months_count=new.months_count) then raise exception 'BANK_PROLABORE_INVALID';end if;
  new.created_at:=clock_timestamp();
 else
  if new.id<>old.id or new.owner_id<>old.owner_id or new.created_at<>old.created_at or new.series_id is distinct from old.series_id or new.sequence_number<>old.sequence_number or new.months_count<>old.months_count or new.reference_month<>old.reference_month or new.due_date<>old.due_date then raise exception 'BANK_PROLABORE_CHANGED';end if;
  if new.status='CANCELADO' then
   if old.status not in('PREVISTO','REALIZADO') or (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at') then raise exception 'BANK_PROLABORE_CHANGED';end if;
   perform icom_bank_internal.require_deletion('cancel_prolabore',old.id);
  elsif old.status='PREVISTO' and new.status='REALIZADO' then
   if (to_jsonb(new)-'status'-'paid_at'-'updated_at') is distinct from (to_jsonb(old)-'status'-'paid_at'-'updated_at') then raise exception 'BANK_PROLABORE_CHANGED';end if;
  elsif old.status='PREVISTO' and new.status='PREVISTO' then
   if new.paid_at is not null then raise exception 'BANK_PROLABORE_INVALID';end if;
  else raise exception 'BANK_PROLABORE_CHANGED';end if;
 end if;
 if new.status<>'CANCELADO' then
  perform 1 from public.icom_bank_accounts where id in(new.source_account_id,new.target_account_id) order by id for update;
  if not exists(select 1 from public.icom_bank_accounts where id=new.source_account_id and owner_id=auth.uid() and active and scope='LOJA') or not exists(select 1 from public.icom_bank_accounts where id=new.target_account_id and owner_id=auth.uid() and active and scope='PESSOAL') then raise exception 'BANK_PROLABORE_ACCOUNTS';end if;
  if new.status='REALIZADO' and (new.paid_at is null or new.paid_at>(clock_timestamp() at time zone 'America/Sao_Paulo')::date) or new.status='PREVISTO' and new.paid_at is not null then raise exception 'BANK_PROLABORE_INVALID';end if;
 end if;
 new.updated_at:=clock_timestamp();
 insert into icom_bank_internal.account_history(actor_id,entity,entity_id,old_data,new_data) values(auth.uid(),tg_table_name,new.id,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));return new;
end $$;

create function public.icom_bank_schedule_prolabore(p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_prolabore;identifier uuid;first_date date;ref date;months integer;received boolean;paid date;due date;base date;i integer;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>4000 then raise exception 'BANK_PROLABORE_INVALID';end if;
 identifier:=(p_payload->>'id')::uuid;first_date:=(p_payload->>'first_due')::date;ref:=(p_payload->>'reference_month'||'-01')::date;months:=(p_payload->>'months')::integer;received:=(p_payload->>'first_received')::boolean;paid:=(p_payload->>'paid_at')::date;
 if identifier is null or first_date is null or ref is null or months is null or received is null or months not between 1 and 60 or first_date<date '2000-01-01' or ref<date '2000-01-01' or first_date+make_interval(months=>months-1)>date '2100-12-31' or ref+make_interval(months=>months-1)>date '2100-12-31' or received and (paid is null or paid<date '2000-01-01' or paid>(clock_timestamp() at time zone 'America/Sao_Paulo')::date) or not received and paid is not null then raise exception 'BANK_PROLABORE_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(identifier::text,19));select * into r from public.icom_bank_prolabore where id=identifier for update;
 if found then
  if r.series_id=identifier and r.status<>'CANCELADO' and r.months_count=months and r.due_date=first_date and r.reference_month=p_payload->>'reference_month' and r.amount_cents=(p_payload->>'amount_cents')::bigint and r.source_account_id=(p_payload->>'source_account_id')::uuid and r.target_account_id=(p_payload->>'target_account_id')::uuid and r.notes=coalesce(p_payload->>'notes','') and (select count(*) from public.icom_bank_prolabore where series_id=identifier)=months then return to_jsonb(r);end if;
  raise exception 'BANK_PROLABORE_CHANGED';
 end if;
 for i in 0..months-1 loop
  base:=(date_trunc('month',first_date)+make_interval(months=>i))::date;due:=base+least(extract(day from first_date)::integer,extract(day from base+interval '1 month - 1 day')::integer)-1;
  insert into public.icom_bank_prolabore(id,series_id,sequence_number,months_count,reference_month,due_date,paid_at,amount_cents,source_account_id,target_account_id,notes,status)
  values(case when i=0 then identifier else gen_random_uuid() end,identifier,i+1,months,to_char(ref+make_interval(months=>i),'YYYY-MM'),due,case when i=0 and received then paid end,(p_payload->>'amount_cents')::bigint,(p_payload->>'source_account_id')::uuid,(p_payload->>'target_account_id')::uuid,coalesce(p_payload->>'notes',''),case when i=0 and received then 'REALIZADO' else 'PREVISTO' end);
 end loop;
 select * into r from public.icom_bank_prolabore where id=identifier;return to_jsonb(r);
end $$;

create function public.icom_bank_receive_prolabore(p_id uuid,p_expected timestamptz,p_paid date) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_prolabore;series uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 select coalesce(series_id,id) into series from public.icom_bank_prolabore where id=p_id;
 if series is null then raise exception 'BANK_PROLABORE_CHANGED';end if;perform pg_advisory_xact_lock(hashtextextended(series::text,19));
 select * into r from public.icom_bank_prolabore where id=p_id for update;
 if p_paid is null or p_paid<date '2000-01-01' or p_paid>(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'BANK_PROLABORE_INVALID';end if;
 if r.status='REALIZADO' and r.paid_at=p_paid then return to_jsonb(r);end if;
 if r.status<>'PREVISTO' or p_expected is distinct from r.updated_at then raise exception 'BANK_PROLABORE_CHANGED';end if;
 update public.icom_bank_prolabore set status='REALIZADO',paid_at=p_paid where id=p_id returning * into r;return to_jsonb(r);
end $$;

create function public.icom_bank_edit_prolabore_series(p_id uuid,p_expected timestamptz,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_prolabore;series uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>3000 then raise exception 'BANK_PROLABORE_INVALID';end if;
 select coalesce(series_id,id) into series from public.icom_bank_prolabore where id=p_id;
 if series is null then raise exception 'BANK_PROLABORE_CHANGED';end if;perform pg_advisory_xact_lock(hashtextextended(series::text,19));
 select * into r from public.icom_bank_prolabore where id=p_id for update;
 if r.status<>'PREVISTO' or p_expected is distinct from r.updated_at then raise exception 'BANK_PROLABORE_CHANGED';end if;
 perform 1 from public.icom_bank_prolabore where coalesce(series_id,id)=series order by id for update;
 update public.icom_bank_prolabore set amount_cents=(p_payload->>'amount_cents')::bigint,source_account_id=(p_payload->>'source_account_id')::uuid,target_account_id=(p_payload->>'target_account_id')::uuid,notes=coalesce(p_payload->>'notes','')
 where coalesce(series_id,id)=series and status='PREVISTO' and sequence_number>=r.sequence_number;
 select * into r from public.icom_bank_prolabore where id=p_id;return to_jsonb(r);
end $$;

create or replace function public.icom_bank_cancel_prolabore(p_id uuid,p_expected timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.icom_bank_prolabore;series uuid;begin
 if auth.uid() is null or coalesce(icom_bank_internal.role(),'')<>'OWNER' then raise exception 'BANK_FORBIDDEN';end if;
 select coalesce(series_id,id) into series from public.icom_bank_prolabore where id=p_id;
 if series is null then raise exception 'BANK_PROLABORE_CHANGED';end if;perform pg_advisory_xact_lock(hashtextextended(series::text,19));
 select * into r from public.icom_bank_prolabore where id=p_id for update;
 if not found or r.owner_id<>auth.uid() or r.status not in('PREVISTO','REALIZADO') or p_expected is distinct from r.updated_at then raise exception 'BANK_PROLABORE_CHANGED';end if;
 update public.icom_bank_prolabore set status='CANCELADO' where id=p_id returning * into r;return to_jsonb(r);
end $$;
revoke all on function public.icom_bank_schedule_prolabore(jsonb),public.icom_bank_receive_prolabore(uuid,timestamptz,date),public.icom_bank_edit_prolabore_series(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.icom_bank_schedule_prolabore(jsonb),public.icom_bank_receive_prolabore(uuid,timestamptz,date),public.icom_bank_edit_prolabore_series(uuid,timestamptz,jsonb) to authenticated;
notify pgrst,'reload schema';
