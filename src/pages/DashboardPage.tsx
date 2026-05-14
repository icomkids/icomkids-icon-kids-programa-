import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";
import { formatBRL } from "@/lib/format";

const BAR_COLORS = ["#1E78DC", "#3CB4E0", "#A6CD3F", "#F4B73F", "#F39230", "#EA4D8E", "#7B36BF"];

const PERIOD_PRESETS = [
  { v: 7, label: "7 dias" },
  { v: 14, label: "14 dias" },
  { v: 30, label: "30 dias" },
  { v: 90, label: "90 dias" },
] as const;

export default function DashboardPage() {
  const [days, setDays] = useState<number>(7);
  const { stats, loading, error } = useDashboardStats(days);

  const dailyMax = Math.max(1, ...stats.daily.map((d) => d.totalCents));
  const hourlyMax = Math.max(1, ...stats.hourlyToday.map((h) => h.numSessions));

  const trendPct = stats.yesterdayCents
    ? Math.round(((stats.todayCents - stats.yesterdayCents) / stats.yesterdayCents) * 100)
    : null;

  return (
    <div>
      <PageHeader
        title="Dashboard do proprietario"
        description={`Faturamento, ocupacao e indicadores chave · ultimos ${days} dias`}
      />

      <div className="space-y-6 p-6">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="size-4 text-[#1E78DC]" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Periodo
            </span>
            {PERIOD_PRESETS.map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setDays(opt.v)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  days === opt.v
                    ? "bg-[#1E78DC] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {isUsingMockData ? (
          <div className="rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-2 text-xs">
            <strong>Modo demo:</strong> histórico simulado dos últimos {days} dias com
            distribuição realista (picos 14h-19h, fim de semana ~+50%).
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Faturamento hoje"
            value={loading ? "—" : formatBRL(stats.todayCents)}
            color="#A6CD3F"
            trend={
              trendPct == null
                ? undefined
                : { pct: trendPct, label: "vs ontem" }
            }
          />
          <Kpi
            label="Faturamento 7 dias"
            value={loading ? "—" : formatBRL(stats.weekCents)}
            color="#1E78DC"
            sub={`${stats.weekSessions} sessoes`}
          />
          <Kpi
            label="Ticket medio (7d)"
            value={loading ? "—" : formatBRL(stats.weekTicketCents)}
            color="#F39230"
          />
          <Kpi
            label="Horario de pico"
            value={
              loading || !stats.peakHour
                ? "—"
                : `${String(stats.peakHour.hour).padStart(2, "0")}h`
            }
            color="#3CB4E0"
            sub={
              stats.peakHour
                ? `${stats.peakHour.count} ${
                    stats.peakHour.count === 1 ? "sessao" : "sessoes"
                  }`
                : undefined
            }
          />
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Faturamento por dia (ultimos 7 dias)
              </h2>
              <p className="text-xs text-muted-foreground">
                Total {formatBRL(stats.weekCents)}
              </p>
            </header>
            {loading ? (
              <Skeleton className="mt-6 h-48 w-full" />
            ) : (
              <div className="mt-6 grid grid-cols-7 gap-3 px-1">
                {stats.daily.map((d, i) => {
                  const pct = (d.totalCents / dailyMax) * 100;
                  const color = d.isToday ? "#1E78DC" : BAR_COLORS[i % BAR_COLORS.length];
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1.5">
                      <div className="flex h-40 w-full items-end">
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${Math.max(2, pct)}%`,
                            background: color,
                            opacity: d.isToday ? 1 : 0.85,
                          }}
                          title={`${d.weekday} · ${formatBRL(d.totalCents)}`}
                        />
                      </div>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          d.isToday ? "text-[#1E78DC]" : "text-muted-foreground"
                        }`}
                      >
                        {d.weekday}
                      </p>
                      <p className="text-[11px] font-semibold tabular-nums">
                        {formatBRL(d.totalCents)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Resumo do periodo
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <SummaryRow
                label="Sessoes encerradas"
                value={loading ? "—" : stats.weekSessions.toString()}
                color="#1E78DC"
              />
              <SummaryRow
                label="Faturamento hoje"
                value={loading ? "—" : formatBRL(stats.todayCents)}
                color="#A6CD3F"
              />
              <SummaryRow
                label="Faturamento ontem"
                value={loading ? "—" : formatBRL(stats.yesterdayCents)}
                color="#F4B73F"
              />
              <SummaryRow
                label="Forma de pgto preferida"
                value={
                  loading || !stats.topMethod
                    ? "—"
                    : `${stats.topMethod.label.toUpperCase()} · ${stats.topMethod.pct}%`
                }
                color="#7B36BF"
              />
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <header className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Ocupacao por hora — hoje
            </h2>
            <p className="text-xs text-muted-foreground">
              {stats.hourlyToday.reduce((acc, h) => acc + h.numSessions, 0)} sessoes
              iniciadas hoje
            </p>
          </header>
          {loading ? (
            <Skeleton className="mt-6 h-32 w-full" />
          ) : (
            <div className="mt-6 grid grid-cols-12 gap-1.5 sm:[grid-template-columns:repeat(24,minmax(0,1fr))]">
              {stats.hourlyToday.map((h) => {
                const pct = (h.numSessions / hourlyMax) * 100;
                const isPeak = stats.peakHour?.hour === h.hour && h.numSessions > 0;
                return (
                  <div
                    key={h.hour}
                    className="flex flex-col items-center gap-1"
                    title={`${String(h.hour).padStart(2, "0")}h · ${h.numSessions}`}
                  >
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${Math.max(h.numSessions ? 6 : 0, pct)}%`,
                          background: isPeak ? "#1E78DC" : "#3CB4E0",
                          opacity: h.numSessions === 0 ? 0.15 : 1,
                        }}
                      />
                    </div>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {String(h.hour).padStart(2, "0")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
  sub,
  trend,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
  trend?: { pct: number; label: string };
}) {
  const up = trend ? trend.pct >= 0 : false;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {trend ? (
          <p
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: up ? "#5a8e10" : "#EA4D8E" }}
          >
            {up ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(trend.pct)}% {trend.label}
          </p>
        ) : sub ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </li>
  );
}
