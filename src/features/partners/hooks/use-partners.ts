import { useCallback, useEffect, useState } from "react";
import type { Partner, PartnerInput } from "../types";
import { partnersRepo } from "../lib/partners-repo";

export function usePartners(activeOnly = false) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = activeOnly
        ? await partnersRepo.listActive()
        : await partnersRepo.list();
      setPartners(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar parceiros");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    refresh();
    const unsubscribe = partnersRepo.subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  const create = useCallback(
    async (input: PartnerInput) => {
      const created = await partnersRepo.create(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const setActive = useCallback(
    async (id: string, active: boolean) => {
      await partnersRepo.setActive(id, active);
      await refresh();
    },
    [refresh]
  );

  return { partners, loading, error, refresh, create, setActive };
}
