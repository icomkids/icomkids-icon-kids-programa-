import { Smile, Meh, Frown, Quote } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNpsSurveys } from "@/features/nps/hooks/use-nps-surveys";
import { formatTimeOfDay } from "@/lib/format";
import type { NpsClassification } from "@/features/nps/types";

const classMeta: Record<
  NpsClassification,
  { label: string; bg: string; fg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  promoter: { label: "Promotor", bg: "#A6CD3F", fg: "#0f172a", icon: Smile },
  passive: { label: "Neutro", bg: "#F4B73F", fg: "#0f172a", icon: Meh },
  detractor: { label: "Detrator", bg: "#EA4D8E", fg: "#ffffff", icon: Frown },
};

function npsScoreColor(score: number): string {
  if (score >= 50) return "#A6CD3F";
  if (score >= 0) return "#F4B73F";
  return "#EA4D8E";
}

export default function NpsDashboardPage() {
  const { surveys, loading, aggregate } = useNpsSurveys(100);

  const responded = surveys.filter((s) => s.responded_at != null);
  const testimonials = responded
    .filter((s) => s.classification === "promoter" && s.comment && s.comment.trim().length > 0)
    .slice(0, 5);
  const detractorComments = responded.filter(
    (s) => s.classification === "detractor" && s.comment && s.comment.trim().length > 0
  );

  return (
    <div>
      <PageHeader
        title="NPS automatico"
        description="Pesquisa enviada por WhatsApp apos o checkout. Acompanhe satisfacao em tempo real."
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div
              className="h-1.5"
              style={{
                background: aggregate.numResponded > 0
                  ? npsScoreColor(aggregate.npsScore)
                  : "#94a3b8",
              }}
            />
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                NPS Score
              </p>
              <p
                className="mt-1 text-3xl font-black tabular-nums"
                style={{
                  color: aggregate.numResponded > 0
                    ? npsScoreColor(aggregate.npsScore)
                    : "#94a3b8",
                }}
              >
                {aggregate.numResponded > 0 ? aggregate.npsScore : "—"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Escala de -100 a +100
              </p>
            </div>
          </div>
          <Kpi
            label="Promotores"
            value={aggregate.promoters.toString()}
            sub={
              aggregate.numResponded > 0
                ? `${Math.round((aggregate.promoters / aggregate.numResponded) * 100)}%`
                : undefined
            }
            color="#A6CD3F"
          />
          <Kpi
            label="Neutros"
            value={aggregate.passives.toString()}
            sub={
              aggregate.numResponded > 0
                ? `${Math.round((aggregate.passives / aggregate.numResponded) * 100)}%`
                : undefined
            }
            color="#F4B73F"
          />
          <Kpi
            label="Detratores"
            value={aggregate.detractors.toString()}
            sub={
              aggregate.numResponded > 0
                ? `${Math.round((aggregate.detractors / aggregate.numResponded) * 100)}%`
                : undefined
            }
            color="#EA4D8E"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi
            label="Pesquisas enviadas"
            value={aggregate.numSent.toString()}
            color="#1E78DC"
          />
          <Kpi
            label="Respondidas"
            value={aggregate.numResponded.toString()}
            color="#3CB4E0"
          />
          <Kpi
            label="Taxa de resposta"
            value={`${aggregate.responseRate}%`}
            color="#7B36BF"
          />
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-center gap-2">
              <Quote className="size-4 text-[#A6CD3F]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Depoimentos (promotores)
              </h2>
            </header>
            {testimonials.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Ainda nao temos depoimentos. Eles aparecem aqui quando promotores
                deixam comentarios.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {testimonials.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-[#A6CD3F]/40 bg-[#A6CD3F]/5 p-3 text-sm"
                  >
                    <p className="italic">"{t.comment}"</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      — {t.guardian_name ?? "Cliente"}
                      {t.child_name ? ` (resp. de ${t.child_name})` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-center gap-2">
              <Frown className="size-4 text-[#EA4D8E]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Pontos de atencao (detratores)
              </h2>
            </header>
            {detractorComments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma critica com comentario por enquanto.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {detractorComments.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg border border-[#EA4D8E]/40 bg-[#EA4D8E]/5 p-3 text-sm"
                  >
                    <p className="italic">"{d.comment}"</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      — {d.guardian_name ?? "Cliente"} · nota {d.score}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Respostas recentes
            </h2>
            <p className="text-xs text-muted-foreground">
              {responded.length} respondidas / {surveys.length} totais
            </p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : responded.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
              <Smile className="size-8" />
              <p>Sem respostas ainda. As pesquisas saem automaticamente no checkout.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Crianca</TableHead>
                    <TableHead className="text-right">Nota</TableHead>
                    <TableHead>Classificacao</TableHead>
                    <TableHead>Comentario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responded.map((r) => {
                    const meta = r.classification ? classMeta[r.classification] : null;
                    const Icon = meta?.icon ?? Meh;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {r.responded_at ? formatTimeOfDay(r.responded_at) : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.guardian_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.child_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {r.score}
                        </TableCell>
                        <TableCell>
                          {meta ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                              style={{ background: meta.bg, color: meta.fg }}
                            >
                              <Icon className="size-3" />
                              {meta.label}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                          {r.comment ?? ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {sub ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}
