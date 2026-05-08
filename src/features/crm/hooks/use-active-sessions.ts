import { useCallback, useEffect, useState } from "react";
import type { ActiveSession, QuickRegisterInput } from "../types";
import { sessionsRepo } from "../lib/sessions-repo";

export function useActiveSessions() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await sessionsRepo.listActive();
      setSessions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar sessoes");
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

  const registerAndStart = useCallback(
    async (input: QuickRegisterInput) => {
      const created = await sessionsRepo.registerAndStart(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const pause = useCallback(
    async (id: string) => {
      await sessionsRepo.pause(id);
      await refresh();
    },
    [refresh]
  );

  const resume = useCallback(
    async (id: string) => {
      await sessionsRepo.resume(id);
      await refresh();
    },
    [refresh]
  );

  const end = useCallback(
    async (id: string) => {
      await sessionsRepo.end(id);
      await refresh();
    },
    [refresh]
  );

  return { sessions, loading, error, registerAndStart, pause, resume, end, refresh };
}

/** Re-renders every `intervalMs` so countdowns update in real time. */
export function useTicker(intervalMs = 1000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(i);
  }, [intervalMs]);
  return tick;
}
