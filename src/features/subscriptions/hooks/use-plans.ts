import { useCallback, useEffect, useState } from "react";
import { plansRepo } from "../lib/plans-repo";
import type { SubscriptionPlan, SubscriptionPlanInput } from "../types";

export function usePlans(activeOnly = false) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = activeOnly
        ? await plansRepo.listActive()
        : await plansRepo.list();
      setPlans(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    refresh();
    const unsubscribe = plansRepo.subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  const create = useCallback(
    async (input: SubscriptionPlanInput) => {
      const created = await plansRepo.create(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const setActive = useCallback(
    async (id: string, active: boolean) => {
      await plansRepo.setActive(id, active);
      await refresh();
    },
    [refresh]
  );

  return { plans, loading, error, create, setActive, refresh };
}
