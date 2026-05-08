import { Pause, Play, Square, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCountdown, formatTimeOfDay } from "@/lib/format";
import { derivedStatus, remainingSeconds } from "../lib/session-timing";
import type { ActiveSession, DerivedSessionStatus } from "../types";
import { SessionStatusBadge } from "./status-badge";

interface Props {
  session: ActiveSession;
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

export function ChildSessionCard({ session, onPause, onResume, onEnd }: Props) {
  const status = derivedStatus(session);
  const remaining = remainingSeconds(session);
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
            <p className="truncate text-base font-bold">{session.child.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Resp.: {session.guardian?.full_name ?? "—"}
            </p>
            <div className="mt-1.5">
              <SessionStatusBadge status={status} />
            </div>
          </div>
        </div>

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
      </CardContent>
    </Card>
  );
}
