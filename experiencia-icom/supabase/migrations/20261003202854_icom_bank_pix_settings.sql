create function public.icom_bank_set_pix(p_type text,p_key text,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();role_name text:=icom_bank_internal.role();old_row public.icom_bank_system_settings;new_row public.icom_bank_system_settings;clean_key text:=nullif(btrim(p_key),'');begin
 if actor is null or role_name is null or role_name not in('OWNER','ADMIN') then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 if clean_key is not null and (p_type is null or p_type not in('CPF','CNPJ','TELEFONE','EMAIL','ALEATORIA') or length(clean_key)>120 or clean_key ~ '[[:space:][:cntrl:]]') then raise exception 'BANK_PIX_INVALID';end if;
 if (clean_key is null)<>(p_type is null) then raise exception 'BANK_PIX_INVALID';end if;
 select * into old_row from public.icom_bank_system_settings where id=1 for update;
 if not found or p_expected is null or old_row.updated_at is distinct from p_expected then raise exception 'BANK_SETTINGS_CHANGED';end if;
 update public.icom_bank_system_settings set pix_type=p_type,pix_key=clean_key,updated_at=clock_timestamp() where id=1 returning * into new_row;
 insert into public.icom_bank_audit_logs(actor_id,action,entity_id,details) values(actor,'PIX_CONFIGURADO',null,jsonb_build_object('old_type',old_row.pix_type,'new_type',p_type,'has_key',clean_key is not null));
 return jsonb_build_object('company_name',new_row.company_name,'pix_type',new_row.pix_type,'pix_key',new_row.pix_key,'updated_at',new_row.updated_at);
end $$;
revoke all on function public.icom_bank_set_pix(text,text,timestamptz) from public,anon;
grant execute on function public.icom_bank_set_pix(text,text,timestamptz) to authenticated;
