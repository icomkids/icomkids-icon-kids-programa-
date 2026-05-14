-- Icon Kids — RPC pra checar duplicacao de telefone no cadastro.
-- Normaliza tirando nao-digitos e pegando os ultimos 11 caracteres
-- (equivale ao numero BR completo sem codigo de pais). Se houver
-- match, frontend mostra aviso amarelo "esse telefone ja esta no
-- cadastro de X" — nao bloqueia, so alerta.

create or replace function public.find_guardians_by_phone(p_phone text)
returns table (id uuid, full_name text, phone text)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized as (
    select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 11) as q
  )
  select g.id, g.full_name, g.phone
    from public.guardians g, normalized n
   where length(n.q) >= 10
     and coalesce(g.phone, '') <> ''
     and right(regexp_replace(g.phone, '\D', '', 'g'), 11) = n.q
   order by g.created_at desc
   limit 5;
$$;

grant execute on function public.find_guardians_by_phone(text) to authenticated;
