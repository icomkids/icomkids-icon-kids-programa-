import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MessageTemplate } from "@/features/messaging/types";

export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("message_templates")
        .select("id, key, name, body, active, notes")
        .order("name");
      if (!cancelled) {
        setTemplates((data ?? []) as MessageTemplate[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { templates, loading };
}
