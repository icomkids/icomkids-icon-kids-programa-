-- ============================================================================
-- RBAC granular: catalogo de permissoes + atribuicoes por usuario + templates
-- + audit log + funcao has_permission usada em policies.
--
-- Modelo: convive com role atual (owner|staff|partner|customer).
--   - owner: bypass total — has_permission() devolve true sem checar
--   - staff: precisa ter a permissao explicitamente em user_permissions
--   - partner|customer: nao tem acesso ao staff app (sao filtrados antes)
--
-- Naming das permissoes: "<module>.<action>", ex "caixa.fechar".
--
-- Como adicionar nova permissao no futuro (documentacao no escopo do
-- projeto):
--   1) insert into public.permissions (key, module, action, description)
--      values ('foo.bar', 'foo', 'bar', 'Descricao amigavel');
--   2) Atualize seus checks no frontend chamando hasPermission('foo.bar')
--   3) (Opcional) inclua a permissao em uma RLS policy via
--      `using (public.has_permission('foo.bar'))`
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELA: permissions (catalogo)
-- ----------------------------------------------------------------------------
create table public.permissions (
  key text primary key,
  module text not null,
  action text not null,
  description text not null,
  /** Se a permissao vem pre-marcada quando o owner cadastra um staff novo. */
  default_for_staff boolean not null default false,
  /** Ordem de exibicao na UI (menor = primeiro). */
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create index permissions_module_idx on public.permissions(module, sort_order);

-- ----------------------------------------------------------------------------
-- TABELA: user_permissions (atribuicoes N:N)
-- ----------------------------------------------------------------------------
create table public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, permission_key)
);

create index user_permissions_user_idx on public.user_permissions(user_id);

-- ----------------------------------------------------------------------------
-- TABELA: permission_templates (perfis reutilizaveis)
-- ----------------------------------------------------------------------------
create table public.permission_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  /** Lista de permission_key. Snapshot — nao usa FK pra simplicidade. */
  permission_keys text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger permission_templates_set_updated_at
  before update on public.permission_templates
  for each row execute function public.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- TABELA: permission_audit_log (rastreio)
-- ----------------------------------------------------------------------------
create table public.permission_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('grant', 'revoke', 'bulk_set', 'template_applied')),
  permission_key text,
  /** Snapshot completo quando action=bulk_set ou template_applied. */
  snapshot text[],
  /** Contexto adicional (template_name, ip, etc). */
  context jsonb default '{}'::jsonb,
  at timestamptz not null default now()
);

create index permission_audit_user_idx on public.permission_audit_log(user_id, at desc);
create index permission_audit_changed_by_idx on public.permission_audit_log(changed_by, at desc);

-- ----------------------------------------------------------------------------
-- FUNCAO: has_permission(p_key)
-- ----------------------------------------------------------------------------
-- Owner sempre bypass. Staff precisa estar em user_permissions.
-- security definer + search_path locked pra usar em policies RLS sem
-- vazar permissoes do caller.
create or replace function public.has_permission(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  select role into v_role from public.profiles where id = v_uid;

  if v_role = 'owner' then
    return true;
  end if;

  if v_role <> 'staff' then
    -- partner/customer nao tem acesso ao app staff
    return false;
  end if;

  return exists (
    select 1 from public.user_permissions
    where user_id = v_uid and permission_key = p_key
  );
end;
$$;

revoke execute on function public.has_permission(text) from anon;
grant execute on function public.has_permission(text) to authenticated;

-- ----------------------------------------------------------------------------
-- RPC helpers chamados pelo frontend
-- ----------------------------------------------------------------------------

-- Lista as permissoes do usuario atual (front pode cachear no login).
create or replace function public.my_permissions()
returns table(permission_key text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role = 'owner' then
    -- Owner tem tudo: devolve o catalogo inteiro
    return query select p.key from public.permissions p;
    return;
  end if;
  if v_role = 'staff' then
    return query
      select up.permission_key from public.user_permissions up
      where up.user_id = v_uid;
    return;
  end if;
  -- partner/customer: vazio
end;
$$;

revoke execute on function public.my_permissions() from anon;
grant execute on function public.my_permissions() to authenticated;

-- Owner aplica um conjunto de permissoes pra um staff (substitui todas).
create or replace function public.set_user_permissions(
  p_user_id uuid,
  p_keys text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_target_role public.user_role;
begin
  -- So owner pode mexer.
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'permission denied: only owner can change permissions';
  end if;

  -- Nao deixa o owner editar a si mesmo via essa funcao (evita lockout).
  if p_user_id = auth.uid() then
    raise exception 'cannot edit own permissions';
  end if;

  -- Target tem que ser staff.
  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then
    raise exception 'target user not found';
  end if;
  if v_target_role <> 'staff' then
    raise exception 'permissions only apply to staff role (got %)', v_target_role;
  end if;

  -- Aplica diff.
  delete from public.user_permissions where user_id = p_user_id;
  if array_length(p_keys, 1) > 0 then
    insert into public.user_permissions (user_id, permission_key, granted_by)
    select p_user_id, k, auth.uid()
    from unnest(p_keys) as k
    where exists (select 1 from public.permissions where key = k);
  end if;

  -- Log
  insert into public.permission_audit_log (user_id, changed_by, action, snapshot)
  values (p_user_id, auth.uid(), 'bulk_set', p_keys);
end;
$$;

revoke execute on function public.set_user_permissions(uuid, text[]) from anon;
grant execute on function public.set_user_permissions(uuid, text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS nas novas tabelas
-- ----------------------------------------------------------------------------

alter table public.permissions enable row level security;
create policy "permissions_read_authenticated" on public.permissions
  for select using (auth.role() = 'authenticated');
-- Catalogo so eh manipulado via migration / seed. Sem policies de write.

alter table public.user_permissions enable row level security;
-- Staff ve as proprias permissoes (read).
create policy "user_perm_self_read" on public.user_permissions
  for select using (user_id = auth.uid());
-- Owner ve todas.
create policy "user_perm_owner_read" on public.user_permissions
  for select using (public.auth_user_role() = 'owner');
-- Owner pode escrever (write via RPC, mas deixamos a policy aberta pra owner).
create policy "user_perm_owner_write" on public.user_permissions
  for all using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');

alter table public.permission_templates enable row level security;
create policy "perm_tpl_owner_all" on public.permission_templates
  for all using (public.auth_user_role() = 'owner')
  with check (public.auth_user_role() = 'owner');
create policy "perm_tpl_staff_read" on public.permission_templates
  for select using (public.auth_user_role() = 'staff');

alter table public.permission_audit_log enable row level security;
create policy "perm_audit_owner_read" on public.permission_audit_log
  for select using (public.auth_user_role() = 'owner');

-- ============================================================================
-- SEED: catalogo de permissoes (~70 chaves)
-- ============================================================================

insert into public.permissions (key, module, action, description, default_for_staff, sort_order) values
  -- Caixa
  ('caixa.ver_dia',           'caixa', 'ver_dia',          'Ver caixa do dia',                  true,  10),
  ('caixa.ver_semana',        'caixa', 'ver_semana',       'Ver caixa da semana',               false, 11),
  ('caixa.ver_mes',           'caixa', 'ver_mes',          'Ver caixa do mes',                  false, 12),
  ('caixa.abrir',             'caixa', 'abrir',            'Abrir caixa',                       true,  20),
  ('caixa.fechar',            'caixa', 'fechar',           'Fechar caixa',                      false, 21),
  ('caixa.sangria',           'caixa', 'sangria',          'Registrar sangria (tirar dinheiro)', false, 30),
  ('caixa.suprimento',        'caixa', 'suprimento',       'Registrar suprimento (por dinheiro)', true, 31),
  ('caixa.cancelar_movimento','caixa', 'cancelar_movimento','Cancelar movimento do caixa',      false, 40),

  -- Painel (sessoes ativas)
  ('painel.ver',              'painel', 'ver',         'Ver painel de criancas ativas',     true,  10),
  ('painel.cadastrar',        'painel', 'cadastrar',   'Cadastrar nova crianca/sessao',     true,  20),
  ('painel.pausar',           'painel', 'pausar',      'Pausar sessao',                     true,  30),
  ('painel.retomar',          'painel', 'retomar',     'Retomar sessao pausada',            true,  31),
  ('painel.encerrar',         'painel', 'encerrar',    'Encerrar sessao',                   true,  40),
  ('painel.ver_foto',         'painel', 'ver_foto',    'Ver foto da crianca',               true,  50),

  -- PDV
  ('pdv.ver',                 'pdv', 'ver',            'Ver PDV / lanchonete',              true,  10),
  ('pdv.vender',              'pdv', 'vender',         'Realizar venda no PDV',             true,  20),
  ('pdv.cancelar_venda',      'pdv', 'cancelar_venda', 'Cancelar venda do PDV',             false, 30),

  -- Historico de criancas
  ('historico.ver',           'historico', 'ver',           'Ver historico de criancas',  true,  10),
  ('historico.ver_detalhes',  'historico', 'ver_detalhes',  'Abrir ficha completa',       true,  20),
  ('historico.exportar',      'historico', 'exportar',      'Exportar CSV',               false, 30),
  ('historico.editar_crianca','historico', 'editar_crianca','Editar dados da crianca',    false, 40),

  -- CRM / NPS
  ('crm_nps.ver',             'crm_nps', 'ver',             'Ver respostas NPS',          false, 10),
  ('crm_nps.exportar',        'crm_nps', 'exportar',        'Exportar respostas',         false, 20),
  ('crm_nps.configurar_form', 'crm_nps', 'configurar_form', 'Configurar form publico',    false, 30),

  -- Marketing
  ('marketing.ver',           'marketing', 'ver',             'Ver marketing',            false, 10),
  ('marketing.criar_campanha','marketing', 'criar_campanha',  'Criar campanha',           false, 20),
  ('marketing.disparar',      'marketing', 'disparar',        'Disparar campanha em massa', false, 30),
  ('marketing.criar_automacao','marketing','criar_automacao', 'Criar automacao',          false, 40),
  ('marketing.agendar_msg',   'marketing', 'agendar_msg',     'Agendar mensagem futura',  false, 50),

  -- Agendamento
  ('agendamento.ver',         'agendamento', 'ver',      'Ver agendamentos',              true,  10),
  ('agendamento.criar',       'agendamento', 'criar',    'Criar reserva',                 true,  20),
  ('agendamento.editar',      'agendamento', 'editar',   'Editar reserva',                false, 30),
  ('agendamento.cancelar',    'agendamento', 'cancelar', 'Cancelar reserva',              false, 40),

  -- Assinaturas
  ('assinaturas.ver',         'assinaturas', 'ver',      'Ver assinaturas',               false, 10),
  ('assinaturas.criar',       'assinaturas', 'criar',    'Criar nova assinatura',         false, 20),
  ('assinaturas.cancelar',    'assinaturas', 'cancelar', 'Cancelar assinatura',           false, 30),

  -- Parceiros
  ('parceiros.ver',           'parceiros', 'ver',    'Ver parceiros',                     false, 10),
  ('parceiros.criar',         'parceiros', 'criar',  'Cadastrar parceiro',                false, 20),
  ('parceiros.editar',        'parceiros', 'editar', 'Editar parceiro',                   false, 30),

  -- Fidelidade
  ('fidelidade.ver',          'fidelidade', 'ver',              'Ver fidelidade',              true,  10),
  ('fidelidade.criar_recompensa','fidelidade','criar_recompensa','Criar recompensa',           false, 20),
  ('fidelidade.resgatar',     'fidelidade', 'resgatar',         'Resgatar recompensa',         true,  30),
  ('fidelidade.ajustar_pontos','fidelidade','ajustar_pontos',   'Ajustar pontos manualmente',  false, 40),

  -- Lista de espera
  ('lista_espera.ver',        'lista_espera', 'ver',       'Ver lista de espera',          true,  10),
  ('lista_espera.adicionar',  'lista_espera', 'adicionar', 'Adicionar a lista',            true,  20),
  ('lista_espera.remover',    'lista_espera', 'remover',   'Remover da lista',             true,  30),
  ('lista_espera.notificar',  'lista_espera', 'notificar', 'Notificar cliente (WhatsApp)', true,  40),

  -- Midia
  ('midia.ver',               'midia', 'ver',     'Ver galeria de midia',                  false, 10),
  ('midia.upload',            'midia', 'upload',  'Subir foto/video',                      false, 20),
  ('midia.deletar',           'midia', 'deletar', 'Deletar item da galeria',               false, 30),

  -- QR Check-out
  ('qr_checkout.ver',         'qr_checkout', 'ver',           'Ver QR check-out',          true,  10),
  ('qr_checkout.liberar_saida','qr_checkout','liberar_saida', 'Liberar saida via QR',      true,  20),

  -- Termo digital
  ('termo.ver',               'termo', 'ver',     'Ver termos assinados',                  true,  10),
  ('termo.reenviar',          'termo', 'reenviar','Reenviar link de termo',                true,  20),

  -- Inventario
  ('inventario.ver',          'inventario', 'ver',             'Ver inventario',           true,  10),
  ('inventario.criar',        'inventario', 'criar',           'Cadastrar produto',        false, 20),
  ('inventario.editar',       'inventario', 'editar',          'Editar produto',           false, 30),
  ('inventario.excluir',      'inventario', 'excluir',         'Excluir produto',          false, 40),
  ('inventario.ajustar_estoque','inventario','ajustar_estoque','Ajustar estoque',          false, 50),

  -- Equipe
  ('equipe.ver',              'equipe', 'ver',                'Ver equipe',                false, 10),
  ('equipe.criar',            'equipe', 'criar',              'Cadastrar funcionario',     false, 20),
  ('equipe.editar_permissoes','equipe', 'editar_permissoes',  'Editar permissoes',         false, 30),
  ('equipe.desativar',        'equipe', 'desativar',          'Desativar funcionario',     false, 40),

  -- Dashboard
  ('dashboard.ver',           'dashboard', 'ver',      'Ver dashboard executivo',         false, 10),
  ('dashboard.exportar',      'dashboard', 'exportar', 'Exportar relatorios',             false, 20),

  -- Configuracoes
  ('configuracoes.ver',       'configuracoes', 'ver',              'Ver configuracoes',          false, 10),
  ('configuracoes.editar_precos','configuracoes','editar_precos',  'Editar tabela de precos',    false, 20),
  ('configuracoes.editar_templates','configuracoes','editar_templates','Editar templates msg',   false, 30),
  ('configuracoes.editar_telao','configuracoes','editar_telao',    'Editar texto do telao',      false, 40),
  ('configuracoes.editar_secrets','configuracoes','editar_secrets','Editar tokens/APIs',         false, 50),

  -- Tutorial (sempre disponivel pra todos staff por padrao)
  ('tutorial.ver',            'tutorial', 'ver', 'Ver tutorial', true, 10)
on conflict (key) do nothing;

-- ============================================================================
-- SEED: 3 templates de exemplo
-- ============================================================================
insert into public.permission_templates (name, description, permission_keys) values
  ('Operador de caixa',
   'Atendente focado em recepcao: caixa do dia, painel, PDV, qr checkout, lista de espera, termo.',
   array[
     'caixa.ver_dia','caixa.abrir','caixa.suprimento',
     'painel.ver','painel.cadastrar','painel.pausar','painel.retomar','painel.encerrar','painel.ver_foto',
     'pdv.ver','pdv.vender',
     'qr_checkout.ver','qr_checkout.liberar_saida',
     'lista_espera.ver','lista_espera.adicionar','lista_espera.remover','lista_espera.notificar',
     'termo.ver','termo.reenviar',
     'historico.ver','historico.ver_detalhes',
     'fidelidade.ver','fidelidade.resgatar',
     'agendamento.ver','agendamento.criar',
     'tutorial.ver'
   ]),
  ('Gerente',
   'Gerente da loja: caixa completo + relatorios + marketing + agendamento. Sem configuracoes criticas.',
   array[
     'caixa.ver_dia','caixa.ver_semana','caixa.ver_mes','caixa.abrir','caixa.fechar','caixa.sangria','caixa.suprimento','caixa.cancelar_movimento',
     'painel.ver','painel.cadastrar','painel.pausar','painel.retomar','painel.encerrar','painel.ver_foto',
     'pdv.ver','pdv.vender','pdv.cancelar_venda',
     'historico.ver','historico.ver_detalhes','historico.exportar','historico.editar_crianca',
     'crm_nps.ver','crm_nps.exportar',
     'marketing.ver','marketing.criar_campanha','marketing.disparar','marketing.criar_automacao','marketing.agendar_msg',
     'agendamento.ver','agendamento.criar','agendamento.editar','agendamento.cancelar',
     'assinaturas.ver','assinaturas.criar','assinaturas.cancelar',
     'parceiros.ver','parceiros.criar','parceiros.editar',
     'fidelidade.ver','fidelidade.criar_recompensa','fidelidade.resgatar','fidelidade.ajustar_pontos',
     'lista_espera.ver','lista_espera.adicionar','lista_espera.remover','lista_espera.notificar',
     'midia.ver','midia.upload',
     'qr_checkout.ver','qr_checkout.liberar_saida',
     'termo.ver','termo.reenviar',
     'inventario.ver','inventario.criar','inventario.editar','inventario.ajustar_estoque',
     'dashboard.ver','dashboard.exportar',
     'tutorial.ver'
   ]),
  ('Marketing',
   'Equipe de marketing: so leitura de CRM/historico + uso pleno de campanhas e automacoes.',
   array[
     'historico.ver','historico.ver_detalhes','historico.exportar',
     'crm_nps.ver','crm_nps.exportar','crm_nps.configurar_form',
     'marketing.ver','marketing.criar_campanha','marketing.disparar','marketing.criar_automacao','marketing.agendar_msg',
     'midia.ver','midia.upload','midia.deletar',
     'tutorial.ver'
   ])
on conflict (name) do nothing;

-- ============================================================================
-- Comentarios documentadores
-- ============================================================================
comment on table public.permissions is 'Catalogo de permissoes granulares (RBAC). Manipulado so via migration.';
comment on table public.user_permissions is 'Atribuicoes N:N entre profiles staff e permissoes.';
comment on table public.permission_templates is 'Conjuntos reutilizaveis de permissoes (ex: Operador, Gerente).';
comment on table public.permission_audit_log is 'Log de alteracoes de permissoes (quem mudou, quando, o que).';
comment on function public.has_permission(text) is 'Retorna true se o usuario atual tem a permissao. Owner sempre passa.';
comment on function public.my_permissions() is 'Lista as chaves das permissoes do usuario atual. Usar no login pra cache no frontend.';
comment on function public.set_user_permissions(uuid, text[]) is 'Owner aplica conjunto de permissoes a um staff. Bloqueia self-edit pra evitar lockout.';
