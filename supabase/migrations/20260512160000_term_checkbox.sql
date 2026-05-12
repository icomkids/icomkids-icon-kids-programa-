-- Icon Kids — termo de responsabilidade vira "li e aceito" (checkbox)
-- em vez de assinatura desenhada. A coluna signature_data_url continua
-- existindo (nullable) por compatibilidade com termos antigos.

create or replace function public.submit_term_signature(
  p_token text,
  p_signature_data_url text default null,
  p_user_agent text default null,
  p_guardian_document text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
begin
  select id, signed_at into v_existing
    from public.term_signatures where token = p_token
   for update;

  if not found then
    raise exception 'signature request not found';
  end if;
  if v_existing.signed_at is not null then
    raise exception 'this term was already signed';
  end if;

  update public.term_signatures
     set signature_data_url = p_signature_data_url,
         signed_at = now(),
         user_agent = coalesce(p_user_agent, user_agent),
         guardian_document = coalesce(p_guardian_document, guardian_document)
   where token = p_token;
end;
$$;

grant execute on function public.submit_term_signature(text, text, text, text)
  to anon, authenticated;
