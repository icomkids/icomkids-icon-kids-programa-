export type CaixaSessaoStatus = "open" | "closed";

export interface CaixaSessao {
  id: string;
  status: CaixaSessaoStatus;
  aberto_em: string;
  aberto_por: string | null;
  valor_abertura_cents: number;
  fechado_em: string | null;
  fechado_por: string | null;
  valor_esperado_cents: number | null;
  valor_contado_cents: number | null;
  diferenca_cents: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type CaixaMovimentoTipo = "venda" | "suprimento" | "sangria" | "ajuste";

export interface CaixaMovimento {
  id: string;
  sessao_id: string;
  numero_seq: number;
  tipo: CaixaMovimentoTipo;
  valor_cents: number;
  forma_pagamento: string | null;
  descricao: string | null;
  ref_session_id: string | null;
  ref_product_sale_id: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  motivo_cancelamento: string | null;
  criado_em: string;
  criado_por: string | null;
}

export interface CaixaResumo {
  /** Apenas movimentos nao-cancelados. */
  vendas_total_cents: number;
  vendas_dinheiro_cents: number;
  vendas_pix_cents: number;
  vendas_cartao_cents: number;
  vendas_outro_cents: number;
  suprimentos_cents: number;
  sangrias_cents: number;
  ajustes_cents: number;
  /** Dinheiro em caixa esperado nesse momento (abertura + dinheiro - sangria + suprimento + ajuste). */
  esperado_em_caixa_cents: number;
  num_movimentos: number;
  num_vendas: number;
}
