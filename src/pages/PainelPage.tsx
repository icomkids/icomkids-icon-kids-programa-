import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/header";
import { ChildSessionCard } from "@/features/crm/components/child-session-card";
import { QuickRegisterDialog } from "@/features/crm/components/quick-register-dialog";
import {
  useActiveSessions,
  useTicker,
} from "@/features/crm/hooks/use-active-sessions";
import { derivedStatus } from "@/features/crm/lib/session-timing";
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";

export default function PainelPage() {
  useTicker(1000);
  const { sessions, loading, error, registerAndStart, pause, resume, end } =
    useActiveSessions();

  const counts = useMemo(() => {
    const summary = { active: 0, ending_soon: 0, expired: 0, paused: 0 };
    for (const s of sessions) {
      const d = derivedStatus(s);
      if (d in summary) summary[d as keyof typeof summary] += 1;
    }
    return summary;
  }, [sessions]);

  return (
    <div>
      <PageHeader
        title="Painel de criancas"
        description="Sessoes ativas, com tempo correndo em tempo real."
        actions={<QuickRegisterDialog onSubmit={registerAndStart} />}
      />

      <div className="space-y-6 p-6">
        {isUsingMockData ? (
          <div className="rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-2 text-xs">
            <strong>Modo demo:</strong> dados simulados. Aplique a migration no Supabase
            (<code>npx supabase db push</code>) e mude <code>VITE_USE_MOCK_DATA=false</code> no
            <code> .env.local</code> para usar o banco real.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Ativos" value={counts.active} color="#A6CD3F" />
          <SummaryTile label="Acabando" value={counts.ending_soon} color="#F4B73F" />
          <SummaryTile label="Esgotados" value={counts.expired} color="#EA4D8E" />
          <SummaryTile label="Pausados" value={counts.paused} color="#3CB4E0" />
        </div>

        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sessions.map((s) => (
              <ChildSessionCard
                key={s.id}
                session={s}
                onPause={(id) => void pause(id)}
                onResume={(id) => void resume(id)}
                onEnd={(id) => void end(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="flex items-end justify-between px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center">
      <p className="text-base font-semibold">Nenhuma crianca ativa no momento</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Use o botao <strong>Novo cadastro</strong> no topo para iniciar uma sessao.
      </p>
    </div>
  );
}
