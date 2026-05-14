import { useMemo, useState } from "react";
import { Banknote, CalendarRange, CreditCard, QrCode, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type PaymentMethod,
  useSales,
} from "@/features/caixa/hooks/use-sales-today";
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";
import { formatBRL, formatTimeOfDay } from "@/lib/format";

type Preset = "today" | "7d" | "30d" | "month" | "custom";

function rangeForPreset(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  switch (preset) {
    case "today":
      return { from: startOfToday, to: startOfTomorrow };
    case "7d": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6);
      return { from, to: startOfTomorrow };
    }
    case "30d": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 29);
      return { from, to: startOfTomorrow };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from, to: startOfTomorrow };
    }
    case "custom": {
      // customFrom/customTo no formato YYYY-MM-DD.
      const from = customFrom
        ? new Date(`${customFrom}T00:00:00`)
        : startOfToday;
      const to = customTo
        ? new Date(`${customTo}T23:59:59.999`)
        : startOfTomorrow;
      // Adiciona 1ms pra to ser exclusivo (listInRange usa <)
      return { from, to: new Date(to.getTime() + 1) };
    }
  }
}

function formatRangeLabel(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((to.getTime() - from.getTime()) / dayMs);
  if (days <= 1) return `Hoje (${fmt(from)})`;
  return `${fmt(from)} → ${fmt(new Date(to.getTime() - 1))}`;
}

const methodMeta: Record<
  PaymentMethod,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pix: { label: "PIX", color: "#A6CD3F", icon: QrCode },
  dinheiro: { label: "Dinheiro", color: "#F4B73F", icon: Wallet },
  cartao: { label: "Cartao", color: "#1E78DC", icon: CreditCard },
  outro: { label: "Outro", color: "#7B36BF", icon: Banknote },
};

export default function CaixaPage() {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(
    () => rangeForPreset(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );
  const { sessions, loading, error, summary } = useSales(range);
  const rangeLabel = formatRangeLabel(range.from, range.to);

  return (
    <div>
      <PageHeader
        title="Caixa"
        description={`Vendas agregadas pelas sessoes do CRM · ${rangeLabel}`}
      />

      <div className="space-y-6 p-6">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="size-4 text-[#1E78DC]" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Periodo
            </span>
            {(
              [
                { v: "today" as const, label: "Hoje" },
                { v: "7d" as const, label: "7 dias" },
                { v: "30d" as const, label: "30 dias" },
                { v: "month" as const, label: "Este mes" },
                { v: "custom" as const, label: "Personalizado" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setPreset(opt.v)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  preset === opt.v
                    ? "bg-[#1E78DC] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="cx-from" className="text-[11px]">
                  De
                </Label>
                <Input
                  id="cx-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cx-to" className="text-[11px]">
                  Ate
                </Label>
                <Input
                  id="cx-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          ) : null}
        </section>

        {isUsingMockData ? (
          <div className="rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-2 text-xs">
            <strong>Modo demo:</strong> dados simulados, incluindo 3 sessoes ja
            encerradas hoje.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Faturamento"
            value={loading ? "—" : formatBRL(summary.faturamentoCents)}
            color="#A6CD3F"
          />
          <Kpi
            label="Criancas atendidas"
            value={loading ? "—" : summary.numCriancas.toString()}
            color="#1E78DC"
          />
          <Kpi
            label="Ticket medio"
            value={loading ? "—" : formatBRL(summary.ticketMedioCents)}
            color="#F39230"
          />
          <Kpi
            label="Sessoes no periodo"
            value={loading ? "—" : sessions.length.toString()}
            color="#3CB4E0"
          />
        </div>

        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {error}
          </div>
        ) : null}

        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Por forma de pagamento
            </h2>
          </header>
          <ul className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(methodMeta) as PaymentMethod[]).map((m, i) => {
              const meta = methodMeta[m];
              const data = summary.byMethod[m];
              const Icon = meta.icon;
              return (
                <li
                  key={m}
                  className={`flex items-center gap-3 px-5 py-4 ${
                    i < 2 ? "lg:border-r" : ""
                  } ${i === 0 || i === 2 ? "sm:border-r" : ""} ${
                    i < 2 ? "border-b sm:border-b-0 lg:border-b-0" : ""
                  } ${i === 0 ? "sm:border-b lg:border-b-0" : ""} border-border`}
                >
                  <div
                    className="flex size-10 items-center justify-center rounded-lg text-white"
                    style={{ background: meta.color }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </p>
                    <p className="text-base font-bold tabular-nums">
                      {formatBRL(data.cents)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {data.count} {data.count === 1 ? "venda" : "vendas"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Sessoes de hoje
            </h2>
            <p className="text-xs text-muted-foreground">
              {sessions.length} no total
            </p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              Nenhuma venda registrada hoje.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Crianca</TableHead>
                    <TableHead>Responsavel</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.child.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.guardian?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.partner_name ? (
                          <span className="rounded-full bg-[#1E78DC]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1E78DC]">
                            {s.partner_name}
                          </span>
                        ) : (
                          <span className="text-[11px]">Direto</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.contracted_minutes} min
                      </TableCell>
                      <TableCell>{formatTimeOfDay(s.started_at)}</TableCell>
                      <TableCell>
                        {s.payment_method ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                            style={{
                              background:
                                methodMeta[
                                  (s.payment_method as PaymentMethod) in methodMeta
                                    ? (s.payment_method as PaymentMethod)
                                    : "outro"
                                ].color,
                            }}
                          >
                            {s.payment_method}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={s.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(s.amount_paid_cents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "active" | "paused" | "ended" }) {
  const map = {
    active: { label: "Ativo", color: "#A6CD3F", text: "#0f172a" },
    paused: { label: "Pausado", color: "#3CB4E0", text: "#0f172a" },
    ended: { label: "Encerrado", color: "#94a3b8", text: "#ffffff" },
  };
  const s = map[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.color, color: s.text }}
    >
      {s.label}
    </span>
  );
}
