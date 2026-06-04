-- ============================================================================
-- Bug: ended_at, paused_at, etc estavam sendo gravados pelo cliente via
-- `new Date().toISOString()`. Se o relogio do PC do operador estiver
-- com data/hora errada (caso real: maquina com relogio ~17h atrasado),
-- a sessao era criada hoje mas ended_at ficava ontem — e o painel filtra
-- por status='ended', entao a crianca sumia do painel logo apos cadastrar.
--
-- Solucao: 4 RPCs server-side que usam now() do PostgreSQL. O cliente
-- so chama a funcao, sem passar timestamp. Mesmo com relogio errado, o
-- horario sera sempre correto (relativo ao servidor).
-- ============================================================================

-- session_end: encerra a sessao com now() do servidor
create or replace function public.session_end(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set status = 'ended', ended_at = now()
  where id = p_session_id and status <> 'ended';
end;
$$;

-- session_end_with_extra: encerra somando excedente ao amount
create or replace function public.session_end_with_extra(
  p_session_id uuid,
  p_extra_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set status = 'ended',
      ended_at = now(),
      amount_paid_cents = coalesce(amount_paid_cents, 0) + greatest(p_extra_cents, 0)
  where id = p_session_id and status <> 'ended';
end;
$$;

-- session_pause: pausa com now() do servidor
create or replace function public.session_pause(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set status = 'paused', paused_at = now()
  where id = p_session_id and status = 'active';
end;
$$;

-- session_resume: retoma somando o tempo pausado (com now() do servidor)
create or replace function public.session_resume(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paused_at timestamptz;
  v_paused_total integer;
  v_additional integer;
begin
  select paused_at, paused_total_seconds
    into v_paused_at, v_paused_total
  from public.sessions
  where id = p_session_id;

  if v_paused_at is null then
    -- ja ativa ou ended, nao faz nada
    return;
  end if;

  v_additional := extract(epoch from (now() - v_paused_at))::integer;
  if v_additional < 0 then v_additional := 0; end if;

  update public.sessions
  set status = 'active',
      paused_at = null,
      paused_total_seconds = coalesce(v_paused_total, 0) + v_additional
  where id = p_session_id;
end;
$$;

revoke execute on function public.session_end(uuid) from anon;
revoke execute on function public.session_end_with_extra(uuid, integer) from anon;
revoke execute on function public.session_pause(uuid) from anon;
revoke execute on function public.session_resume(uuid) from anon;
grant execute on function public.session_end(uuid) to authenticated;
grant execute on function public.session_end_with_extra(uuid, integer) to authenticated;
grant execute on function public.session_pause(uuid) to authenticated;
grant execute on function public.session_resume(uuid) to authenticated;

comment on function public.session_end(uuid) is
  'Encerra sessao usando now() do servidor (a prova de relogio errado do cliente).';
comment on function public.session_end_with_extra(uuid, integer) is
  'Encerra cobrando excedente. Usa now() do servidor.';
comment on function public.session_pause(uuid) is
  'Pausa sessao com paused_at = now() do servidor.';
comment on function public.session_resume(uuid) is
  'Retoma sessao calculando paused_total_seconds com now() do servidor.';

-- ============================================================================
-- RECUPERACAO: as 2 sessoes mais recentes (maria e theo) foram "encerradas"
-- com ended_at antes do started_at (impossivel logicamente). Sao casos de
-- relogio errado do cliente. Voltam a ficar ativas pra o operador decidir
-- o que fazer. As demais sessoes com ended_at correto ficam intactas.
-- ============================================================================
update public.sessions
set status = 'active', ended_at = null
where ended_at is not null and ended_at < started_at;
