import { useMemo, useState } from "react";
import {
  CreditCard,
  History,
  LockKeyhole,
  QrCode,
  ShieldAlert,
  ShoppingCart,
  Unlock,
  Wallet,
  XCircle,
} from "lucide-react";
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
import { useAuth } from "@/features/auth/auth-context";
import {
  AbrirCaixaButton,
  CancelarMovimentoDialog,
  FecharCaixaButton,
  SangriaButton,
  SuprimentoButton,
} from "@/features/caixa/components/caixa-dialogs";
import {
  useCaixaAberta,
  useSessoesFechadas,
} from "@/features/caixa/hooks/use-caixa";
import { formatBRL } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useEffect, useState as useStateReact } from "react";
import type {
  CaixaMovimento,
  CaixaMovimentoTipo,
} from "@/features/caixa/types";

type Tab = "atual" | "historico";

const TIPO_LABEL: Record<CaixaMovimentoTipo, string> = {
  venda: "Venda",
  suprimento: "Suprimento",
  sangria: "Sangria",
  ajuste: "Ajuste",
};

const TIPO_COLOR: Record<CaixaMovimentoTipo, string> = {
  venda: "#A6CD3F",
  suprimento: "#1E78DC",
  sangria: "#EA4D8E",
  ajuste: "#7B36BF",
};

const PAY_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pix: { label: "PIX", color: "#A6CD3F", icon: QrCode },
  dinheiro: { label: "Dinheiro", color: "#F4B73F", icon: Wallet },
  cartao: { label: "Cartao", color: "#1E78DC", icon: CreditCard },
};

function useIsOwner() {
  const auth = useAuth();
  const [isOwner, setIsOwner] = useStateReact(false);
  useEffect(() => {
    if (!auth.session?.user?.id) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsOwner((data?.role ?? null) === "owner");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.session?.user?.id]);
  return isOwner;
}

export default function CaixaPage() {
  const [tab, setTab] = useState<Tab>("atual");
  const { sessao, movimentos, resumo, loading } = useCaixaAberta();

  return (
    <div>
      <PageHeader
        title="Caixa"
        description="Abertura, movimentacao, sangria, suprimento e fechamento com auditoria."
      />

      <div className="space-y-6 p-6">
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setTab("atual")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 transition ${
              tab === "atual"
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="size-4" /> Caixa atual
          </button>
          <button
            type="button"
            onClick={() => setTab("historico")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 transition ${
              tab === "historico"
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="size-4" /> Historico
          </button>
        </div>

        {tab === "atual" ? (
          loading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : !sessao ? (
            <CaixaFechadoView />
          ) : (
            <CaixaAbertoView
              sessao={sessao}
              movimentos={movimentos}
              resumo={resumo}
            />
          )
        ) : (
          <HistoricoView />
        )}
      </div>
    </div>
  );
}

function CaixaFechadoView() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-card p-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <LockKeyhole className="size-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-bold">Caixa fechado</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Antes de cadastrar criancas, vender no PDV ou registrar qualquer
          pagamento, abra o caixa informando o troco inicial. O sistema cria
          uma sessao e numera cada movimento sequencialmente.
        </p>
      </div>
      <AbrirCaixaButton />
    </div>
  );
}

function CaixaAbertoView({
  sessao,
  movimentos,
  resumo,
}: {
  sessao: import("@/features/caixa/types").CaixaSessao;
  movimentos: CaixaMovimento[];
  resumo: import("@/features/caixa/types").CaixaResumo;
}) {
  const isOwner = useIsOwner();
  const [filter, setFilter] = useState<CaixaMovimentoTipo | "all">("all");
  const filtered = useMemo(
    () => (filter === "all" ? movimentos : movimentos.filter((m) => m.tipo === filter)),
    [filter, movimentos]
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#A6CD3F] bg-[#A6CD3F]/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#A6CD3F]">
            <Unlock className="size-5 text-slate-900" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#5a8e10]">
              Caixa aberto
            </p>
            <p className="text-sm">
              Desde{" "}
              {new Date(sessao.aberto_em).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · Troco inicial:{" "}
              <strong>{formatBRL(sessao.valor_abertura_cents)}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SuprimentoButton />
          <SangriaButton />
          <FecharCaixaButton resumo={resumo} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Faturamento (todos meios)"
          value={formatBRL(resumo.vendas_total_cents)}
          color="#A6CD3F"
          sub={`${resumo.num_vendas} vendas`}
        />
        <Kpi
          label="Dinheiro fisico esperado"
          value={formatBRL(resumo.esperado_em_caixa_cents)}
          color="#F4B73F"
          sub="No caixa fisico agora"
        />
        <Kpi
          label="Sangrias"
          value={formatBRL(resumo.sangrias_cents)}
          color="#EA4D8E"
          sub="Dinheiro que saiu"
        />
        <Kpi
          label="Suprimentos"
          value={formatBRL(resumo.suprimentos_cents)}
          color="#1E78DC"
          sub="Reforco de troco"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="PIX"
          value={formatBRL(resumo.vendas_pix_cents)}
          color="#A6CD3F"
          icon={<QrCode className="size-4 text-[#A6CD3F]" />}
        />
        <Kpi
          label="Dinheiro"
          value={formatBRL(resumo.vendas_dinheiro_cents)}
          color="#F4B73F"
          icon={<Wallet className="size-4 text-[#F4B73F]" />}
        />
        <Kpi
          label="Cartao"
          value={formatBRL(resumo.vendas_cartao_cents)}
          color="#1E78DC"
          icon={<CreditCard className="size-4 text-[#1E78DC]" />}
        />
      </div>

      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { v: "all" as const, label: `Todos · ${movimentos.length}` },
                { v: "venda" as const, label: `Vendas · ${movimentos.filter((m) => m.tipo === "venda").length}` },
                { v: "sangria" as const, label: `Sangrias · ${movimentos.filter((m) => m.tipo === "sangria").length}` },
                { v: "suprimento" as const, label: `Suprimentos · ${movimentos.filter((m) => m.tipo === "suprimento").length}` },
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
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Nenhum movimento ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const isCanceled = m.cancelado_em != null;
                  const pay = m.forma_pagamento
                    ? PAY_META[m.forma_pagamento]
                    : null;
                  return (
                    <TableRow
                      key={m.id}
                      className={isCanceled ? "opacity-50 line-through" : ""}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.numero_seq}
                      </TableCell>
                      <TableCell>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: TIPO_COLOR[m.tipo],
                            color: m.tipo === "venda" || m.tipo === "ajuste" ? "#0f172a" : "#fff",
                          }}
                        >
                          {TIPO_LABEL[m.tipo]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {pay ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: pay.color }}
                          >
                            <pay.icon className="size-3" />
                            <span className="text-foreground">{pay.label}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs">
                        {m.descricao ?? "—"}
                        {isCanceled ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-[#EA4D8E]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#EA4D8E]">
                            <ShieldAlert className="size-3" />
                            Cancelado: {m.motivo_cancelamento}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {new Date(m.criado_em).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell
                        className="text-right font-mono font-bold tabular-nums"
                        style={{
                          color:
                            m.tipo === "sangria" ? "#EA4D8E" : "#0f172a",
                        }}
                      >
                        {m.tipo === "sangria" ? "-" : ""}
                        {formatBRL(m.valor_cents)}
                      </TableCell>
                      <TableCell>
                        {!isCanceled && isOwner ? (
                          <CancelarMovimentoDialog
                            movimentoId={m.id}
                            trigger={
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Cancelar movimento"
                                className="text-[#EA4D8E]"
                              >
                                <XCircle className="size-4" />
                              </Button>
                            }
                          />
                        ) : null}
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

function HistoricoView() {
  const { sessoes, loading } = useSessoesFechadas(50);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (sessoes.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Nenhuma sessao fechada ainda.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Sessoes anteriores
        </h2>
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aberto em</TableHead>
              <TableHead>Fechado em</TableHead>
              <TableHead className="text-right">Abertura</TableHead>
              <TableHead className="text-right">Esperado</TableHead>
              <TableHead className="text-right">Contado</TableHead>
              <TableHead className="text-right">Diferenca</TableHead>
              <TableHead>Observacao</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessoes.map((s) => {
              const dif = s.diferenca_cents ?? 0;
              const absdif = Math.abs(dif);
              const color = dif === 0 ? "#A6CD3F" : absdif > 500 ? "#EA4D8E" : "#F4B73F";
              return (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">
                    {new Date(s.aberto_em).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.fechado_em
                      ? new Date(s.fechado_em).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatBRL(s.valor_abertura_cents)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatBRL(s.valor_esperado_cents ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatBRL(s.valor_contado_cents ?? 0)}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono text-sm font-bold tabular-nums"
                    style={{ color }}
                  >
                    {dif > 0 ? "+" : ""}
                    {formatBRL(dif)}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                    {s.observacoes ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
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
