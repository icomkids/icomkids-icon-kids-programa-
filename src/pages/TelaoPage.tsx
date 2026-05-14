import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { usePricing } from "@/features/crm/hooks/use-pricing";
import {
  useActiveSessions,
  useTicker,
} from "@/features/crm/hooks/use-active-sessions";
import {
  derivedStatus,
  elapsedSinceExpired,
  remainingSeconds,
} from "@/features/crm/lib/session-timing";
import { useMedia } from "@/features/media/hooks/use-media";
import { TELAO_CHILD_SECONDS_KEY } from "@/features/settings/components/telao-settings-card";
import { useSetting } from "@/features/settings/hooks/use-setting";
import type { ActiveSession } from "@/features/crm/types";
import type { MediaItem } from "@/features/media/types";
import { formatCountdown } from "@/lib/format";

type Slide =
  | { type: "child"; session: ActiveSession }
  | { type: "media"; item: MediaItem };

/**
 * Build the slide queue: alternate child / media / child / media. If we run
 * out of one, the other carries the rotation.
 */
function buildQueue(sessions: ActiveSession[], media: MediaItem[]): Slide[] {
  const out: Slide[] = [];
  const max = Math.max(sessions.length, media.length);
  for (let i = 0; i < max; i++) {
    if (sessions[i % Math.max(1, sessions.length)] && sessions.length > 0) {
      out.push({ type: "child", session: sessions[i % sessions.length] });
    }
    if (media.length > 0) {
      out.push({ type: "media", item: media[i % media.length] });
    }
  }
  return out;
}

export default function TelaoPage() {
  useTicker(1000);
  const { sessions } = useActiveSessions();
  const { items: mediaItems } = useMedia(true);
  const { value: childSeconds } = useSetting<number>(
    TELAO_CHILD_SECONDS_KEY,
    8
  );
  const { value: pricing } = usePricing();

  // ==========================================================================
  // Alerta sonoro quando tempo de uma crianca esgota.
  // ==========================================================================
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());
  const [audioReady, setAudioReady] = useState(false);

  const enableAudio = () => {
    if (audioCtxRef.current) return;
    type AC = typeof AudioContext;
    const Ctor =
      window.AudioContext ??
      ((window as unknown as { webkitAudioContext: AC }).webkitAudioContext);
    if (!Ctor) return;
    audioCtxRef.current = new Ctor();
    setAudioReady(true);
  };

  const playBeep = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    // 3 beeps de 0.15s em 880Hz, espacados 0.2s.
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      const start = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + 0.18);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }, []);

  useEffect(() => {
    for (const s of sessions) {
      if (alertedRef.current.has(s.id)) continue;
      if (derivedStatus(s) === "expired") {
        alertedRef.current.add(s.id);
        playBeep();
      }
    }
    // Tira da memoria sessoes que terminaram pra liberar futuro re-alerta
    // caso a mesma criança volte com nova sessao (qualquer id seria novo).
    for (const id of alertedRef.current) {
      if (!sessions.find((s) => s.id === id)) {
        alertedRef.current.delete(id);
      }
    }
  }, [sessions, playBeep]);

  // ==========================================================================
  // Filtros / rotação
  // ==========================================================================

  const visibleChildren = useMemo(
    () =>
      sessions.filter((s) => {
        const d = derivedStatus(s);
        // Inclui expired: a tela precisa mostrar a crianca com alerta de
        // tolerancia ate o atendente encerrar.
        return d === "active" || d === "ending_soon" || d === "paused" || d === "expired";
      }),
    [sessions]
  );

  const queue = useMemo(
    () => buildQueue(visibleChildren, mediaItems),
    [visibleChildren, mediaItems]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [queue.length]);

  // Schedule the next tick based on the slide's intrinsic duration.
  const currentSlide = queue[index % Math.max(1, queue.length)];
  const childMs = Math.max(2, Math.min(60, Number(childSeconds) || 8)) * 1000;
  const tickMs =
    currentSlide?.type === "media"
      ? Math.max(1, currentSlide.item.duration_seconds) * 1000
      : childMs;

  useEffect(() => {
    if (queue.length === 0) return;
    const id = window.setTimeout(() => {
      setIndex((prev) => (prev + 1) % queue.length);
    }, tickMs);
    return () => window.clearTimeout(id);
  }, [index, tickMs, queue.length]);

  return (
    <div
      className="flex min-h-svh flex-col text-white"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #1E78DC 0%, #7B36BF 50%, #EA4D8E 100%)",
      }}
    >
      <header className="flex items-center justify-between px-10 pt-6">
        <div className="rounded-xl bg-white/95 px-4 py-2 shadow-lg">
          <Logo height={56} />
        </div>
        <p className="text-sm font-medium opacity-80">
          {visibleChildren.length}{" "}
          {visibleChildren.length === 1 ? "crianca" : "criancas"} no parque
        </p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        {!currentSlide ? (
          <div className="text-center">
            <p className="text-3xl font-bold opacity-80">
              Aguardando criancas no parque
            </p>
            <p className="mt-2 text-base opacity-60">
              Cadastre uma sessao no painel para comecar.
            </p>
          </div>
        ) : currentSlide.type === "child" ? (
          <ChildSlide
            session={currentSlide.session}
            graceMinutes={pricing.grace_minutes}
          />
        ) : (
          <MediaSlide item={currentSlide.item} />
        )}
      </div>

      <footer className="px-10 pb-6 text-xs uppercase tracking-[0.4em] opacity-70">
        Diversao em movimento · {new Date().toLocaleDateString("pt-BR")}
      </footer>

      {!audioReady ? (
        <Button
          type="button"
          onClick={enableAudio}
          className="fixed bottom-6 right-6 z-50 bg-white/95 text-[#7B36BF] shadow-2xl hover:bg-white"
        >
          <Volume2 className="size-4" /> Ativar som de alerta
        </Button>
      ) : null}
    </div>
  );
}

function ChildSlide({
  session,
  graceMinutes,
}: {
  session: ActiveSession;
  graceMinutes: number;
}) {
  const remaining = remainingSeconds(session);
  const status = derivedStatus(session);
  const overSeconds = elapsedSinceExpired(session);
  const graceSeconds = graceMinutes * 60;
  const graceRemaining = Math.max(0, graceSeconds - overSeconds);
  const inGrace = status === "expired" && graceRemaining > 0;
  const late = status === "expired" && graceRemaining <= 0;

  const accent = inGrace
    ? "#F4B73F"
    : late
    ? "#EA4D8E"
    : status === "ending_soon"
    ? "#F4B73F"
    : status === "paused"
    ? "#3CB4E0"
    : "#A6CD3F";

  const big = inGrace
    ? formatCountdown(graceRemaining)
    : late
    ? formatCountdown(overSeconds)
    : formatCountdown(remaining);

  const label = inGrace
    ? "Tolerancia · buscar agora"
    : late
    ? "Em atraso"
    : "Tempo restante";

  return (
    <div className="w-full max-w-3xl text-center">
      {session.child.photo_url ? (
        <img
          src={session.child.photo_url}
          alt={session.child.full_name}
          className={`mx-auto mb-6 size-48 rounded-full object-cover ring-8 ${
            inGrace || late ? "animate-pulse" : ""
          }`}
          style={{ outlineColor: accent }}
        />
      ) : (
        <div
          className={`mx-auto mb-6 flex size-48 items-center justify-center rounded-full text-7xl font-black text-slate-900 shadow-2xl ${
            inGrace || late ? "animate-pulse" : ""
          }`}
          style={{ background: accent }}
        >
          {session.child.full_name.charAt(0).toUpperCase()}
        </div>
      )}
      <p className="text-5xl font-black drop-shadow md:text-6xl">
        {session.child.full_name}
      </p>
      <p className="mt-3 text-lg opacity-80">
        Resp.: {session.guardian?.full_name ?? "—"}
      </p>

      {inGrace || late ? (
        <p
          className="mt-6 inline-block rounded-full px-6 py-2 text-2xl font-black uppercase tracking-widest"
          style={{ background: accent, color: late ? "#fff" : "#0f172a" }}
        >
          {late ? "Buscar a crianca agora!" : "Tempo esgotado"}
        </p>
      ) : null}

      <div className="mt-8">
        <p className="text-sm font-bold uppercase tracking-[0.4em] opacity-80">
          {label}
        </p>
        <p
          className="mt-2 font-mono text-[12rem] font-black leading-none tabular-nums drop-shadow-lg"
          style={{ color: accent }}
        >
          {big}
        </p>
      </div>
    </div>
  );
}

function MediaSlide({ item }: { item: MediaItem }) {
  return (
    <div className="flex w-full max-w-5xl flex-col items-center">
      {item.kind === "video" ? (
        <video
          key={item.id}
          src={item.public_url}
          className="max-h-[70svh] w-full rounded-2xl object-contain shadow-2xl"
          autoPlay
          muted
          playsInline
        />
      ) : (
        <img
          src={item.public_url}
          alt={item.name}
          className="max-h-[70svh] w-full rounded-2xl object-contain shadow-2xl"
        />
      )}
      <p className="mt-4 text-sm uppercase tracking-[0.4em] opacity-70">
        {item.name}
      </p>
    </div>
  );
}
