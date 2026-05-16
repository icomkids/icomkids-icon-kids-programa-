import { useMemo, useState } from "react";
import {
  Baby,
  Banknote,
  Cake,
  CalendarDays,
  CalendarRange,
  Clock,
  Crown,
  Download,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useChildrenHistory,
  useChildSessions,
} from "@/features/crm/hooks/use-children-history";
import type { ChildHistoryRow } from "@/features/crm/lib/history-repo";
import { formatBRL } from "@/lib/format";

/**
 * Historico de criancas — visao ficha completa. Cada crianca tem:
 * - dados de cadastro (nome, idade, foto, notas)
 * - responsavel(eis) com contatos
 * - estatisticas: total de sessoes, gasto historico, ultima visita
 * - timeline de todas as sessoes ao clicar
 *
 * Filtros: busca livre (nome crianca / nome responsavel / telefone /
 * email), periodo da ultima visita, ordenacao.
 */

type SortKey =
  | "last_visit_desc"
  | "last_visit_asc"
  | "total_sessions_desc"
  | "total_spent_desc"
  | "name_asc";

type PeriodFilter = "all" | "7d" | "30d" | "90d" | "no_visits";

export default function HistoricoPage() {
  const { rows, loading, error, refresh } = useChildrenHistory();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("last_visit_desc");
  const [selected, setSelected] = useState<ChildHistoryRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) => {
        if (r.full_name.toLowerCase().includes(q)) return true;
        if (r.primary_guardian?.full_name.toLowerCase().includes(q)) return true;
        if (r.primary_guardian?.phone?.toLowerCase().includes(q)) return true;
        if (r.primary_guardian?.email?.toLowerCase().includes(q)) return true;
        for (const g of r.all_guardians) {
          if (g.full_name.toLowerCase().includes(q)) return true;
          if (g.phone?.toLowerCase().includes(q)) return true;
          if (g.email?.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    if (period !== "all") {
      const now = Date.now();
      const days =
        period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
      if (period === "no_visits") {
        list = list.filter((r) => r.total_sessions === 0);
      } else {
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        list = list.filter((r) => {
          if (!r.last_visit) return false;
          return new Date(r.last_visit).getTime() >= cutoff;
        });
      }
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "name_asc") return a.full_name.localeCompare(b.full_name);
      if (sortBy === "total_sessions_desc") return b.total_sessions - a.total_sessions;
      if (sortBy === "total_spent_desc") return b.total_spent_cents - a.total_spent_cents;
      // last_visit asc/desc — null no fim
      const av = a.last_visit ? new Date(a.last_visit).getTime() : 0;
      const bv = b.last_visit ? new Date(b.last_visit).getTime() : 0;
      return sortBy === "last_visit_asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [rows, query, period, sortBy]);

  const stats = useMemo(() => {
    const totalChildren = rows.length;
    const totalSessions = rows.reduce((s, r) => s + r.total_sessions, 0);
    const totalSpent = rows.reduce((s, r) => s + r.total_spent_cents, 0);
    const activeCount = rows.filter((r) => {
      if (!r.last_visit) return false;
      return Date.now() - new Date(r.last_visit).getTime() < 30 * 24 * 60 * 60 * 1000;
    }).length;
    return { totalChildren, totalSessions, totalSpent, activeCount };
  }, [rows]);

  const exportCsv = () => {
    const head = [
      "Crianca",
      "Idade",
      "Genero",
      "Responsavel",
      "Telefone",
      "Email",
      "Total visitas",
      "Total gasto",
      "Ultima visita",
      "Primeira visita",
    ];
    const lines = [
      head.join(";"),
      ...filtered.map((r) =>
        [
          csv(r.full_name),
          r.birth_date ? csv(String(ageFromBirth(r.birth_date) ?? "")) : "",
          csv(r.gender === "boy" ? "M" : r.gender === "girl" ? "F" : ""),
          csv(r.primary_guardian?.full_name ?? ""),
          csv(r.primary_guardian?.phone ?? ""),
          csv(r.primary_guardian?.email ?? ""),
          r.total_sessions.toString(),
          (r.total_spent_cents / 100).toFixed(2).replace(".", ","),
          csv(r.last_visit ? new Date(r.last_visit).toLocaleString("pt-BR") : ""),
          csv(r.first_visit ? new Date(r.first_visit).toLocaleString("pt-BR") : ""),
        ].join(";")
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-criancas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Historico de criancas"
        description="Ficha completa de cada crianca cadastrada: dados, responsaveis, visitas, gastos."
        actions={
          <div className="hidden gap-2 sm:flex">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="size-3.5" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCcw className="size-3.5" /> Atualizar
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Criancas cadastradas"
            value={stats.totalChildren.toString()}
            color="#1E78DC"
            icon={Baby}
          />
          <KpiCard
            label="Total de visitas"
            value={stats.totalSessions.toString()}
            color="#A6CD3F"
            icon={Star}
          />
          <KpiCard
            label="Faturamento historico"
            value={formatBRL(stats.totalSpent)}
            color="#F39230"
            icon={TrendingUp}
          />
          <KpiCard
            label="Ativas (30 dias)"
            value={stats.activeCount.toString()}
            color="#EA4D8E"
            icon={Crown}
          />
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por crianca, responsavel, telefone ou email"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterPill active={period === "all"} onClick={() => setPeriod("all")}>Tudo</FilterPill>
              <FilterPill active={period === "7d"} onClick={() => setPeriod("7d")}>7 dias</FilterPill>
              <FilterPill active={period === "30d"} onClick={() => setPeriod("30d")}>30 dias</FilterPill>
              <FilterPill active={period === "90d"} onClick={() => setPeriod("90d")}>90 dias</FilterPill>
              <FilterPill active={period === "no_visits"} onClick={() => setPeriod("no_visits")}>
                Sem visitas
              </FilterPill>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
            >
              <option value="last_visit_desc">Ultima visita (recente)</option>
              <option value="last_visit_asc">Ultima visita (antiga)</option>
              <option value="total_sessions_desc">Mais visitas</option>
              <option value="total_spent_desc">Mais gastou</option>
              <option value="name_asc">Nome A-Z</option>
            </select>
          </div>
          {filtered.length !== rows.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Mostrando <strong>{filtered.length}</strong> de <strong>{rows.length}</strong> criancas
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState query={query} period={period} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r) => (
              <ChildCard key={r.id} row={r} onClick={() => setSelected(r)} />
            ))}
          </div>
        )}
      </div>

      <ChildDetailDialog
        row={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex size-9 items-center justify-center rounded-lg text-white"
          style={{ background: color }}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-xl font-bold tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-[#1E78DC] text-white shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}

function ChildCard({
  row,
  onClick,
}: {
  row: ChildHistoryRow;
  onClick: () => void;
}) {
  const age = row.birth_date ? ageFromBirth(row.birth_date) : null;
  const daysSince = row.last_visit ? daysSinceDate(row.last_visit) : null;
  const isVip = row.total_sessions >= 10;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-[#1E78DC] hover:shadow-md"
    >
      {/* Header com foto */}
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[#1E78DC]/20 via-[#7B36BF]/15 to-[#EA4D8E]/20">
        {row.photo_url ? (
          <img
            src={row.photo_url}
            alt={row.full_name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Baby
              className="size-12 text-white/70"
              style={{
                filter:
                  row.gender === "girl"
                    ? "drop-shadow(0 2px 4px rgba(234, 77, 142, 0.5))"
                    : row.gender === "boy"
                      ? "drop-shadow(0 2px 4px rgba(30, 120, 220, 0.5))"
                      : undefined,
              }}
            />
          </div>
        )}
        {isVip ? (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[#F4B73F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow-md">
            <Crown className="size-3" /> VIP
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-2 p-3">
        <div>
          <p className="line-clamp-1 font-bold text-slate-900">{row.full_name}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {age != null ? (
              <span className="inline-flex items-center gap-0.5">
                <Cake className="size-3" /> {age} {age === 1 ? "ano" : "anos"}
              </span>
            ) : null}
            {row.gender ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                {row.gender === "boy" ? "Menino" : "Menina"}
              </span>
            ) : null}
          </div>
        </div>

        {row.primary_guardian ? (
          <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px]">
            <p className="line-clamp-1 font-semibold text-slate-700">
              {row.primary_guardian.full_name}
            </p>
            {row.primary_guardian.phone ? (
              <p className="flex items-center gap-1 text-muted-foreground">
                <Phone className="size-2.5" /> {formatPhone(row.primary_guardian.phone)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <div className="rounded bg-[#A6CD3F]/10 px-2 py-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#5a8e10]">
              Visitas
            </p>
            <p className="font-bold tabular-nums text-slate-900">
              {row.total_sessions}
            </p>
          </div>
          <div className="rounded bg-[#F39230]/10 px-2 py-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#F39230]">
              Gasto
            </p>
            <p className="font-bold tabular-nums text-slate-900">
              {formatBRL(row.total_spent_cents)}
            </p>
          </div>
        </div>

        {row.last_visit ? (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="size-2.5" />
            Ultima:{" "}
            {daysSince === 0
              ? "hoje"
              : daysSince === 1
                ? "ontem"
                : `ha ${daysSince} dias`}
          </p>
        ) : (
          <p className="text-[10px] italic text-muted-foreground">Nunca visitou</p>
        )}
      </div>
    </button>
  );
}

function EmptyState({ query, period }: { query: string; period: PeriodFilter }) {
  const hasFilter = query.trim() || period !== "all";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center">
      <Users className="size-12 text-muted-foreground" />
      <p className="text-base font-semibold">
        {hasFilter ? "Nenhuma crianca encontrada com esses filtros" : "Nenhuma crianca cadastrada ainda"}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        {hasFilter
          ? "Tente outra palavra-chave ou periodo."
          : "Quando voce cadastrar a primeira crianca em /painel, ela aparece aqui com toda historia."}
      </p>
    </div>
  );
}

function ChildDetailDialog({
  row,
  onClose,
}: {
  row: ChildHistoryRow | null;
  onClose: () => void;
}) {
  const { sessions, loading } = useChildSessions(row?.id ?? null);

  if (!row) return null;
  const age = row.birth_date ? ageFromBirth(row.birth_date) : null;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">{row.full_name}</DialogTitle>
        </DialogHeader>

        {/* Hero com foto */}
        <div className="-mt-6 mb-4 -mx-6">
          <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#1E78DC]/30 via-[#7B36BF]/20 to-[#EA4D8E]/30">
            {row.photo_url ? (
              <img
                src={row.photo_url}
                alt={row.full_name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Baby className="size-20 text-white/70" />
              </div>
            )}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="px-6">
            <h2 className="mt-3 text-2xl font-bold">{row.full_name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {age != null ? (
                <span className="inline-flex items-center gap-1">
                  <Cake className="size-3.5" /> {age} {age === 1 ? "ano" : "anos"}
                </span>
              ) : null}
              {row.gender ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  {row.gender === "boy" ? "Menino" : "Menina"}
                </span>
              ) : null}
              {row.birth_date ? (
                <span className="text-[11px]">
                  Nasceu em{" "}
                  {new Date(row.birth_date).toLocaleDateString("pt-BR")}
                </span>
              ) : null}
            </div>
            {row.child_notes ? (
              <p className="mt-2 rounded-md border border-dashed border-border bg-muted/30 p-2 text-xs text-slate-700">
                <strong>Observacoes:</strong> {row.child_notes}
              </p>
            ) : null}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatTile label="Visitas" value={row.total_sessions.toString()} color="#A6CD3F" />
          <StatTile label="Gasto total" value={formatBRL(row.total_spent_cents)} color="#F39230" />
          <StatTile
            label="Cliente desde"
            value={
              row.first_visit
                ? new Date(row.first_visit).toLocaleDateString("pt-BR")
                : "—"
            }
            color="#7B36BF"
          />
        </div>

        {/* Responsaveis */}
        <section className="mb-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Users className="size-3.5" /> Responsaveis ({row.all_guardians.length})
          </h3>
          <div className="space-y-2">
            {row.all_guardians.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                Nenhum responsavel vinculado.
              </p>
            ) : (
              row.all_guardians.map((g) => (
                <div
                  key={g.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <p className="font-semibold text-slate-900">{g.full_name}</p>
                    {g.is_primary ? (
                      <span className="rounded-full bg-[#F4B73F] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-900">
                        Principal
                      </span>
                    ) : null}
                    {g.relationship ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.relationship}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {g.phone ? (
                      <a
                        href={`https://wa.me/55${g.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[#5a8e10] underline-offset-2 hover:underline"
                      >
                        <Phone className="size-3" /> {formatPhone(g.phone)}
                      </a>
                    ) : null}
                    {g.email ? (
                      <a
                        href={`mailto:${g.email}`}
                        className="flex items-center gap-1 text-[#1E78DC] underline-offset-2 hover:underline"
                      >
                        <Mail className="size-3" /> {g.email}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Pagamento por forma */}
        {Object.keys(row.payment_methods).length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Banknote className="size-3.5" /> Formas de pagamento usadas
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(row.payment_methods).map(([method, count]) => (
                <div
                  key={method}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px]"
                >
                  <span className="font-semibold uppercase tracking-wide">
                    {method}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    × {count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Timeline de sessoes */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <CalendarRange className="size-3.5" /> Historico de sessoes
          </h3>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              Sem sessoes registradas.
            </p>
          ) : (
            <div className="space-y-1.5">
              {sessions.map((s) => {
                const start = new Date(s.started_at);
                const end = s.ended_at ? new Date(s.ended_at) : null;
                const durationMin =
                  end != null
                    ? Math.round((end.getTime() - start.getTime()) / 60000)
                    : null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs"
                  >
                    <div className="flex size-9 flex-col items-center justify-center rounded bg-[#1E78DC]/10">
                      <span className="text-[9px] font-bold uppercase text-[#1E78DC]">
                        {start.toLocaleString("pt-BR", { month: "short" }).slice(0, 3)}
                      </span>
                      <span className="text-sm font-bold leading-none text-[#1E78DC]">
                        {start.getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-3 text-muted-foreground" />
                        <span className="font-semibold">
                          {start.toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {s.contracted_minutes} min contratados
                        {durationMin != null ? ` · ${durationMin} min reais` : ""}
                        {s.payment_method ? ` · ${s.payment_method}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">
                        {formatBRL(s.amount_paid_cents ?? 0)}
                      </p>
                      <SessionStatusBadge status={s.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg p-2.5 text-center"
      style={{ background: `${color}15` }}
    >
      <p
        className="text-[9px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </p>
      <p className="text-base font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string }> = {
    active: { label: "Ativa", bg: "#A6CD3F" },
    paused: { label: "Pausada", bg: "#3CB4E0" },
    ended: { label: "Concluida", bg: "#94a3b8" },
  };
  const m = map[status] ?? { label: status, bg: "#94a3b8" };
  return (
    <span
      className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
      style={{ background: m.bg }}
    >
      {m.label}
    </span>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function ageFromBirth(birth: string): number | null {
  try {
    const b = new Date(birth);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  } catch {
    return null;
  }
}

function daysSinceDate(iso: string): number {
  const t = new Date(iso).getTime();
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function formatPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return p;
}

function csv(v: string): string {
  if (v.includes(";") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
