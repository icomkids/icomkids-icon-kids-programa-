import type { DerivedSessionStatus } from "../types";

const labels: Record<DerivedSessionStatus, string> = {
  active: "Ativo",
  ending_soon: "Acabando",
  expired: "Tempo esgotado",
  paused: "Pausado",
  ended: "Encerrado",
};

const styles: Record<DerivedSessionStatus, { background: string; color: string }> = {
  active: { background: "#A6CD3F", color: "#0f172a" },
  ending_soon: { background: "#F4B73F", color: "#0f172a" },
  expired: { background: "#EA4D8E", color: "#ffffff" },
  paused: { background: "#3CB4E0", color: "#0f172a" },
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
