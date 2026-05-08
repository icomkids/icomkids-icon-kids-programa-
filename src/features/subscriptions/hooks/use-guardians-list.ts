import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface GuardianOption {
  id: string;
  full_name: string;
  phone: string | null;
}

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

/** Lightweight guardian list for select dropdowns. */
export function useGuardiansList() {
  const [guardians, setGuardians] = useState<GuardianOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        if (useMock) {
          // No mock guardians list right now — start empty so user is forced
          // to register a child first. Acceptable for MVP demo.
          setGuardians([]);
          return;
        }
        const { data, error } = await supabase
          .from("guardians")
          .select("id, full_name, phone")
          .order("full_name");
        if (!cancelled && !error) setGuardians((data as GuardianOption[]) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  return { guardians, loading };
}
