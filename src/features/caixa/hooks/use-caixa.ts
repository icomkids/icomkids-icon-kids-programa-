import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCaixaAberta,
  listMovimentos,
  listSessoesFechadas,
  subscribeCaixa,
} from "../lib/caixa-repo";
import type {
  CaixaMovimento,
  CaixaResumo,
  CaixaSessao,
} from "../types";

export function useCaixaAberta() {
  const [sessao, setSessao] = useState<CaixaSessao | null>(null);
  const [movimentos, setMovimentos] = useState<CaixaMovimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getCaixaAberta();
      setSessao(s);
      if (s) {
        const m = await listMovimentos(s.id);
        setMovimentos(m);
      } else {
        setMovimentos([]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar caixa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return subscribeCaixa(refresh);
  }, [refresh]);

  const resumo = useMemo<CaixaResumo>(() => {
    const ativos = movimentos.filter((m) => m.cancelado_em == null);
    let vendas_total = 0,
      vendas_dinheiro = 0,
      vendas_pix = 0,
      vendas_cartao = 0,
      vendas_outro = 0;
    let suprimentos = 0,
      sangrias = 0,
      ajustes = 0;
    let num_vendas = 0;
    for (const m of ativos) {
      if (m.tipo === "venda") {
        num_vendas += 1;
        vendas_total += m.valor_cents;
        switch (m.forma_pagamento) {
          case "dinheiro":
            vendas_dinheiro += m.valor_cents;
            break;
          case "pix":
            vendas_pix += m.valor_cents;
            break;
          case "cartao":
            vendas_cartao += m.valor_cents;
            break;
          default:
            vendas_outro += m.valor_cents;
        }
      } else if (m.tipo === "suprimento") {
        suprimentos += m.valor_cents;
      } else if (m.tipo === "sangria") {
        sangrias += m.valor_cents;
      } else if (m.tipo === "ajuste") {
        ajustes += m.valor_cents;
      }
    }
    const abertura = sessao?.valor_abertura_cents ?? 0;
    const esperado =
      abertura + vendas_dinheiro + suprimentos - sangrias + ajustes;
    return {
      vendas_total_cents: vendas_total,
      vendas_dinheiro_cents: vendas_dinheiro,
      vendas_pix_cents: vendas_pix,
      vendas_cartao_cents: vendas_cartao,
      vendas_outro_cents: vendas_outro,
      suprimentos_cents: suprimentos,
      sangrias_cents: sangrias,
      ajustes_cents: ajustes,
      esperado_em_caixa_cents: esperado,
      num_movimentos: ativos.length,
      num_vendas,
    };
  }, [movimentos, sessao]);

  return { sessao, movimentos, resumo, loading, error, refresh };
}

export function useSessoesFechadas(limit = 50) {
  const [sessoes, setSessoes] = useState<CaixaSessao[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await listSessoesFechadas(limit);
      setSessoes(data);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
    return subscribeCaixa(refresh);
  }, [refresh]);

  return { sessoes, loading, refresh };
}
