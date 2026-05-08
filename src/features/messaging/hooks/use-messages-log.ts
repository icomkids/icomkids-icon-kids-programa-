import { useCallback, useEffect, useState } from "react";
import {
  listRecentMessages,
  subscribeToMessages,
} from "../lib/uazapi";
import type { MessageLogEntry } from "../types";

export function useMessagesLog(limit = 30) {
  const [messages, setMessages] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listRecentMessages(limit);
      setMessages(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar log");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
    return subscribeToMessages(refresh);
  }, [refresh]);

  return { messages, loading, error, refresh };
}
