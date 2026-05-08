import { useCallback, useEffect, useMemo, useState } from "react";
import { npsRepo } from "../lib/nps-repo";
import type { NpsSurvey } from "../types";

export interface NpsAggregate {
  npsScore: number; // -100..100, null when no responses
  responseRate: number;
  numSent: number;
  numResponded: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export function useNpsSurveys(limit = 100) {
  const [surveys, setSurveys] = useState<NpsSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await npsRepo.list(limit);
      setSurveys(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar NPS");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
    return npsRepo.subscribe(refresh);
  }, [refresh]);

  const aggregate = useMemo<NpsAggregate>(() => {
    const responded = surveys.filter((s) => s.responded_at != null);
    const promoters = responded.filter((s) => s.classification === "promoter").length;
    const passives = responded.filter((s) => s.classification === "passive").length;
    const detractors = responded.filter((s) => s.classification === "detractor").length;
    const numResponded = responded.length;
    const numSent = surveys.filter((s) => s.sent_at != null).length;
    const npsScore =
      numResponded > 0
        ? Math.round(((promoters - detractors) / numResponded) * 100)
        : 0;
    return {
      npsScore,
      responseRate: numSent > 0 ? Math.round((numResponded / numSent) * 100) : 0,
      numSent,
      numResponded,
      promoters,
      passives,
      detractors,
    };
  }, [surveys]);

  return { surveys, loading, error, aggregate, refresh };
}
