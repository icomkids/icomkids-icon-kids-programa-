import type { DerivedSessionStatus } from "../types";

const labels: Record<DerivedSessionStatus, string> = {
  active: "Ativo",
  ending_soon: "Acabando",
  expired: "Tempo esgotado",
  paused: "Pausado",
  ended: "Encerrado",
};

const styles: Record<DerivedSessionStatus, { background: string; color: string }> = {
  active: { background: "#7CFC00", color: "#0f172a" },
  ending_soon: { background: "#FFD700", color: "#0f172a" },
  expired: { background: "#FF1493", color: "#ffffff" },
  paused: { background: "#00BCD4", color: "#0f172a" },
  ended: { background: "#94a3b8", color: "#ffffff" },
};

export function SessionStatusBadge({ status }: { status: DerivedSessionStatus }) {
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
      style={{ background: s.background, color: s.color }}
    >
      {labels[status]}
    </span>
  );
}
