import { useMemo, useState } from "react";
import { Car, Download, Mail, MessageCircle, Smile, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
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
import type {
  NpsSurvey,
  QIntendsTrade,
  QLastCarPurchase,
  QOffersOptin,
} from "@/features/nps/types";

const LAST_CAR_LABEL: Record<QLastCarPurchase, string> = {
  lt_1y: "Carro novo (<1 ano)",
  "1_3y": "1-3 anos",
  gt_3y: "Mais de 3 anos",
  no_car: "Sem carro",
};

const INTENDS_TRADE_LABEL: Record<QIntendsTrade, string> = {
  yes: "Quer trocar",
  maybe: "Talvez",
  no: "Nao quer trocar",
};

const OPTIN_LABEL: Record<QOffersOptin, string> = {
  whatsapp: "Opt-in WhatsApp",
  email: "Opt-in Email",
  no: "Sem contato",
};

type Filter = "all" | "responded" | "pending" | "hot_leads";

function exportCsv(rows: NpsSurvey[]) {
  const header = [
    "respondido_em",
    "estrelas",
    "responsavel",
    "telefone",
    "email",
    "crianca",
    "comentario",
    "ultima_compra_carro",
    "pretende_trocar",
    "aceita_ofertas",
  ];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.responded_at ?? "",
        r.stars ?? "",
        r.guardian_name ?? "",
        r.guardian_phone ?? "",
        r.guardian_email ?? "",
        r.child_name ?? "",
        r.comment ?? "",
        r.q_last_car_purchase
          ? LAST_CAR_LABEL[r.q_last_car_purchase]
          : "",
        r.q_intends_trade ? INTENDS_TRADE_LABEL[r.q_intends_trade] : "",
        r.q_offers_optin ? OPTIN_LABEL[r.q_offers_optin] : "",
      ]
        .map(escape)
        .join(",")
    );
  }
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `feedback_icom_kids_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function NpsDashboardPage() {
  const { surveys, loading, aggregate } = useNpsSurveys(200);
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => {
    const responded = surveys.filter((s) => s.responded_at != null);
    const pending = surveys.filter((s) => s.responded_at == null);
    const hotLeads = responded.filter(
      (s) =>
        s.q_intends_trade === "yes" &&
        s.q_offers_optin &&
        s.q_offers_optin !== "no"
    );
    const avgStars =
      responded.length > 0
        ? responded.reduce((a, s) => a + (s.stars ?? 0), 0) / responded.length
        : 0;
    return { responded, pending, hotLeads, avgStars };
  }, [surveys]);

  const filtered = useMemo(() => {
    if (filter === "responded") return stats.responded;
    if (filter === "pending") return stats.pending;
    if (filter === "hot_leads") return stats.hotLeads;
    return surveys;
  }, [filter, stats, surveys]);

  return (
    <div>
      <PageHeader
        title="Pesquisa pos-visita"
        description="Avaliacao do parque + qualificacao de leads pra iCOM Motos. Enviada por WhatsApp e Email apos o checkout."
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Nota media"
            value={
              stats.responded.length > 0
                ? stats.avgStars.toFixed(1)
                : "—"
            }
            sub={
              stats.responded.length > 0
                ? `${stats.avgStars.toFixed(1)} / 5 estrelas`
                : "Sem respostas"
            }
            color="#F4B73F"
            icon={<Star className="size-4 text-[#F4B73F]" />}
          />
          <Kpi
            label="Enviadas"
            value={aggregate.numSent.toString()}
            color="#1E78DC"
          />
          <Kpi
            label="Respondidas"
            value={aggregate.numResponded.toString()}
            sub={`${aggregate.responseRate}% de resposta`}
            color="#3CB4E0"
          />
          <Kpi
            label="Leads quentes"
            value={stats.hotLeads.length.toString()}
            sub="Quer trocar + aceita contato"
            color="#EA4D8E"
            icon={<Car className="size-4 text-[#EA4D8E]" />}
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { v: "all" as const, label: "Todas", count: surveys.length },
                  {
                    v: "responded" as const,
                    label: "Respondidas",
                    count: stats.responded.length,
                  },
                  {
                    v: "pending" as const,
                    label: "Pendentes",
                    count: stats.pending.length,
                  },
                  {
                    v: "hot_leads" as const,
                    label: "Leads quentes",
                    count: stats.hotLeads.length,
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFilter(opt.v)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    filter === opt.v
                      ? "bg-[#1E78DC] text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {opt.label} · {opt.count}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportCsv(filtered)}
              disabled={filtered.length === 0}
              className="border-[#1E78DC] text-[#1E78DC]"
            >
              <Download className="size-3.5" /> CSV
            </Button>
          </header>

          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
              <Smile className="size-8" />
              <p>Nada por aqui ainda nesse filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Crianca</TableHead>
                    <TableHead className="text-center">Estrelas</TableHead>
                    <TableHead>Carro atual</TableHead>
                    <TableHead>Pretende trocar?</TableHead>
                    <TableHead>Aceita oferta?</TableHead>
                    <TableHead>Comentario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className={
                        r.q_intends_trade === "yes" &&
                        r.q_offers_optin &&
                        r.q_offers_optin !== "no"
                          ? "bg-[#EA4D8E]/5"
                          : undefined
                      }
                    >
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {r.responded_at
                          ? new Date(r.responded_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : r.sent_at
                          ? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.guardian_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex flex-col">
                          {r.guardian_phone ? (
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="size-3 text-[#A6CD3F]" />
                              {r.guardian_phone}
                            </span>
                          ) : null}
                          {r.guardian_email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="size-3 text-[#EA4D8E]" />
                              {r.guardian_email}
                            </span>
                          ) : null}
                          {!r.guardian_phone && !r.guardian_email ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.child_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.stars ? (
                          <span className="inline-flex items-center gap-0.5 font-bold tabular-nums">
                            {r.stars}
                            <Star
                              className="size-3"
                              style={{ color: "#F4B73F", fill: "#F4B73F" }}
                            />
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            sem resposta
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.q_last_car_purchase
                          ? LAST_CAR_LABEL[r.q_last_car_purchase]
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {r.q_intends_trade ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background:
                                r.q_intends_trade === "yes"
                                  ? "#EA4D8E"
                                  : r.q_intends_trade === "maybe"
                                  ? "#F4B73F"
                                  : "#94a3b8",
                              color:
                                r.q_intends_trade === "yes"
                                  ? "#fff"
                                  : r.q_intends_trade === "maybe"
                                  ? "#0f172a"
                                  : "#fff",
                            }}
                          >
                            {INTENDS_TRADE_LABEL[r.q_intends_trade]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.q_offers_optin ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background:
                                r.q_offers_optin === "no" ? "#94a3b8" : "#7B36BF",
                              color: "#fff",
                            }}
                          >
                            {OPTIN_LABEL[r.q_offers_optin]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {r.comment ?? ""}
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

function Kpi({
  label,
  value,
  color,
  sub,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {icon}
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
