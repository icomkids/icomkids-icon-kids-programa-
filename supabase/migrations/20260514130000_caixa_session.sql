-- Icon Kids — Sistema de caixa com abertura/fechamento + auditoria.
--
-- Modelo: 1 sessao por dia (status open|closed), movimentos com numero
-- sequencial por sessao. Triggers em sessions e product_sales criam
-- movimento de venda automaticamente. Triggers FALHAM se nao houver
-- caixa aberto — forca o operador a abrir o caixa antes de operar.

-- ============================================================================
-- Enum
-- ============================================================================
do $$ begin
  create type public.caixa_movimento_tipo as enum (
    'venda', 'suprimento', 'sangria', 'ajuste'
  );
exception when duplicate_object then null; end $$;

-- ============================================================================
-- caixa_sessao
-- ============================================================================
create table public.caixa_sessao (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open' check (status in ('open', 'closed')),
  aberto_em timestamptz not null default now(),
  aberto_por uuid references public.profiles(id) on delete set null,
  valor_abertura_cents integer not null check (valor_abertura_cents >= 0),
  fechado_em timestamptz,
  fechado_por uuid references public.profiles(id) on delete set null,
  valor_esperado_cents integer,
  valor_contado_cents integer,
  diferenca_cents integer,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- so 1 sessao aberta por vez
create unique index caixa_sessao_one_open_idx on public.caixa_sessao(status)
  where status = 'open';
create index caixa_sessao_aberto_em_idx on public.caixa_sessao(aberto_em desc);

create trigger caixa_sessao_set_updated_at
  before update on public.caixa_sessao
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- caixa_movimento
-- ============================================================================
create table public.caixa_movimento (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.caixa_sessao(id) on delete restrict,
  numero_seq integer not null,
  tipo public.caixa_movimento_tipo not null,
  valor_cents integer not null check (valor_cents > 0),
  forma_pagamento text,
  descricao text,
  ref_session_id uuid references public.sessions(id) on delete set null,
  ref_product_sale_id uuid references public.product_sales(id) on delete set null,
  cancelado_em timestamptz,
  cancelado_por uuid references public.profiles(id) on delete set null,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.profiles(id) on delete set null,
  unique (sessao_id, numero_seq)
);

create index caixa_movimento_sessao_idx
  on public.caixa_movimento(sessao_id, numero_seq desc);
create index caixa_movimento_tipo_idx
  on public.caixa_movimento(tipo, criado_em desc)
  where cancelado_em is null;

-- ============================================================================
-- RLS — staff/owner full access; canceled history preservado
-- ============================================================================
alter table public.caixa_sessao enable row level security;
alter table public.caixa_movimento enable row level security;

create policy "caixa_sessao_staff_all" on public.caixa_sessao for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

create policy "caixa_movimento_staff_all" on public.caixa_movimento for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

alter publication supabase_realtime add table public.caixa_sessao;
alter publication supabase_realtime add table public.caixa_movimento;

-- ============================================================================
-- RPC: caixa_abrir
-- ============================================================================
create or replace function public.caixa_abrir(p_valor_abertura_cents integer)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_sessao_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'unauthorized'; end if;
  if public.auth_user_role() not in ('staff', 'owner') then
    raise exception 'forbidden: requer staff/owner';
  end if;
  if p_valor_abertura_cents < 0 then
    raise exception 'valor de abertura deve ser >= 0';
  end if;

  insert into public.caixa_sessao (aberto_por, valor_abertura_cents)
  values (v_user_id, p_valor_abertura_cents)
  returning id into v_sessao_id;

  return v_sessao_id;
exception
  when unique_violation then
    raise exception 'ja existe um caixa aberto';
end;
$$;

grant execute on function public.caixa_abrir(integer) to authenticated;

-- ============================================================================
-- RPC: caixa_lancar (movimento manual — sangria, suprimento, ajuste)
-- ============================================================================
create or replace function public.caixa_lancar(
  p_tipo public.caixa_movimento_tipo,
  p_valor_cents integer,
  p_forma_pagamento text default null,
  p_descricao text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_sessao_id uuid;
  v_next_seq integer;
  v_mov_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'unauthorized'; end if;
  if public.auth_user_role() not in ('staff', 'owner') then
    raise exception 'forbidden: requer staff/owner';
  end if;
  if p_valor_cents <= 0 then
    raise exception 'valor deve ser > 0';
  end if;
  -- Sangria/suprimento/ajuste passam por aqui. Venda usa o trigger.
  if p_tipo = 'venda' then
    raise exception 'use o cadastro de sessao ou PDV para vendas, nao caixa_lancar diretamente';
  end if;

  select id into v_sessao_id from public.caixa_sessao where status = 'open' limit 1;
  if v_sessao_id is null then
    raise exception 'nenhum caixa aberto; abra antes de lancar';
  end if;

  select coalesce(max(numero_seq), 0) + 1 into v_next_seq
    from public.caixa_movimento where sessao_id = v_sessao_id;

  insert into public.caixa_movimento (
    sessao_id, numero_seq, tipo, valor_cents,
    forma_pagamento, descricao, criado_por
  ) values (
    v_sessao_id, v_next_seq, p_tipo, p_valor_cents,
    p_forma_pagamento, p_descricao, v_user_id
  ) returning id into v_mov_id;

  return v_mov_id;
end;
$$;

grant execute on function public.caixa_lancar(public.caixa_movimento_tipo, integer, text, text) to authenticated;

-- ============================================================================
-- RPC: caixa_cancelar (OWNER ONLY)
-- ============================================================================
create or replace function public.caixa_cancelar(p_movimento_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'unauthorized'; end if;
  if public.auth_user_role() <> 'owner' then
    raise exception 'forbidden: cancelamento requer owner';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'motivo obrigatorio (min 3 caracteres)';
  end if;

  update public.caixa_movimento
    set cancelado_em = now(),
        cancelado_por = v_user_id,
        motivo_cancelamento = p_motivo
    where id = p_movimento_id
      and cancelado_em is null
      and sessao_id in (select id from public.caixa_sessao where status = 'open');

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'movimento nao encontrado, ja cancelado, ou sessao fechada';
  end if;
end;
$$;

grant execute on function public.caixa_cancelar(uuid, text) to authenticated;

-- ============================================================================
-- RPC: caixa_fechar
-- ============================================================================
create or replace function public.caixa_fechar(
  p_valor_contado_cents integer,
  p_observacoes text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_sessao record;
  v_dinheiro integer;
  v_suprimento integer;
  v_sangria integer;
  v_ajuste integer;
  v_esperado integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'unauthorized'; end if;
  if public.auth_user_role() not in ('staff', 'owner') then
    raise exception 'forbidden';
  end if;
  if p_valor_contado_cents < 0 then
    raise exception 'valor contado deve ser >= 0';
  end if;

  select * into v_sessao from public.caixa_sessao where status = 'open' limit 1;
  if v_sessao is null then
    raise exception 'nenhum caixa aberto';
  end if;

  select coalesce(sum(valor_cents), 0) into v_dinheiro
    from public.caixa_movimento
    where sessao_id = v_sessao.id
      and tipo = 'venda'
      and forma_pagamento = 'dinheiro'
      and cancelado_em is null;

  select coalesce(sum(valor_cents), 0) into v_suprimento
    from public.caixa_movimento
    where sessao_id = v_sessao.id
      and tipo = 'suprimento'
      and cancelado_em is null;

  select coalesce(sum(valor_cents), 0) into v_sangria
    from public.caixa_movimento
    where sessao_id = v_sessao.id
      and tipo = 'sangria'
      and cancelado_em is null;

  select coalesce(sum(valor_cents), 0) into v_ajuste
    from public.caixa_movimento
    where sessao_id = v_sessao.id
      and tipo = 'ajuste'
      and cancelado_em is null;

  v_esperado := v_sessao.valor_abertura_cents
              + v_dinheiro
              + v_suprimento
              - v_sangria
              + v_ajuste;

  if (p_valor_contado_cents - v_esperado) <> 0
     and (p_observacoes is null or length(trim(p_observacoes)) = 0) then
    raise exception 'diferenca detectada — observacao obrigatoria';
  end if;

  update public.caixa_sessao
    set status = 'closed',
        fechado_em = now(),
        fechado_por = v_user_id,
        valor_esperado_cents = v_esperado,
        valor_contado_cents = p_valor_contado_cents,
        diferenca_cents = p_valor_contado_cents - v_esperado,
        observacoes = p_observacoes
    where id = v_sessao.id;

  return v_sessao.id;
end;
$$;

grant execute on function public.caixa_fechar(integer, text) to authenticated;

-- ============================================================================
-- Trigger: vendas de sessoes (criancas) -> caixa_movimento
-- Falha se nao houver caixa aberto.
-- ============================================================================
create or replace function public.tg_caixa_lancar_venda_sessao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_delta integer;
  v_sessao_id uuid;
  v_next_seq integer;
  v_criador uuid;
begin
  if TG_OP = 'INSERT' then
    v_delta := coalesce(NEW.amount_paid_cents, 0);
  else
    v_delta := coalesce(NEW.amount_paid_cents, 0) - coalesce(OLD.amount_paid_cents, 0);
  end if;

  if v_delta <= 0 then return NEW; end if;

  select id into v_sessao_id from public.caixa_sessao where status = 'open' limit 1;
  if v_sessao_id is null then
    raise exception 'caixa nao esta aberto — abra o caixa antes de cadastrar/cobrar';
  end if;

  select coalesce(max(numero_seq), 0) + 1 into v_next_seq
    from public.caixa_movimento where sessao_id = v_sessao_id;

  v_criador := coalesce(auth.uid(), NEW.created_by);
  if v_criador is null then
    select aberto_por into v_criador from public.caixa_sessao where id = v_sessao_id;
  end if;

  insert into public.caixa_movimento (
    sessao_id, numero_seq, tipo, valor_cents,
    forma_pagamento, descricao, ref_session_id, criado_por
  ) values (
    v_sessao_id,
    v_next_seq,
    'venda',
    v_delta,
    NEW.payment_method,
    case when TG_OP = 'UPDATE'
         then 'Excedente / cobranca adicional'
         else 'Sessao crianca' end,
    NEW.id,
    v_criador
  );

  return NEW;
end;
$$;

drop trigger if exists tg_caixa_sessions on public.sessions;
create trigger tg_caixa_sessions
  after insert or update of amount_paid_cents on public.sessions
  for each row execute function public.tg_caixa_lancar_venda_sessao();

-- ============================================================================
-- Trigger: vendas do PDV -> caixa_movimento
-- ============================================================================
create or replace function public.tg_caixa_lancar_venda_pdv()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sessao_id uuid;
  v_next_seq integer;
  v_criador uuid;
begin
  if NEW.total_cents is null or NEW.total_cents <= 0 then return NEW; end if;

  select id into v_sessao_id from public.caixa_sessao where status = 'open' limit 1;
  if v_sessao_id is null then
    raise exception 'caixa nao esta aberto — abra o caixa antes de vender no PDV';
  end if;

  select coalesce(max(numero_seq), 0) + 1 into v_next_seq
    from public.caixa_movimento where sessao_id = v_sessao_id;

  v_criador := coalesce(auth.uid(), NEW.created_by);
  if v_criador is null then
    select aberto_por into v_criador from public.caixa_sessao where id = v_sessao_id;
  end if;

  insert into public.caixa_movimento (
    sessao_id, numero_seq, tipo, valor_cents,
    forma_pagamento, descricao, ref_product_sale_id, criado_por
  ) values (
    v_sessao_id, v_next_seq, 'venda', NEW.total_cents,
    NEW.payment_method, 'Venda PDV', NEW.id, v_criador
  );

  return NEW;
end;
$$;

drop trigger if exists tg_caixa_pdv on public.product_sales;
create trigger tg_caixa_pdv
  after insert on public.product_sales
  for each row execute function public.tg_caixa_lancar_venda_pdv();
