import { useCallback, useEffect, useMemo, useState } from "react";
import { sessionsRepo } from "@/features/crm/lib/sessions-repo";
import type { ActiveSession } from "@/features/crm/types";

export type PaymentMethod = "pix" | "dinheiro" | "cartao" | "outro";

export interface SalesSummary {
  faturamentoCents: number;
  numCriancas: number;
  ticketMedioCents: number;
  byMethod: Record<PaymentMethod, { count: number; cents: number }>;
}

function classify(method: string | null | undefined): PaymentMethod {
  switch (method) {
    case "pix":
    case "dinheiro":
    case "cartao":
      return method;
    default:
      return "outro";
  }
}

export function useSalesToday() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await sessionsRepo.listToday();
      setSessions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar vendas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = sessionsRepo.subscribe(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const summary = useMemo<SalesSummary>(() => {
    const paid = sessions.filter((s) => (s.amount_paid_cents ?? 0) > 0);
    const faturamentoCents = paid.reduce((acc, s) => acc + (s.amount_paid_cents ?? 0), 0);
    const numCriancas = paid.length;
    const ticketMedioCents = numCriancas > 0 ? Math.round(faturamentoCents / numCriancas) : 0;
    const byMethod: SalesSummary["byMethod"] = {
      pix: { count: 0, cents: 0 },
      dinheiro: { count: 0, cents: 0 },
      cartao: { count: 0, cents: 0 },
      outro: { count: 0, cents: 0 },
    };
    for (const s of paid) {
      const m = classify(s.payment_method);
      byMethod[m].count += 1;
      byMethod[m].cents += s.amount_paid_cents ?? 0;
    }
    return { faturamentoCents, numCriancas, ticketMedioCents, byMethod };
  }, [sessions]);

  return { sessions, loading, error, summary, refresh };
}
