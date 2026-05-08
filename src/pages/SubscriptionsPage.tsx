import { useMemo } from "react";
import { CheckCircle2, Star, X } from "lucide-react";
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
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";
import { NewPlanDialog } from "@/features/subscriptions/components/new-plan-dialog";
import { NewSubscriptionDialog } from "@/features/subscriptions/components/new-subscription-dialog";
import { usePlans } from "@/features/subscriptions/hooks/use-plans";
import { useSubscriptions } from "@/features/subscriptions/hooks/use-subscriptions";
import { formatBRL } from "@/lib/format";
import type { Subscription, SubscriptionStatus } from "@/features/subscriptions/types";

const statusStyles: Record<SubscriptionStatus, { label: string; bg: string; fg: string }> = {
  active: { label: "Ativo", bg: "#A6CD3F", fg: "#0f172a" },
  paused: { label: "Pausado", bg: "#3CB4E0", fg: "#0f172a" },
  canceled: { label: "Cancelado", bg: "#94a3b8", fg: "#ffffff" },
  expired: { label: "Expirado", bg: "#EA4D8E", fg: "#ffffff" },
};

function formatDateBR(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function SubscriptionsPage() {
  const { plans, loading: plansLoading, create: createPlan, setActive } = usePlans(false);
  const {
    subscriptions,
    loading: subsLoading,
    create: createSubscription,
    cancel: cancelSubscription,
    recordPayment,
  } = useSubscriptions();

  const totals = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active");
    const mrr = active.reduce((acc, s) => acc + s.plan_monthly_cents, 0);
    const todayIso = new Date().toISOString().slice(0, 10);
    const overdue = active.filter((s) => s.next_billing_on < todayIso);
    return {
      activePlans: plans.filter((p) => p.active).length,
      activeSubs: active.length,
      mrr,
      overdue: overdue.length,
    };
  }, [plans, subscriptions]);

  const handleRecordPayment = async (sub: Subscription) => {
    if (!confirm(`Registrar pagamento de ${formatBRL(sub.plan_monthly_cents)}?`))
      return;
    await recordPayment(sub.id, sub.plan_monthly_cents, "pix");
  };

  const handleCancel = async (sub: Subscription) => {
    if (!confirm(`Cancelar assinatura de ${sub.guardian_name}?`)) return;
    await cancelSubscription(sub.id);
  };

  return (
    <div>
      <PageHeader
        title="Assinaturas"
        description="Planos mensais, assinantes ativos e cobrancas."
        actions={
          <div className="flex items-center gap-2">
            <NewPlanDialog onSubmit={createPlan} />
            <NewSubscriptionDialog onSubmit={createSubscription} />
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {isUsingMockData ? (
          <div className="rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-2 text-xs">
            <strong>Modo demo:</strong> 2 planos mock pre-cadastrados.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Planos ativos" value={plans.filter((p) => p.active).length.toString()} color="#1E78DC" />
          <Kpi label="Assinantes ativos" value={totals.activeSubs.toString()} color="#A6CD3F" />
          <Kpi
            label="MRR"
            value={formatBRL(totals.mrr)}
            color="#F39230"
            sub="receita recorrente mensal"
          />
          <Kpi
            label="Cobrancas atrasadas"
            value={totals.overdue.toString()}
            color="#EA4D8E"
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Planos disponiveis
            </h2>
            <p className="text-xs text-muted-foreground">{plans.length} no total</p>
          </header>
          {plansLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Star className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">Nenhum plano cadastrado</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use o botao <strong>Novo plano</strong> para criar a primeira
                modalidade de assinatura.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold">{p.name}</p>
                      {p.description ? (
                        <p className="text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        background: p.active ? "#A6CD3F" : "#94a3b8",
                        color: p.active ? "#0f172a" : "#ffffff",
                      }}
                    >
                      {p.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-[#1E78DC]">
                    {formatBRL(p.monthly_cents)}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      /mes
                    </span>
                  </p>
                  <ul className="mt-3 space-y-1 text-xs">
                    {p.included_minutes > 0 ? (
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3 text-[#A6CD3F]" />
                        {(p.included_minutes / 60).toFixed(1).replace(".0", "")}h
                        /mes incluidas
                      </li>
                    ) : null}
                    {p.discount_pct > 0 ? (
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3 text-[#A6CD3F]" />
                        {p.discount_pct}% off em produtos
                      </li>
                    ) : null}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-3 w-full text-xs"
                    onClick={() => setActive(p.id, !p.active)}
                  >
                    {p.active ? "Desativar" : "Reativar"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Assinantes
            </h2>
            <p className="text-xs text-muted-foreground">
              {subscriptions.length} no total
            </p>
          </header>
          {subsLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              Nenhum assinante cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsavel</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Mensalidade</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Proxima cobranca</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((s) => {
                    const style = statusStyles[s.status];
                    const todayIso = new Date().toISOString().slice(0, 10);
                    const overdue = s.status === "active" && s.next_billing_on < todayIso;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.guardian_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.plan_name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(s.plan_monthly_cents)}
                        </TableCell>
                        <TableCell>{formatDateBR(s.starts_on)}</TableCell>
                        <TableCell
                          className={overdue ? "font-semibold text-[#EA4D8E]" : ""}
                        >
                          {formatDateBR(s.next_billing_on)}
                          {overdue ? " · em atraso" : ""}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: style.bg, color: style.fg }}
                          >
                            {style.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.status === "active" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleRecordPayment(s)}
                              >
                                <CheckCircle2 className="size-3.5" />
                                Pago
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-[#EA4D8E]"
                                onClick={() => handleCancel(s)}
                              >
                                <X className="size-3.5" />
                                Cancelar
                              </Button>
                            </div>
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
