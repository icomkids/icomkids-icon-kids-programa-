import { useCallback, useEffect, useState } from "react";
import { mediaRepo } from "../lib/media-repo";
import type { MediaItem, MediaUploadInput } from "../types";

export function useMedia(activeOnly = false) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = activeOnly
        ? await mediaRepo.listActiveForRotation()
        : await mediaRepo.list();
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar midia");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    refresh();
    return mediaRepo.subscribe(refresh);
  }, [refresh]);

  const upload = useCallback(
    async (input: MediaUploadInput) => {
      const item = await mediaRepo.upload(input);
      await refresh();
      return item;
    },
    [refresh]
  );

  const setActive = useCallback(
    async (id: string, active: boolean) => {
      await mediaRepo.setActive(id, active);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await mediaRepo.remove(id);
      await refresh();
    },
    [refresh]
  );

  return { items, loading, error, upload, setActive, remove, refresh };
}
