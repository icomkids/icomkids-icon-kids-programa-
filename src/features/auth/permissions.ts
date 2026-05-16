/**
 * RBAC granular — frontend.
 *
 * Catalogo de keys de permissao, espelhando exatamente o seed da migration
 * 20260516180000_permissions_system.sql. Mantemos esse catalogo no codigo
 * por 3 razoes:
 *   1. Type-safety: usePermissions().can('caixa.fechar') faz auto-complete
 *      e da erro em build se a chave nao existir.
 *   2. Bundling: a UI de checkboxes precisa enumerar todos os modulos +
 *      acoes pra renderizar. Em vez de buscar do banco a cada load,
 *      usamos esse arquivo (mais rapido) e cruzamos com o resultado de
 *      my_permissions() pra saber quais ja vem marcadas.
 *   3. Auto-doc: o codigo serve de documentacao do RBAC.
 *
 * Como adicionar nova permissao:
 *   1. Adiciona a entrada aqui (em PERMISSION_CATALOG)
 *   2. Adiciona a mesma entrada na proxima migration (insert into permissions)
 *   3. Usa nos checks: hasPermission('foo.bar') ou <Gate need="foo.bar">
 */

export type PermissionKey =
  // Caixa
  | "caixa.ver_dia"
  | "caixa.ver_semana"
  | "caixa.ver_mes"
  | "caixa.abrir"
  | "caixa.fechar"
  | "caixa.sangria"
  | "caixa.suprimento"
  | "caixa.cancelar_movimento"
  // Painel
  | "painel.ver"
  | "painel.cadastrar"
  | "painel.pausar"
  | "painel.retomar"
  | "painel.encerrar"
  | "painel.ver_foto"
  // PDV
  | "pdv.ver"
  | "pdv.vender"
  | "pdv.cancelar_venda"
  // Historico
  | "historico.ver"
  | "historico.ver_detalhes"
  | "historico.exportar"
  | "historico.editar_crianca"
  // CRM NPS
  | "crm_nps.ver"
  | "crm_nps.exportar"
  | "crm_nps.configurar_form"
  // Marketing
  | "marketing.ver"
  | "marketing.criar_campanha"
  | "marketing.disparar"
  | "marketing.criar_automacao"
  | "marketing.agendar_msg"
  // Agendamento
  | "agendamento.ver"
  | "agendamento.criar"
  | "agendamento.editar"
  | "agendamento.cancelar"
  // Assinaturas
  | "assinaturas.ver"
  | "assinaturas.criar"
  | "assinaturas.cancelar"
  // Parceiros
  | "parceiros.ver"
  | "parceiros.criar"
  | "parceiros.editar"
  // Fidelidade
  | "fidelidade.ver"
  | "fidelidade.criar_recompensa"
  | "fidelidade.resgatar"
  | "fidelidade.ajustar_pontos"
  // Lista de espera
  | "lista_espera.ver"
  | "lista_espera.adicionar"
  | "lista_espera.remover"
  | "lista_espera.notificar"
  // Midia
  | "midia.ver"
  | "midia.upload"
  | "midia.deletar"
  // QR
  | "qr_checkout.ver"
  | "qr_checkout.liberar_saida"
  // Termo
  | "termo.ver"
  | "termo.reenviar"
  // Inventario
  | "inventario.ver"
  | "inventario.criar"
  | "inventario.editar"
  | "inventario.excluir"
  | "inventario.ajustar_estoque"
  // Equipe
  | "equipe.ver"
  | "equipe.criar"
  | "equipe.editar_permissoes"
  | "equipe.desativar"
  // Dashboard
  | "dashboard.ver"
  | "dashboard.exportar"
  // Configuracoes
  | "configuracoes.ver"
  | "configuracoes.editar_precos"
  | "configuracoes.editar_templates"
  | "configuracoes.editar_telao"
  | "configuracoes.editar_secrets"
  // Tutorial
  | "tutorial.ver";

interface PermissionDef {
  key: PermissionKey;
  module: string;
  action: string;
  description: string;
  default_for_staff: boolean;
}

export interface PermissionModuleInfo {
  key: string;
  label: string;
  color: string;
  /** Icone (string Lucide) — resolvido na UI. */
  icon: string;
}

/** Metadados de exibicao dos modulos (label, cor, icone). */
export const PERMISSION_MODULES: PermissionModuleInfo[] = [
  { key: "caixa",         label: "Caixa",                 color: "#A6CD3F", icon: "Banknote" },
  { key: "painel",        label: "Painel de criancas",    color: "#1E78DC", icon: "LayoutDashboard" },
  { key: "pdv",           label: "PDV / Lanchonete",      color: "#F4B73F", icon: "Coffee" },
  { key: "historico",     label: "Historico de criancas",color: "#7B36BF", icon: "ClipboardList" },
  { key: "crm_nps",       label: "Feedback (NPS)",        color: "#EA4D8E", icon: "Smile" },
  { key: "marketing",     label: "Marketing",             color: "#F39230", icon: "Megaphone" },
  { key: "agendamento",   label: "Agendamento",           color: "#7B36BF", icon: "CalendarRange" },
  { key: "assinaturas",   label: "Assinaturas",           color: "#F39230", icon: "Star" },
  { key: "parceiros",     label: "Parceiros",             color: "#3CB4E0", icon: "GraduationCap" },
  { key: "fidelidade",    label: "Fidelidade",            color: "#A6CD3F", icon: "PartyPopper" },
  { key: "lista_espera",  label: "Lista de espera",       color: "#EA4D8E", icon: "Hourglass" },
  { key: "midia",         label: "Midia",                 color: "#7B36BF", icon: "Image" },
  { key: "qr_checkout",   label: "QR Check-out",          color: "#1E78DC", icon: "QrCode" },
  { key: "termo",         label: "Termo digital",         color: "#F4B73F", icon: "FileSignature" },
  { key: "inventario",    label: "Inventario",            color: "#A6CD3F", icon: "Wrench" },
  { key: "equipe",        label: "Equipe",                color: "#3CB4E0", icon: "Users" },
  { key: "dashboard",     label: "Dashboard",             color: "#1E78DC", icon: "Gauge" },
  { key: "configuracoes", label: "Configuracoes",         color: "#7B36BF", icon: "Cog" },
  { key: "tutorial",      label: "Tutorial",              color: "#1E78DC", icon: "BookOpen" },
];

/** Catalogo completo de permissoes (espelha o seed do banco). */
export const PERMISSION_CATALOG: PermissionDef[] = [
  // Caixa
  { key: "caixa.ver_dia",            module: "caixa", action: "ver_dia",          description: "Ver caixa do dia",                  default_for_staff: true },
  { key: "caixa.ver_semana",         module: "caixa", action: "ver_semana",       description: "Ver caixa da semana",               default_for_staff: false },
  { key: "caixa.ver_mes",            module: "caixa", action: "ver_mes",          description: "Ver caixa do mes",                  default_for_staff: false },
  { key: "caixa.abrir",              module: "caixa", action: "abrir",            description: "Abrir caixa",                       default_for_staff: true },
  { key: "caixa.fechar",             module: "caixa", action: "fechar",           description: "Fechar caixa",                      default_for_staff: false },
  { key: "caixa.sangria",            module: "caixa", action: "sangria",          description: "Registrar sangria (tirar dinheiro)", default_for_staff: false },
  { key: "caixa.suprimento",         module: "caixa", action: "suprimento",       description: "Registrar suprimento (por dinheiro)", default_for_staff: true },
  { key: "caixa.cancelar_movimento", module: "caixa", action: "cancelar_movimento", description: "Cancelar movimento do caixa",     default_for_staff: false },
  // Painel
  { key: "painel.ver",       module: "painel", action: "ver",       description: "Ver painel de criancas ativas", default_for_staff: true },
  { key: "painel.cadastrar", module: "painel", action: "cadastrar", description: "Cadastrar nova crianca/sessao", default_for_staff: true },
  { key: "painel.pausar",    module: "painel", action: "pausar",    description: "Pausar sessao",                 default_for_staff: true },
  { key: "painel.retomar",   module: "painel", action: "retomar",   description: "Retomar sessao pausada",        default_for_staff: true },
  { key: "painel.encerrar",  module: "painel", action: "encerrar",  description: "Encerrar sessao",               default_for_staff: true },
  { key: "painel.ver_foto",  module: "painel", action: "ver_foto",  description: "Ver foto da crianca",           default_for_staff: true },
  // PDV
  { key: "pdv.ver",            module: "pdv", action: "ver",            description: "Ver PDV / lanchonete",       default_for_staff: true },
  { key: "pdv.vender",         module: "pdv", action: "vender",         description: "Realizar venda no PDV",      default_for_staff: true },
  { key: "pdv.cancelar_venda", module: "pdv", action: "cancelar_venda", description: "Cancelar venda do PDV",      default_for_staff: false },
  // Historico
  { key: "historico.ver",           module: "historico", action: "ver",            description: "Ver historico de criancas", default_for_staff: true },
  { key: "historico.ver_detalhes",  module: "historico", action: "ver_detalhes",   description: "Abrir ficha completa",      default_for_staff: true },
  { key: "historico.exportar",      module: "historico", action: "exportar",       description: "Exportar CSV",              default_for_staff: false },
  { key: "historico.editar_crianca",module: "historico", action: "editar_crianca", description: "Editar dados da crianca",   default_for_staff: false },
  // CRM NPS
  { key: "crm_nps.ver",             module: "crm_nps", action: "ver",             description: "Ver respostas NPS",         default_for_staff: false },
  { key: "crm_nps.exportar",        module: "crm_nps", action: "exportar",        description: "Exportar respostas",        default_for_staff: false },
  { key: "crm_nps.configurar_form", module: "crm_nps", action: "configurar_form", description: "Configurar form publico",   default_for_staff: false },
  // Marketing
  { key: "marketing.ver",             module: "marketing", action: "ver",             description: "Ver marketing",            default_for_staff: false },
  { key: "marketing.criar_campanha",  module: "marketing", action: "criar_campanha",  description: "Criar campanha",           default_for_staff: false },
  { key: "marketing.disparar",        module: "marketing", action: "disparar",        description: "Disparar campanha em massa", default_for_staff: false },
  { key: "marketing.criar_automacao", module: "marketing", action: "criar_automacao", description: "Criar automacao",          default_for_staff: false },
  { key: "marketing.agendar_msg",     module: "marketing", action: "agendar_msg",     description: "Agendar mensagem futura",  default_for_staff: false },
  // Agendamento
  { key: "agendamento.ver",      module: "agendamento", action: "ver",      description: "Ver agendamentos",  default_for_staff: true },
  { key: "agendamento.criar",    module: "agendamento", action: "criar",    description: "Criar reserva",     default_for_staff: true },
  { key: "agendamento.editar",   module: "agendamento", action: "editar",   description: "Editar reserva",    default_for_staff: false },
  { key: "agendamento.cancelar", module: "agendamento", action: "cancelar", description: "Cancelar reserva",  default_for_staff: false },
  // Assinaturas
  { key: "assinaturas.ver",      module: "assinaturas", action: "ver",      description: "Ver assinaturas",        default_for_staff: false },
  { key: "assinaturas.criar",    module: "assinaturas", action: "criar",    description: "Criar nova assinatura",  default_for_staff: false },
  { key: "assinaturas.cancelar", module: "assinaturas", action: "cancelar", description: "Cancelar assinatura",    default_for_staff: false },
  // Parceiros
  { key: "parceiros.ver",    module: "parceiros", action: "ver",    description: "Ver parceiros",        default_for_staff: false },
  { key: "parceiros.criar",  module: "parceiros", action: "criar",  description: "Cadastrar parceiro",   default_for_staff: false },
  { key: "parceiros.editar", module: "parceiros", action: "editar", description: "Editar parceiro",      default_for_staff: false },
  // Fidelidade
  { key: "fidelidade.ver",              module: "fidelidade", action: "ver",              description: "Ver fidelidade",             default_for_staff: true },
  { key: "fidelidade.criar_recompensa", module: "fidelidade", action: "criar_recompensa", description: "Criar recompensa",           default_for_staff: false },
  { key: "fidelidade.resgatar",         module: "fidelidade", action: "resgatar",         description: "Resgatar recompensa",        default_for_staff: true },
  { key: "fidelidade.ajustar_pontos",   module: "fidelidade", action: "ajustar_pontos",   description: "Ajustar pontos manualmente", default_for_staff: false },
  // Lista de espera
  { key: "lista_espera.ver",       module: "lista_espera", action: "ver",       description: "Ver lista de espera",          default_for_staff: true },
  { key: "lista_espera.adicionar", module: "lista_espera", action: "adicionar", description: "Adicionar a lista",            default_for_staff: true },
  { key: "lista_espera.remover",   module: "lista_espera", action: "remover",   description: "Remover da lista",             default_for_staff: true },
  { key: "lista_espera.notificar", module: "lista_espera", action: "notificar", description: "Notificar cliente (WhatsApp)", default_for_staff: true },
  // Midia
  { key: "midia.ver",     module: "midia", action: "ver",     description: "Ver galeria de midia",     default_for_staff: false },
  { key: "midia.upload",  module: "midia", action: "upload",  description: "Subir foto/video",         default_for_staff: false },
  { key: "midia.deletar", module: "midia", action: "deletar", description: "Deletar item da galeria",  default_for_staff: false },
  // QR
  { key: "qr_checkout.ver",            module: "qr_checkout", action: "ver",            description: "Ver QR check-out",      default_for_staff: true },
  { key: "qr_checkout.liberar_saida",  module: "qr_checkout", action: "liberar_saida",  description: "Liberar saida via QR",  default_for_staff: true },
  // Termo
  { key: "termo.ver",      module: "termo", action: "ver",      description: "Ver termos assinados",     default_for_staff: true },
  { key: "termo.reenviar", module: "termo", action: "reenviar", description: "Reenviar link de termo",   default_for_staff: true },
  // Inventario
  { key: "inventario.ver",             module: "inventario", action: "ver",             description: "Ver inventario",      default_for_staff: true },
  { key: "inventario.criar",           module: "inventario", action: "criar",           description: "Cadastrar produto",   default_for_staff: false },
  { key: "inventario.editar",          module: "inventario", action: "editar",          description: "Editar produto",      default_for_staff: false },
  { key: "inventario.excluir",         module: "inventario", action: "excluir",         description: "Excluir produto",     default_for_staff: false },
  { key: "inventario.ajustar_estoque", module: "inventario", action: "ajustar_estoque", description: "Ajustar estoque",     default_for_staff: false },
  // Equipe
  { key: "equipe.ver",               module: "equipe", action: "ver",               description: "Ver equipe",              default_for_staff: false },
  { key: "equipe.criar",             module: "equipe", action: "criar",             description: "Cadastrar funcionario",   default_for_staff: false },
  { key: "equipe.editar_permissoes", module: "equipe", action: "editar_permissoes", description: "Editar permissoes",       default_for_staff: false },
  { key: "equipe.desativar",         module: "equipe", action: "desativar",         description: "Desativar funcionario",   default_for_staff: false },
  // Dashboard
  { key: "dashboard.ver",      module: "dashboard", action: "ver",      description: "Ver dashboard executivo", default_for_staff: false },
  { key: "dashboard.exportar", module: "dashboard", action: "exportar", description: "Exportar relatorios",     default_for_staff: false },
  // Configuracoes
  { key: "configuracoes.ver",                module: "configuracoes", action: "ver",                description: "Ver configuracoes",       default_for_staff: false },
  { key: "configuracoes.editar_precos",      module: "configuracoes", action: "editar_precos",      description: "Editar tabela de precos", default_for_staff: false },
  { key: "configuracoes.editar_templates",   module: "configuracoes", action: "editar_templates",   description: "Editar templates msg",    default_for_staff: false },
  { key: "configuracoes.editar_telao",       module: "configuracoes", action: "editar_telao",       description: "Editar texto do telao",   default_for_staff: false },
  { key: "configuracoes.editar_secrets",     module: "configuracoes", action: "editar_secrets",     description: "Editar tokens/APIs",      default_for_staff: false },
  // Tutorial
  { key: "tutorial.ver", module: "tutorial", action: "ver", description: "Ver tutorial", default_for_staff: true },
];

/** Permissoes agrupadas por modulo (pra renderizar UI em accordion). */
export function permissionsByModule(): Record<string, PermissionDef[]> {
  const map: Record<string, PermissionDef[]> = {};
  for (const p of PERMISSION_CATALOG) {
    if (!map[p.module]) map[p.module] = [];
    map[p.module].push(p);
  }
  return map;
}

/** Lista as keys default_for_staff=true (pra novo cadastro). */
export function defaultStaffPermissions(): PermissionKey[] {
  return PERMISSION_CATALOG.filter((p) => p.default_for_staff).map((p) => p.key);
}
