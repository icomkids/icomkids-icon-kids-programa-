import { Pause, Play, Square, TrendingUp, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL, formatCountdown, formatTimeOfDay } from "@/lib/format";
import {
  computeOverage,
  derivedStatus,
  remainingSeconds,
} from "../lib/session-timing";
import type { ActiveSession, DerivedSessionStatus } from "../types";
import { QrCodeButton } from "./qr-code-button";
import { SessionStatusBadge } from "./status-badge";

interface Props {
  session: ActiveSession;
  /** Tolerancia em minutos antes da cobranca de excedente comecar. */
  graceMinutes: number;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
}

const ringColor: Record<DerivedSessionStatus, string> = {
  active: "#A6CD3F",
  ending_soon: "#F4B73F",
  expired: "#EA4D8E",
  paused: "#3CB4E0",
  ended: "#94a3b8",
};

export function ChildSessionCard({
  session,
  graceMinutes,
  onPause,
  onResume,
  onEnd,
}: Props) {
  const status = derivedStatus(session);
  const remaining = remainingSeconds(session);
  const overage = computeOverage(session, graceMinutes);
  const initial = session.child.full_name.charAt(0).toUpperCase();
  const expectedEnd = new Date(
    new Date(session.started_at).getTime() +
      session.contracted_minutes * 60_000 +
      session.paused_total_seconds * 1000
  );

  return (
    <Card
      className="overflow-hidden border-2 transition-shadow hover:shadow-lg"
      style={{ borderColor: ringColor[status] }}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-14 w-14 ring-2" style={{ outlineColor: ringColor[status] }}>
            {session.child.photo_url ? (
              <AvatarImage src={session.child.photo_url} alt={session.child.full_name} />
            ) : null}
            <AvatarFallback className="bg-[#1E78DC] text-white">
              {initial || <User className="size-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-base font-bold">
              <span className="truncate">{session.child.full_name}</span>
              {session.child.gender ? (
                <span
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{
                    background:
                      session.child.gender === "girl" ? "#EA4D8E" : "#1E78DC",
                  }}
                  aria-label={
                    session.child.gender === "girl" ? "Menina" : "Menino"
                  }
                >
                  {session.child.gender === "girl" ? "F" : "M"}
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Resp.: {session.guardian?.full_name ?? "—"}
            </p>
            <div className="mt-1.5">
              <SessionStatusBadge status={status} />
            </div>
          </div>
        </div>

        {overage.cents > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-[#EA4D8E]" />
              <div className="leading-tight">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#EA4D8E]">
                  Excedente
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {overage.minutes} min apos tolerancia
                </p>
              </div>
            </div>
            <p className="font-mono text-xl font-black tabular-nums text-[#EA4D8E]">
              {formatBRL(overage.cents)}
            </p>
          </div>
        ) : null}

        <div className="rounded-lg bg-muted/40 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Tempo restante
          </p>
          <p
            className="font-mono text-3xl font-bold tabular-nums"
            style={{ color: ringColor[status] === "#F4B73F" ? "#0f172a" : ringColor[status] }}
          >
            {formatCountdown(remaining)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatTimeOfDay(session.started_at)} → {formatTimeOfDay(expectedEnd)}
          </p>
        </div>

        <div className="flex gap-2">
          {status === "paused" ? (
            <Button
              size="sm"
              className="flex-1 bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90"
              onClick={() => onResume(session.id)}
            >
              <Play className="size-4" /> Retomar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={status === "ended" || status === "expired"}
              onClick={() => onPause(session.id)}
            >
              <Pause className="size-4" /> Pausar
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1 bg-[#EA4D8E] text-white hover:bg-[#EA4D8E]/90"
            onClick={() => onEnd(session.id)}
          >
            <Square className="size-4" /> Encerrar
          </Button>
        </div>
        <div className="flex justify-center">
          <QrCodeButton
            childName={session.child.full_name}
            guardianName={session.guardian?.full_name ?? null}
            token={session.qr_code_token}
          />
        </div>
      </CardContent>
    </Card>
  );
}
