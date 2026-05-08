import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/common/logo";
import {
  useActiveSessions,
  useTicker,
} from "@/features/crm/hooks/use-active-sessions";
import { derivedStatus, remainingSeconds } from "@/features/crm/lib/session-timing";
import { formatCountdown } from "@/lib/format";

const ROTATION_MS = 8_000;

export default function TelaoPage() {
  useTicker(1000);
  const { sessions } = useActiveSessions();
  const visible = useMemo(
    () =>
      sessions.filter((s) => {
        const d = derivedStatus(s);
        return d === "active" || d === "ending_soon" || d === "paused";
      }),
    [sessions]
  );

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (visible.length === 0) return;
    const i = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % visible.length);
    }, ROTATION_MS);
    return () => window.clearInterval(i);
  }, [visible.length]);

  const current = visible[index % Math.max(1, visible.length)];
  const remaining = current ? remainingSeconds(current) : 0;
  const status = current ? derivedStatus(current) : "ended";

  const accent =
    status === "ending_soon"
      ? "#F4B73F"
      : status === "paused"
      ? "#3CB4E0"
      : status === "expired"
      ? "#EA4D8E"
      : "#A6CD3F";

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
          {visible.length} {visible.length === 1 ? "crianca" : "criancas"} no parque
        </p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        {current ? (
          <div className="w-full max-w-3xl text-center">
            {current.child.photo_url ? (
              <img
                src={current.child.photo_url}
                alt={current.child.full_name}
                className="mx-auto mb-6 size-48 rounded-full object-cover ring-8"
                style={{ outlineColor: accent }}
              />
            ) : (
              <div
                className="mx-auto mb-6 flex size-48 items-center justify-center rounded-full text-7xl font-black text-slate-900 shadow-2xl"
                style={{ background: accent }}
              >
                {current.child.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-5xl font-black drop-shadow md:text-6xl">
              {current.child.full_name}
            </p>
            <p className="mt-3 text-lg opacity-80">
              Resp.: {current.guardian?.full_name ?? "—"}
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
        ) : (
          <div className="text-center">
            <p className="text-3xl font-bold opacity-80">
              Aguardando criancas no parque
            </p>
            <p className="mt-2 text-base opacity-60">
              Cadastre uma sessao no painel para comecar.
            </p>
          </div>
        )}
      </div>

      <footer className="px-10 pb-6 text-xs uppercase tracking-[0.4em] opacity-70">
        Diversao em movimento · {new Date().toLocaleDateString("pt-BR")}
      </footer>
    </div>
  );
}
