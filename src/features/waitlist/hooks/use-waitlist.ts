import { useCallback, useEffect, useState } from "react";
import { waitlistRepo } from "../lib/waitlist-repo";
import type { WaitlistEntry, WaitlistInput, WaitlistStatus } from "../types";

export function useWaitlist() {
  const [active, setActive] = useState<WaitlistEntry[]>([]);
  const [closed, setClosed] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([
        waitlistRepo.listActive(),
        waitlistRepo.listRecentClosed(20),
      ]);
      setActive(a);
      setClosed(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar lista");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return waitlistRepo.subscribe(refresh);
  }, [refresh]);

  const add = useCallback(
    async (input: WaitlistInput) => {
      const created = await waitlistRepo.add(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const setStatus = useCallback(
    async (id: string, status: WaitlistStatus) => {
      await waitlistRepo.setStatus(id, status);
      await refresh();
    },
    [refresh]
  );

  return { active, closed, loading, error, add, setStatus, refresh };
}
