import { useCallback, useEffect, useState } from "react";
import { getSetting, setSetting, subscribeSettings } from "../lib/settings-repo";

export function useSetting<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const v = await getSetting<T>(key, fallback);
    setValue(v);
    setLoading(false);
  }, [key, fallback]);

  useEffect(() => {
    refresh();
    return subscribeSettings(refresh);
  }, [refresh]);

  const save = useCallback(
    async (next: T) => {
      setSaving(true);
      try {
        await setSetting(key, next);
        setValue(next);
      } finally {
        setSaving(false);
      }
    },
    [key]
  );

  return { value, loading, saving, save };
}
