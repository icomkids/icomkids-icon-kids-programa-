import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/header";
import { ChildSessionCard } from "@/features/crm/components/child-session-card";
import { QuickRegisterDialog } from "@/features/crm/components/quick-register-dialog";
import {
  useActiveSessions,
  useTicker,
} from "@/features/crm/hooks/use-active-sessions";
import { usePricing } from "@/features/crm/hooks/use-pricing";
import {
  computeOverage,
  derivedStatus,
} from "@/features/crm/lib/session-timing";
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";
import { loyaltyRepo } from "@/features/loyalty/lib/loyalty-repo";
import { formatBRL } from "@/lib/format";
import { sendEmail } from "@/features/messaging/lib/resend";
import { sendWhatsApp } from "@/features/messaging/lib/uazapi";
import { npsRepo } from "@/features/nps/lib/nps-repo";
import { termsRepo } from "@/features/terms/lib/terms-repo";
import type { ActiveSession } from "@/features/crm/types";

/**
 * Awards 1 loyalty point per R$1 spent on the session. Idempotency: each
 * session has a unique id; the RPC inserts a transaction tied to it. If
 * the operator ends the same session twice, the same points are added
 * twice — that's a known limitation we accept for the MVP (the painel
 * removes the card on first end, so double-clicks are unusual).
 */
async function fireLoyaltyAccrual(session: ActiveSession) {
  if (!session.guardian) return;
  const points = Math.floor((session.amount_paid_cents ?? 0) / 100);
  if (points <= 0) return;
  try {
    await loyaltyRepo.awardPoints(
      session.guardian.id,
      points,
      `Sessao de ${session.child.full_name}`,
      { session_id: session.id }
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Loyalty accrual failed:", e);
  }
}

/**
 * After a session is ended, auto-create a feedback survey and notify the
 * guardian via WhatsApp + Email (whichever contacts are on file). Survey
 * is created even if no contact info exists — the owner can follow up
 * manually in the /nps dashboard.
 *
 * Silently swallows failures so it never blocks the operator's flow.
 */
async function fireFeedbackFollowUp(session: ActiveSession) {
  if (!session.guardian) return;
  const { full_name, phone, email } = session.guardian;
  try {
    const survey = await npsRepo.create({
      session_id: session.id,
      guardian_name: full_name,
      guardian_phone: phone,
      guardian_email: email,
      child_name: session.child.full_name,
    });
    const link = `${window.location.origin}/nps/${survey.token}`;
    const variables = {
      nome: full_name,
      crianca: session.child.full_name,
      link,
    };

    const tasks: Promise<{ ok: boolean }>[] = [];
    if (phone) {
      tasks.push(
        sendWhatsApp({
          phone,
          template_key: "nps_survey",
          variables,
          event_type: "feedback_survey",
          context: { session_id: session.id, survey_id: survey.id },
        })
      );
    }
    if (email) {
      tasks.push(
        sendEmail({
          to: email,
          to_name: full_name,
          template_key: "email_feedback_survey",
          variables,
          subject: `Obrigado pela visita, ${full_name}! Avalie em 1 minuto.`,
          event_type: "feedback_survey",
          context: { session_id: session.id, survey_id: survey.id },
        })
      );
    }
    if (tasks.length === 0) return;

    const results = await Promise.all(tasks);
    if (results.some((r) => r.ok)) {
      await npsRepo.markSent(survey.id);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Feedback follow-up failed:", e);
  }
}

/**
 * Quando uma sessao comeca, cria uma solicitacao de termo de
 * responsabilidade pra essa familia e manda o link por WhatsApp +
 * Email. Silencioso em falha pra nao bloquear o atendimento.
 */
async function fireSessionWelcome(session: ActiveSession) {
  if (!session.guardian) return;
  const { full_name, phone, email } = session.guardian;
  if (!phone && !email) return; // sem contato, nao envia (operador cria manual em /termo)
  try {
    const req = await termsRepo.createRequest({
      guardian_name: full_name,
      guardian_phone: phone ?? undefined,
      child_name: session.child.full_name,
    });
    const link = `${window.location.origin}/termo/sign/${req.token}`;
    const variables = {
      nome: full_name,
      crianca: session.child.full_name,
      tempo: session.contracted_minutes.toString(),
      link,
    };

    const tasks: Promise<unknown>[] = [];
    if (phone) {
      tasks.push(
        sendWhatsApp({
          phone,
          template_key: "wa_session_welcome",
          variables,
          event_type: "session_welcome",
          context: { session_id: session.id, term_id: req.id },
        })
      );
    }
    if (email) {
      tasks.push(
        sendEmail({
          to: email,
          to_name: full_name,
          template_key: "email_session_welcome",
          variables,
          subject: `${full_name}, a ${session.child.full_name} chegou! Assine o termo`,
          event_type: "session_welcome",
          context: { session_id: session.id, term_id: req.id },
        })
      );
    }
    await Promise.all(tasks);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Session welcome failed:", e);
  }
}

export default function PainelPage() {
  useTicker(1000);
  const { sessions, loading, error, registerAndStart, pause, resume, end, endWithExtra } =
    useActiveSessions();
  const { value: pricing } = usePricing();

  // Wrap pra disparar o welcome+termo logo depois do registro, sem
  // bloquear o retorno do dialog.
  const handleRegister = async (input: Parameters<typeof registerAndStart>[0]) => {
    const created = await registerAndStart(input);
    if (created) void fireSessionWelcome(created);
    return created;
  };

  const handleEnd = async (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) {
      await end(id);
      return;
    }

    // Excedente proporcional ao valor pago. Considera o grace e a pausa.
    const overage = computeOverage(target, pricing.grace_minutes);

    // Sem excedente — encerra direto.
    if (overage.cents <= 0) {
      await end(id);
      void fireLoyaltyAccrual(target);
      void fireFeedbackFollowUp(target);
      return;
    }

    // Com excedente — operador decide.
    const ok = confirm(
      `${target.child.full_name} ficou ${overage.minutes} min alem do tempo contratado.\n\n` +
        `Cobrar adicional de ${formatBRL(overage.cents)}?\n\n` +
        `OK = encerra e cobra o extra\n` +
        `Cancelar = encerra sem cobrar`
    );

    if (ok) {
      await endWithExtra(id, overage.cents);
      // Reflita o novo valor na chamada de loyalty (com o overage somado).
      const updated: ActiveSession = {
        ...target,
        amount_paid_cents: (target.amount_paid_cents ?? 0) + overage.cents,
      };
      void fireLoyaltyAccrual(updated);
    } else {
      await end(id);
      void fireLoyaltyAccrual(target);
    }
    void fireFeedbackFollowUp(target);
  };

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
        actions={<QuickRegisterDialog onSubmit={handleRegister} />}
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
                graceMinutes={pricing.grace_minutes}
                onPause={(id) => void pause(id)}
                onResume={(id) => void resume(id)}
                onEnd={(id) => void handleEnd(id)}
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
