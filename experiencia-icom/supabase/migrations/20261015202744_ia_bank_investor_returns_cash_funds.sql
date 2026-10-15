-- Existing reservations and profit calculations stay unchanged. Authorize each
-- investor cash settlement with the existing, rate-limited security password.
do $patch$ declare s text;a text;b text;begin
 s:=pg_get_functiondef('public.icom_bank_authorize_deletion(text,text,uuid)'::regprocedure);
 a:=$a$p_operation not in ('archive_admin'$a$;b:=$b$p_operation not in ('return_investor','archive_admin'$b$;
 if position(a in s)=0 then raise exception 'RETURN_PASSWORD_OPERATION_ANCHOR';end if;
 execute replace(s,a,b);
end $patch$;
create function icom_bank_internal.guard_investor_return_password() returns trigger
language plpgsql security definer set search_path='' as $$
declare approval uuid;begin
 if new.kind='CUSTO' and new.scope='LOJA' and new.active and new.status='REALIZADO' and new.details->>'settlement_part'='INVESTIDOR' then
  if tg_op='INSERT' then begin approval:=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-bank-delete-approval')::uuid;exception when others then raise exception 'BANK_DELETE_REQUIRED';end;
   if auth.uid() is null or not exists(select 1 from icom_bank_internal.deletion_approvals where id=approval and operation='return_investor' and target_id=new.id and actor_id=auth.uid() and expires_at>=clock_timestamp()) then raise exception 'BANK_DELETE_REQUIRED';end if;
   perform icom_bank_internal.require_deletion('return_investor',new.id);
  elsif to_jsonb(new)-'updated_at' is distinct from to_jsonb(old)-'updated_at' then begin approval:=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-bank-delete-approval')::uuid;exception when others then raise exception 'BANK_DELETE_REQUIRED';end;
   if auth.uid() is null or not exists(select 1 from icom_bank_internal.deletion_approvals where id=approval and operation='return_investor' and target_id=new.id and actor_id=auth.uid() and expires_at>=clock_timestamp()) then raise exception 'BANK_DELETE_REQUIRED';end if;
   perform icom_bank_internal.require_deletion('return_investor',new.id);end if;
 end if;return new;
end $$;
revoke all on function icom_bank_internal.guard_investor_return_password() from public,anon,authenticated;
create trigger bank_investor_return_password before insert or update on public.icom_bank_admin_entries
for each row execute function icom_bank_internal.guard_investor_return_password();

-- Owner contributions are cash movements, not sales or operating income.
alter table public.icom_bank_account_links drop constraint icom_bank_account_links_purpose_check;
alter table public.icom_bank_account_links add constraint icom_bank_account_links_purpose_check check(purpose in('MOVIMENTO','SALDO_INICIAL','APORTE','RENDA_PESSOAL'));
create function public.icom_bank_add_cash_funds(p_id uuid,p_account uuid,p_kind text,p_amount bigint,p_date date,p_notes text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.icom_bank_accounts;e public.icom_bank_admin_entries;l public.icom_bank_account_links;payload jsonb;label text;begin
 if auth.uid() is null or icom_bank_internal.role() is distinct from 'OWNER' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_account is null or p_kind is null or p_kind not in('SALDO_INICIAL','APORTE') or p_amount is null or p_amount not between 1 and 1000000000 or p_date is null or p_date<date '2000-01-01' or p_date>(clock_timestamp() at time zone 'America/Sao_Paulo')::date or p_notes is null or length(trim(p_notes))>1000 then raise exception 'BANK_FUNDS_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,11));
 select * into a from public.icom_bank_accounts where id=p_account and active and owner_id=auth.uid() and scope='LOJA' for update;
 if not found then raise exception 'BANK_ACCOUNT_INVALID';end if;
 select * into e from public.icom_bank_admin_entries where id=p_id for update;
 if found then
  select * into l from public.icom_bank_account_links where ledger_entry_id=p_id;
  if e.active and e.created_by=auth.uid() and e.kind='ENTRADA' and e.scope='LOJA' and e.status='REALIZADO' and e.amount_cents=p_amount and e.entry_date=p_date and coalesce(e.details->>'notes','')=trim(p_notes) and l.account_id=p_account and l.purpose=p_kind then return to_jsonb(e);end if;
  raise exception 'BANK_FUNDS_CHANGED';
 end if;
 if p_kind='SALDO_INICIAL' and exists(select 1 from public.icom_bank_account_links where account_id=p_account and purpose='SALDO_INICIAL') then raise exception 'BANK_FUNDS_INITIAL_EXISTS';end if;
 label:=case when p_kind='SALDO_INICIAL' then 'Saldo inicial' else 'Aporte de capital' end;
 payload:=jsonb_build_object('id',p_id,'kind','ENTRADA','scope','LOJA','entry_date',p_date,'description',left(label||' · '||a.name,160),'category',case when p_kind='SALDO_INICIAL' then 'Saldo inicial de conta' else 'Aporte de capital' end,'status','REALIZADO','amount_cents',p_amount,'details',jsonb_build_object('payment_method','TRANSFERENCIA','notes',trim(p_notes)));
 perform public.icom_bank_save_admin_entry(payload,null);
 select * into strict e from public.icom_bank_admin_entries where id=p_id;
 insert into public.icom_bank_account_links(ledger_entry_id,account_id,purpose) values(p_id,p_account,p_kind);
 return to_jsonb(e);
end $$;
revoke all on function public.icom_bank_add_cash_funds(uuid,uuid,text,bigint,date,text) from public,anon;
grant execute on function public.icom_bank_add_cash_funds(uuid,uuid,text,bigint,date,text) to authenticated;
notify pgrst,'reload schema';
