import type { ActiveSession, DerivedSessionStatus } from "../types";

/**
 * Compute remaining seconds for a session given current time.
 * Accounts for pause: while paused, the timer effectively stops.
 */
export function remainingSeconds(session: ActiveSession, now: Date = new Date()): number {
  const startedAt = new Date(session.started_at).getTime();
  const expectedEnd = startedAt + session.contracted_minutes * 60_000 + session.paused_total_seconds * 1000;

  if (session.status === "paused" && session.paused_at) {
    const pausedAt = new Date(session.paused_at).getTime();
    return Math.max(0, Math.floor((expectedEnd - pausedAt) / 1000));
  }
  if (session.status === "ended" && session.ended_at) {
    return 0;
  }
  return Math.max(0, Math.floor((expectedEnd - now.getTime()) / 1000));
}

const ENDING_SOON_THRESHOLD_SECONDS = 5 * 60;

export function derivedStatus(session: ActiveSession, now: Date = new Date()): DerivedSessionStatus {
  if (session.status === "ended") return "ended";
  if (session.status === "paused") return "paused";
  const remaining = remainingSeconds(session, now);
  if (remaining <= 0) return "expired";
  if (remaining <= ENDING_SOON_THRESHOLD_SECONDS) return "ending_soon";
  return "active";
}
