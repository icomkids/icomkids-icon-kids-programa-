import { useMemo, useState } from "react";
import {
  Car,
  Check,
  Copy,
  Download,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Pencil,
  Smile,
  Star,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
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
import { useNpsSurveys } from "@/features/nps/hooks/use-nps-surveys";
import {
  DEFAULT_FORM_CONFIG,
  useFeedbackFormConfig,
  type FeedbackFormConfig,
} from "@/features/nps/hooks/use-form-config";
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

type Tab = "leads" | "publico" | "editor";
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
        r.q_last_car_purchase ? LAST_CAR_LABEL[r.q_last_car_purchase] : "",
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
  a.download = `crm_icom_kids_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function NpsDashboardPage() {
  const { surveys, loading, aggregate } = useNpsSurveys(200);
  const [tab, setTab] = useState<Tab>("leads");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<NpsSurvey | null>(null);

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
        title="CRM & Leads"
        description="Respostas da pesquisa pos-visita, qualificacao iCOM Motos, link publico e editor do formulario."
      />

      <div className="space-y-6 p-6">
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm font-semibold w-fit">
          {(
            [
              { v: "leads" as const, label: "Respostas / Leads" },
              { v: "publico" as const, label: "Link publico" },
              { v: "editor" as const, label: "Editor do form" },
            ]
          ).map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
              className={`rounded-md px-4 py-2 transition ${
                tab === t.v
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "leads" ? (
          <LeadsTab
            surveys={surveys}
            filtered={filtered}
            stats={stats}
            aggregate={aggregate}
            filter={filter}
            setFilter={setFilter}
            loading={loading}
            onSelect={setSelected}
          />
        ) : null}

        {tab === "publico" ? <PublicLinkTab /> : null}

        {tab === "editor" ? <EditorTab /> : null}
      </div>

      {selected ? (
        <LeadDetailDrawer
          survey={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function LeadsTab({
  surveys,
  filtered,
  stats,
  aggregate,
  filter,
  setFilter,
  loading,
  onSelect,
}: {
  surveys: NpsSurvey[];
  filtered: NpsSurvey[];
  stats: ReturnType<typeof useStatsTypeHack>;
  aggregate: ReturnType<typeof useNpsSurveys>["aggregate"];
  filter: Filter;
  setFilter: (f: Filter) => void;
  loading: boolean;
  onSelect: (s: NpsSurvey) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Nota media"
          value={stats.responded.length > 0 ? stats.avgStars.toFixed(1) : "—"}
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

      <section className="mt-6 rounded-xl border border-border bg-card">
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
                  <TableHead className="text-center">Estrelas</TableHead>
                  <TableHead>Pretende trocar?</TableHead>
                  <TableHead>Aceita oferta?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isHot =
                    r.q_intends_trade === "yes" &&
                    r.q_offers_optin &&
                    r.q_offers_optin !== "no";
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => onSelect(r)}
                      className={`cursor-pointer hover:bg-muted/40 ${
                        isHot ? "bg-[#EA4D8E]/5" : ""
                      }`}
                    >
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {r.responded_at
                          ? new Date(r.responded_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
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
                          {!r.guardian_phone && !r.guardian_email ? "—" : null}
                        </div>
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
                            —
                          </span>
                        )}
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
                                r.q_intends_trade === "maybe"
                                  ? "#0f172a"
                                  : "#fff",
                            }}
                          >
                            {INTENDS_TRADE_LABEL[r.q_intends_trade]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.q_offers_optin ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background:
                                r.q_offers_optin === "no"
                                  ? "#94a3b8"
                                  : "#7B36BF",
                              color: "#fff",
                            }}
                          >
                            {OPTIN_LABEL[r.q_offers_optin]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}

function PublicLinkTab() {
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/avaliacao`
      : "https://sistema.icomkids.com.br/avaliacao";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignora
    }
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    publicUrl
  )}`;

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="rounded-xl border border-border bg-card p-6">
        <header className="flex items-center gap-2">
          <LinkIcon className="size-4 text-[#1E78DC]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Formulario publico
          </h2>
        </header>
        <p className="mt-2 text-sm text-muted-foreground">
          Qualquer pessoa pode preencher o formulario nesse link, sem login.
          Compartilhe nas redes, no parque, ou imprima o QR Code ao lado.
          Todas as respostas chegam nessa aba <strong>Respostas / Leads</strong>{" "}
          junto com as enviadas por checkout.
        </p>

        <div className="mt-5 flex items-center gap-2">
          <Input value={publicUrl} readOnly className="font-mono text-xs" />
          <Button
            type="button"
            onClick={() => void copy()}
            className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          >
            {copied ? (
              <>
                <Check className="size-4" /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copiar
              </>
            )}
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              Abrir em nova aba
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={qrUrl}
              download="qr-feedback-icomkids.png"
              target="_blank"
              rel="noreferrer"
            >
              <Download className="size-3.5" /> Baixar QR Code
            </a>
          </Button>
        </div>
      </div>

      <div className="flex justify-center rounded-xl border border-border bg-white p-4">
        <img src={qrUrl} alt="QR Code do formulario publico" />
      </div>
    </section>
  );
}

function EditorTab() {
  const { value, loading, saving, save } = useFeedbackFormConfig();
  const [local, setLocal] = useState<FeedbackFormConfig>(value);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // sincroniza local com value quando carrega ou outro tab edita
  if (!loading && local.q_last_car_label === DEFAULT_FORM_CONFIG.q_last_car_label && value.q_last_car_label !== local.q_last_car_label) {
    setLocal(value);
  }

  const onChange = (k: keyof FeedbackFormConfig, v: string) =>
    setLocal((prev) => ({ ...prev, [k]: v }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await save(local);
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 2500);
  };

  const reset = () => {
    setLocal(DEFAULT_FORM_CONFIG);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex items-center gap-2">
        <Pencil className="size-4 text-[#7B36BF]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Editor do formulario
        </h2>
      </header>
      <p className="mt-2 text-sm text-muted-foreground">
        Edite os textos das 3 perguntas iCOM Motos. As opcoes (Sim/Talvez/Nao
        etc) ficam fixas — apenas o texto da pergunta muda.
      </p>

      <form onSubmit={onSave} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ed-1">Pergunta 1 — historico do carro</Label>
          <Input
            id="ed-1"
            value={local.q_last_car_label}
            onChange={(e) => onChange("q_last_car_label", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Opcoes: Menos de 1 ano · 1 a 3 anos · Mais de 3 anos · Nao tenho
            carro
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-2">Pergunta 2 — intencao</Label>
          <Input
            id="ed-2"
            value={local.q_intends_label}
            onChange={(e) => onChange("q_intends_label", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Opcoes: Sim · Talvez · Nao
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-3">Pergunta 3 — opt-in</Label>
          <Input
            id="ed-3"
            value={local.q_offers_label}
            onChange={(e) => onChange("q_offers_label", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Opcoes: Sim no WhatsApp · Sim no Email · Nao
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={saving || loading}
            className="bg-[#7B36BF] text-white hover:bg-[#7B36BF]/90"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={reset}
            disabled={saving}
          >
            Restaurar padrao
          </Button>
          {savedAt ? (
            <span className="flex items-center gap-1 text-xs text-[#5a8e10]">
              <Check className="size-3.5" /> Salvo
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function LeadDetailDrawer({
  survey,
  onClose,
}: {
  survey: NpsSurvey;
  onClose: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // ignora
    }
  };

  const isHot =
    survey.q_intends_trade === "yes" &&
    survey.q_offers_optin &&
    survey.q_offers_optin !== "no";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Lead
            </p>
            <p className="text-lg font-bold">{survey.guardian_name ?? "—"}</p>
            {isHot ? (
              <span className="mt-1 inline-block rounded-full bg-[#EA4D8E] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Lead quente
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Field label="Criança">{survey.child_name ?? "—"}</Field>

          {survey.guardian_phone ? (
            <FieldWithCopy
              label="WhatsApp"
              value={survey.guardian_phone}
              copied={copiedField === "phone"}
              onCopy={() => copy("phone", survey.guardian_phone!)}
            />
          ) : null}

          {survey.guardian_email ? (
            <FieldWithCopy
              label="Email"
              value={survey.guardian_email}
              copied={copiedField === "email"}
              onCopy={() => copy("email", survey.guardian_email!)}
            />
          ) : null}

          <Field label="Estrelas">
            {survey.stars ? (
              <span className="inline-flex items-center gap-1">
                {survey.stars}
                <Star
                  className="size-4"
                  style={{ color: "#F4B73F", fill: "#F4B73F" }}
                />
              </span>
            ) : (
              "Sem resposta"
            )}
          </Field>

          {survey.comment ? (
            <Field label="Comentario">
              <p className="italic">"{survey.comment}"</p>
            </Field>
          ) : null}

          <div className="rounded-lg border-2 border-dashed border-[#7B36BF]/40 bg-[#7B36BF]/5 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7B36BF]">
              iCOM Motos
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <Field label="Carro atual">
                {survey.q_last_car_purchase
                  ? LAST_CAR_LABEL[survey.q_last_car_purchase]
                  : "—"}
              </Field>
              <Field label="Pretende trocar?">
                {survey.q_intends_trade
                  ? INTENDS_TRADE_LABEL[survey.q_intends_trade]
                  : "—"}
              </Field>
              <Field label="Aceita ofertas?">
                {survey.q_offers_optin
                  ? OPTIN_LABEL[survey.q_offers_optin]
                  : "—"}
              </Field>
            </div>
          </div>

          {survey.guardian_phone || survey.guardian_email ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Acoes rapidas
              </p>
              {survey.guardian_phone ? (
                <Button asChild className="w-full bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90">
                  <a
                    href={`https://wa.me/${survey.guardian_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-4" /> Abrir conversa no
                    WhatsApp
                  </a>
                </Button>
              ) : null}
              {survey.guardian_email ? (
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-[#EA4D8E] text-[#EA4D8E]"
                >
                  <a href={`mailto:${survey.guardian_email}`}>
                    <Mail className="size-4" /> Enviar email
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{children}</p>
    </div>
  );
}

function FieldWithCopy({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="break-all font-mono text-sm">{value}</p>
        <Button type="button" size="sm" variant="ghost" onClick={onCopy}>
          {copied ? (
            <Check className="size-3.5 text-[#5a8e10]" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
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

// helper so the TS infers stats type correctly in LeadsTab signature
function useStatsTypeHack() {
  return {
    responded: [] as NpsSurvey[],
    pending: [] as NpsSurvey[],
    hotLeads: [] as NpsSurvey[],
    avgStars: 0,
  };
}
