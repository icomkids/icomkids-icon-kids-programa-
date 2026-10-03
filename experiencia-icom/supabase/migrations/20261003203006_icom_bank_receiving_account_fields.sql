alter table public.icom_bank_system_settings add column account_holder text not null default '' check(length(account_holder)<=160),add column agency text not null default '' check(length(agency)<=20),add column account_number text not null default '' check(length(account_number)<=30);
create function public.icom_bank_set_receiving_settings(p_type text,p_key text,p_expected timestamptz,p_holder text,p_agency text,p_account text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;new_row public.icom_bank_system_settings;holder text:=coalesce(btrim(p_holder),'');agency_value text:=coalesce(btrim(p_agency),'');account_value text:=coalesce(btrim(p_account),'');begin
 if auth.uid() is null or icom_bank_internal.role() is null or icom_bank_internal.role() not in('OWNER','ADMIN') then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if length(holder)>160 or length(agency_value)>20 or length(account_value)>30 or agency_value ~ '[[:cntrl:]]' or account_value ~ '[[:cntrl:]]' or holder ~ '[[:cntrl:]]' then raise exception 'BANK_ACCOUNT_INVALID';end if;
 result:=public.icom_bank_set_pix(p_type,p_key,p_expected);
 update public.icom_bank_system_settings set account_holder=holder,agency=agency_value,account_number=account_value where id=1 returning * into new_row;
 insert into public.icom_bank_audit_logs(actor_id,action,details) values(auth.uid(),'DADOS_RECEBIMENTO_CONFIGURADOS',jsonb_build_object('has_holder',holder<>'','has_agency',agency_value<>'','has_account',account_value<>''));
 return result||jsonb_build_object('account_holder',new_row.account_holder,'agency',new_row.agency,'account_number',new_row.account_number);
end $$;
revoke all on function public.icom_bank_set_receiving_settings(text,text,timestamptz,text,text,text) from public,anon;
grant execute on function public.icom_bank_set_receiving_settings(text,text,timestamptz,text,text,text) to authenticated;
