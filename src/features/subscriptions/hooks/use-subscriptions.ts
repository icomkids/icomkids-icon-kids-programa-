import { useCallback, useEffect, useState } from "react";
import { subscriptionsRepo } from "../lib/subscriptions-repo";
import type { Subscription, SubscriptionInput } from "../types";

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await subscriptionsRepo.list();
      setSubscriptions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar assinantes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscriptionsRepo.subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  const create = useCallback(
    async (input: SubscriptionInput) => {
      const created = await subscriptionsRepo.create(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const cancel = useCallback(
    async (id: string) => {
      await subscriptionsRepo.cancel(id);
      await refresh();
    },
    [refresh]
  );

  const recordPayment = useCallback(
    async (id: string, amountCents: number, method?: string) => {
      const payment = await subscriptionsRepo.recordPayment(id, amountCents, method);
      await refresh();
      return payment;
    },
    [refresh]
  );

  return { subscriptions, loading, error, create, cancel, recordPayment, refresh };
}
