import { useCallback, useEffect, useState } from "react";
import { termsRepo } from "../lib/terms-repo";
import type {
  NewSignatureRequest,
  TermSignature,
  TermTemplate,
} from "../types";

export function useTerms() {
  const [template, setTemplate] = useState<TermTemplate | null>(null);
  const [signatures, setSignatures] = useState<TermSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        termsRepo.getActiveTemplate(),
        termsRepo.listSignatures(50),
      ]);
      setTemplate(t);
      setSignatures(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar termo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return termsRepo.subscribe(refresh);
  }, [refresh]);

  const saveTemplate = useCallback(
    async (input: { title: string; body: string }) => {
      const t = await termsRepo.saveTemplate(input);
      await refresh();
      return t;
    },
    [refresh]
  );

  const createRequest = useCallback(
    async (input: NewSignatureRequest) => {
      const s = await termsRepo.createRequest(input);
      await refresh();
      return s;
    },
    [refresh]
  );

  return { template, signatures, loading, error, saveTemplate, createRequest, refresh };
}
