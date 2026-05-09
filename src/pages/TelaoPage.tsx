import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/common/logo";
import {
  useActiveSessions,
  useTicker,
} from "@/features/crm/hooks/use-active-sessions";
import {
  derivedStatus,
  remainingSeconds,
} from "@/features/crm/lib/session-timing";
import { useMedia } from "@/features/media/hooks/use-media";
import type { ActiveSession } from "@/features/crm/types";
import type { MediaItem } from "@/features/media/types";
import { formatCountdown } from "@/lib/format";

const CHILD_ROTATION_MS = 8_000;

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

  const visibleChildren = useMemo(
    () =>
      sessions.filter((s) => {
        const d = derivedStatus(s);
        return d === "active" || d === "ending_soon" || d === "paused";
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
  const tickMs =
    currentSlide?.type === "media"
      ? Math.max(1, currentSlide.item.duration_seconds) * 1000
      : CHILD_ROTATION_MS;

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
          <ChildSlide session={currentSlide.session} />
        ) : (
          <MediaSlide item={currentSlide.item} />
        )}
      </div>

      <footer className="px-10 pb-6 text-xs uppercase tracking-[0.4em] opacity-70">
        Diversao em movimento · {new Date().toLocaleDateString("pt-BR")}
      </footer>
    </div>
  );
}

function ChildSlide({ session }: { session: ActiveSession }) {
  const remaining = remainingSeconds(session);
  const status = derivedStatus(session);
  const accent =
    status === "ending_soon"
      ? "#F4B73F"
      : status === "paused"
      ? "#3CB4E0"
      : status === "expired"
      ? "#EA4D8E"
      : "#A6CD3F";

  return (
    <div className="w-full max-w-3xl text-center">
      {session.child.photo_url ? (
        <img
          src={session.child.photo_url}
          alt={session.child.full_name}
          className="mx-auto mb-6 size-48 rounded-full object-cover ring-8"
          style={{ outlineColor: accent }}
        />
      ) : (
        <div
          className="mx-auto mb-6 flex size-48 items-center justify-center rounded-full text-7xl font-black text-slate-900 shadow-2xl"
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
      <div className="mt-10">
        <p className="text-sm font-bold uppercase tracking-[0.4em] opacity-80">
          Tempo restante
        </p>
        <p
          className="mt-2 font-mono text-[12rem] font-black leading-none tabular-nums drop-shadow-lg"
          style={{ color: accent }}
        >
          {formatCountdown(remaining)}
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
