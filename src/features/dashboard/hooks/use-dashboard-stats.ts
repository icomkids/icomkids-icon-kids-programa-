import { useEffect, useMemo, useState } from "react";
import { sessionsRepo } from "@/features/crm/lib/sessions-repo";
import type { ActiveSession } from "@/features/crm/types";

export interface DailyStats {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  weekday: string;
  /** Whether this bucket is the current local day. */
  isToday: boolean;
  totalCents: number;
  numSessions: number;
}

export interface HourlyStats {
  /** 0..23. */
  hour: number;
  numSessions: number;
}

export interface DashboardStats {
  daily: DailyStats[];
  hourlyToday: HourlyStats[];
  todayCents: number;
  yesterdayCents: number;
  weekCents: number;
  weekSessions: number;
  weekTicketCents: number;
  topMethod: { label: string; pct: number } | null;
  peakHour: { hour: number; count: number } | null;
}

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useDashboardStats(days: number = 7) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await sessionsRepo.listSinceDays(days);
        if (!cancelled) {
          setSessions(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Erro ao carregar dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    refresh();
    const unsubscribe = sessionsRepo.subscribe(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [days]);

  const stats = useMemo<DashboardStats>(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayIso = isoDate(todayDate);

    // Build daily buckets covering the last `days` days (oldest -> newest).
    const dailyMap = new Map<string, DailyStats>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const iso = isoDate(d);
      dailyMap.set(iso, {
        date: iso,
        weekday: weekdayLabels[d.getDay()],
        isToday: iso === todayIso,
        totalCents: 0,
        numSessions: 0,
      });
    }

    const hourly: HourlyStats[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      numSessions: 0,
    }));

    const methodCount = new Map<string, number>();

    for (const s of sessions) {
      const startedAt = new Date(s.started_at);
      const iso = isoDate(startedAt);
      const bucket = dailyMap.get(iso);
      if (bucket) {
        bucket.totalCents += s.amount_paid_cents ?? 0;
        bucket.numSessions += 1;
      }
      if (iso === todayIso) {
        hourly[startedAt.getHours()].numSessions += 1;
      }
      if (s.payment_method) {
        methodCount.set(s.payment_method, (methodCount.get(s.payment_method) ?? 0) + 1);
      }
    }

    const daily = Array.from(dailyMap.values());
    const todayCents = daily.find((d) => d.isToday)?.totalCents ?? 0;
    const yesterdayCents = daily[daily.length - 2]?.totalCents ?? 0;
    const weekCents = daily.reduce((acc, d) => acc + d.totalCents, 0);
    const weekSessions = daily.reduce((acc, d) => acc + d.numSessions, 0);
    const weekTicketCents = weekSessions > 0 ? Math.round(weekCents / weekSessions) : 0;

    let topMethod: DashboardStats["topMethod"] = null;
    if (methodCount.size > 0) {
      let bestKey = "";
      let bestVal = 0;
      let total = 0;
      for (const [k, v] of methodCount) {
        total += v;
        if (v > bestVal) {
          bestVal = v;
          bestKey = k;
        }
      }
      topMethod = { label: bestKey, pct: total > 0 ? Math.round((bestVal / total) * 100) : 0 };
    }

    let peakHour: DashboardStats["peakHour"] = null;
    let peakCount = 0;
    for (const h of hourly) {
      if (h.numSessions > peakCount) {
        peakCount = h.numSessions;
        peakHour = { hour: h.hour, count: h.numSessions };
      }
    }

    return {
      daily,
      hourlyToday: hourly,
      todayCents,
      yesterdayCents,
      weekCents,
      weekSessions,
      weekTicketCents,
      topMethod,
      peakHour,
    };
  }, [sessions, days]);

  return { stats, loading, error };
}
