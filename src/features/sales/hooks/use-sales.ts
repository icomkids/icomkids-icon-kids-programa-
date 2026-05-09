import { useCallback, useEffect, useState } from "react";
import { salesRepo } from "../lib/sales-repo";
import type {
  TicketOffer,
  TicketOfferInput,
  TicketOrder,
} from "../types";

export function useSalesAdmin() {
  const [offers, setOffers] = useState<TicketOffer[]>([]);
  const [orders, setOrders] = useState<TicketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [o, ord] = await Promise.all([
        salesRepo.listOffers(),
        salesRepo.listRecentOrders(50),
      ]);
      setOffers(o);
      setOrders(ord);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar vendas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return salesRepo.subscribe(refresh);
  }, [refresh]);

  const createOffer = useCallback(
    async (input: TicketOfferInput) => {
      const o = await salesRepo.createOffer(input);
      await refresh();
      return o;
    },
    [refresh]
  );

  const updateOffer = useCallback(
    async (id: string, patch: Partial<TicketOfferInput>) => {
      const o = await salesRepo.updateOffer(id, patch);
      await refresh();
      return o;
    },
    [refresh]
  );

  const setOfferActive = useCallback(
    async (id: string, active: boolean) => {
      await salesRepo.setOfferActive(id, active);
      await refresh();
    },
    [refresh]
  );

  return {
    offers,
    orders,
    loading,
    error,
    createOffer,
    updateOffer,
    setOfferActive,
    refresh,
  };
}

export function useActiveOffers() {
  const [offers, setOffers] = useState<TicketOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await salesRepo.listActiveOffers();
        if (!cancelled) setOffers(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Erro ao carregar ofertas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { offers, loading, error };
}
