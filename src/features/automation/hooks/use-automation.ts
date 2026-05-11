import { useCallback, useEffect, useState } from "react";
import {
  listRules,
  listScheduled,
  subscribeRules,
  subscribeScheduled,
} from "../lib/automation-repo";
import type { AutomationRule, ScheduledMessage } from "../types";

export function useAutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listRules();
      setRules(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return subscribeRules(refresh);
  }, [refresh]);

  return { rules, loading, error, refresh };
}

export function useScheduledMessages(limit = 50) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listScheduled(limit);
      setMessages(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
    return subscribeScheduled(refresh);
  }, [refresh]);

  return { messages, loading, error, refresh };
}
