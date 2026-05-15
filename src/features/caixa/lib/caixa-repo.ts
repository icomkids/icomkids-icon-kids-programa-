import { supabase as supabaseClient } from "@/lib/supabase";
import type {
  CaixaMovimento,
  CaixaMovimentoTipo,
  CaixaSessao,
} from "../types";

// Cast em `any` ate o usuario rodar `gen types` com conta de owner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseClient as any;

const SESSAO_SELECT =
  "id, status, aberto_em, aberto_por, valor_abertura_cents, fechado_em, fechado_por, valor_esperado_cents, valor_contado_cents, diferenca_cents, observacoes, created_at, updated_at";

const MOV_SELECT =
  "id, sessao_id, numero_seq, tipo, valor_cents, forma_pagamento, descricao, ref_session_id, ref_product_sale_id, cancelado_em, cancelado_por, motivo_cancelamento, criado_em, criado_por";

export async function getCaixaAberta(): Promise<CaixaSessao | null> {
  const { data, error } = await sb
    .from("caixa_sessao")
    .select(SESSAO_SELECT)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  return (data as CaixaSessao | null) ?? null;
}

export async function listSessoesFechadas(
  limit = 50
): Promise<CaixaSessao[]> {
  const { data, error } = await sb
    .from("caixa_sessao")
    .select(SESSAO_SELECT)
    .eq("status", "closed")
    .order("fechado_em", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as CaixaSessao[];
}

export async function listMovimentos(
  sessaoId: string
): Promise<CaixaMovimento[]> {
  const { data, error } = await sb
    .from("caixa_movimento")
    .select(MOV_SELECT)
    .eq("sessao_id", sessaoId)
    .order("numero_seq", { ascending: false });
  if (error) throw error;
  return data as CaixaMovimento[];
}

export async function abrirCaixa(valorAberturaCents: number): Promise<string> {
  const { data, error } = await sb.rpc("caixa_abrir", {
    p_valor_abertura_cents: valorAberturaCents,
  });
  if (error) throw error;
  return data as string;
}

export async function lancarMovimento(input: {
  tipo: Exclude<CaixaMovimentoTipo, "venda">;
  valor_cents: number;
  forma_pagamento?: string;
  descricao?: string;
}): Promise<string> {
  const { data, error } = await sb.rpc("caixa_lancar", {
    p_tipo: input.tipo,
    p_valor_cents: input.valor_cents,
    p_forma_pagamento: input.forma_pagamento ?? null,
    p_descricao: input.descricao ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelarMovimento(
  movimentoId: string,
  motivo: string
): Promise<void> {
  const { error } = await sb.rpc("caixa_cancelar", {
    p_movimento_id: movimentoId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function fecharCaixa(
  valorContadoCents: number,
  observacoes?: string
): Promise<string> {
  const { data, error } = await sb.rpc("caixa_fechar", {
    p_valor_contado_cents: valorContadoCents,
    p_observacoes: observacoes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export function subscribeCaixa(onChange: () => void): () => void {
  const ch1 = sb
    .channel(`caixa-sessao-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "caixa_sessao" },
      onChange
    )
    .subscribe();
  const ch2 = sb
    .channel(`caixa-mov-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "caixa_movimento" },
      onChange
    )
    .subscribe();
  return () => {
    sb.removeChannel(ch1);
    sb.removeChannel(ch2);
  };
}
