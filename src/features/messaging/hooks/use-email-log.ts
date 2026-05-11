import { useCallback, useEffect, useState } from "react";
import { listRecentEmails, subscribeToEmails } from "../lib/resend";
import type { EmailLogEntry } from "../types";

export function useEmailLog(limit = 30) {
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listRecentEmails(limit);
      setEmails(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar log");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
    return subscribeToEmails(refresh);
  }, [refresh]);

  return { emails, loading, error, refresh };
}
