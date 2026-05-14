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

/**
 * Calcula o valor de excedente proporcional ao tier escolhido:
 *
 *   rate_por_minuto = amount_paid_cents / contracted_minutes
 *   minutos_cobrados = ceil( max(0, agora - fim_contratado - grace) / 60 )
 *   total_cents = minutos_cobrados * rate_por_minuto
 *
 * Quando a sessao esta pausada, o relogio de excedente trava em paused_at.
 * Quando ja foi encerrada, retorna sempre zero. Quando contracted_minutes
 * = 0 (sessao livre) ou amount_paid_cents = 0/null, o resultado e zero
 * porque nao da pra derivar a taxa proporcional.
 */
/**
 * Segundos decorridos desde que o tempo contratado terminou.
 * Zero antes de zerar; cresce depois. Respeita pausa (congela em
 * paused_at). Retorna zero se ja foi encerrada.
 */
export function elapsedSinceExpired(
  session: ActiveSession,
  now: Date = new Date()
): number {
  if (session.status === "ended") return 0;
  if (session.contracted_minutes <= 0) return 0;
  const startedMs = new Date(session.started_at).getTime();
  const expectedEndMs =
    startedMs +
    session.contracted_minutes * 60_000 +
    session.paused_total_seconds * 1000;
  const effectiveNowMs =
    session.status === "paused" && session.paused_at
      ? new Date(session.paused_at).getTime()
      : now.getTime();
  return Math.max(0, Math.floor((effectiveNowMs - expectedEndMs) / 1000));
}

export function computeOverage(
  session: ActiveSession,
  graceMinutes: number,
  now: Date = new Date()
): { minutes: number; cents: number } {
  if (session.status === "ended") return { minutes: 0, cents: 0 };
  if (session.contracted_minutes <= 0) return { minutes: 0, cents: 0 };
  if (!session.amount_paid_cents || session.amount_paid_cents <= 0) {
    return { minutes: 0, cents: 0 };
  }
  const startedMs = new Date(session.started_at).getTime();
  const expectedEndMs =
    startedMs +
    session.contracted_minutes * 60_000 +
    session.paused_total_seconds * 1000;
  const graceEndMs = expectedEndMs + graceMinutes * 60_000;
  const effectiveNowMs =
    session.status === "paused" && session.paused_at
      ? new Date(session.paused_at).getTime()
      : now.getTime();
  const overageMs = effectiveNowMs - graceEndMs;
  if (overageMs <= 0) return { minutes: 0, cents: 0 };
  const overageMinutes = Math.ceil(overageMs / 60_000);
  const ratePerMinCents =
    session.amount_paid_cents / session.contracted_minutes;
  return {
    minutes: overageMinutes,
    cents: Math.round(overageMinutes * ratePerMinCents),
  };
}
