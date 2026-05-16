import { useCallback, useEffect, useState } from "react";
import {
  listChildrenHistory,
  listSessionsForChild,
  type ChildHistoryRow,
  type SessionHistoryRow,
} from "@/features/crm/lib/history-repo";

export function useChildrenHistory() {
  const [rows, setRows] = useState<ChildHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listChildrenHistory();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}

export function useChildSessions(childId: string | null) {
  const [sessions, setSessions] = useState<SessionHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!childId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await listSessionsForChild(childId);
        if (!cancelled) setSessions(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId]);

  return { sessions, loading };
}
