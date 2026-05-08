import { useMemo } from "react";
import { GraduationCap } from "lucide-react";
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
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";
import { useActiveSessions } from "@/features/crm/hooks/use-active-sessions";
import { sessionsRepo } from "@/features/crm/lib/sessions-repo";
import { NewPartnerDialog } from "@/features/partners/components/new-partner-dialog";
import { usePartners } from "@/features/partners/hooks/use-partners";
import { formatBRL } from "@/lib/format";
import type { ActiveSession } from "@/features/crm/types";
import type { Partner } from "@/features/partners/types";
import { useEffect, useState } from "react";

interface PartnerStats {
  numChildren: number;
  faturamentoCents: number;
  commissionCents: number;
}

function aggregatePartnerStats(
  sessions: ActiveSession[],
  partner: Partner
): PartnerStats {
  const ofPartner = sessions.filter((s) => s.partner_id === partner.id);
  const faturamentoCents = ofPartner.reduce(
    (acc, s) => acc + (s.amount_paid_cents ?? 0),
    0
  );
  return {
    numChildren: ofPartner.length,
    faturamentoCents,
    commissionCents: Math.round((faturamentoCents * partner.commission_pct) / 100),
  };
}

/** Pull last 30 days of sessions to compute partner KPIs. */
function useRecentSessions(days: number) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await sessionsRepo.listSinceDays(days);
        if (!cancelled) setSessions(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    refresh();
    const unsubscribe = sessionsRepo.subscribe(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [days]);
  return { sessions, loading };
}

export default function PartnersPage() {
  // Keep the realtime active-sessions subscription warm so the page reflects
  // new registrations the moment they happen on the painel.
  useActiveSessions();
  const { partners, loading: partnersLoading, create } = usePartners(false);
  const { sessions, loading: sessionsLoading } = useRecentSessions(30);

  const totals = useMemo(() => {
    const attributed = sessions.filter((s) => s.partner_id);
    const fat = attributed.reduce((acc, s) => acc + (s.amount_paid_cents ?? 0), 0);
    const commission = partners.reduce((acc, p) => {
      const stats = aggregatePartnerStats(sessions, p);
      return acc + stats.commissionCents;
    }, 0);
    return {
      numPartners: partners.filter((p) => p.active).length,
      numAttributedChildren: attributed.length,
      faturamentoCents: fat,
      commissionCents: commission,
    };
  }, [partners, sessions]);

  const loading = partnersLoading || sessionsLoading;

  return (
    <div>
      <PageHeader
        title="Parceiros"
        description="Escolas e parceiros que indicam criancas — comissoes e desempenho dos ultimos 30 dias."
        actions={<NewPartnerDialog onSubmit={create} />}
      />

      <div className="space-y-6 p-6">
        {isUsingMockData ? (
          <div className="rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-2 text-xs">
            <strong>Modo demo:</strong> 2 parceiros mock pre-cadastrados.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Parceiros ativos"
            value={loading ? "—" : totals.numPartners.toString()}
            color="#1E78DC"
          />
          <Kpi
            label="Criancas via parceria"
            value={loading ? "—" : totals.numAttributedChildren.toString()}
            color="#3CB4E0"
          />
          <Kpi
            label="Faturamento atribuido"
            value={loading ? "—" : formatBRL(totals.faturamentoCents)}
            color="#A6CD3F"
            sub="ultimos 30 dias"
          />
          <Kpi
            label="Comissoes a pagar"
            value={loading ? "—" : formatBRL(totals.commissionCents)}
            color="#EA4D8E"
            sub="ultimos 30 dias"
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Parceiros cadastrados
            </h2>
            <p className="text-xs text-muted-foreground">{partners.length} no total</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <GraduationCap className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">Nenhum parceiro cadastrado</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use o botao <strong>Novo parceiro</strong> no topo para registrar
                a primeira escola/parceiro.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Comissao</TableHead>
                    <TableHead className="text-right">Criancas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">A pagar</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => {
                    const stats = aggregatePartnerStats(sessions, p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{p.contact_name ?? "—"}</span>
                            {p.contact_phone ? (
                              <span className="text-[11px]">
                                {p.contact_phone}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.commission_pct}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {stats.numChildren}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(stats.faturamentoCents)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-[#EA4D8E]">
                          {formatBRL(stats.commissionCents)}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: p.active ? "#A6CD3F" : "#94a3b8",
                              color: p.active ? "#0f172a" : "#ffffff",
                            }}
                          >
                            {p.active ? "Ativo" : "Inativo"}
                          </span>
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
