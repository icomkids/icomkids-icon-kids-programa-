import { useState } from "react";
import { Calendar, Megaphone, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { RulesList } from "@/features/automation/components/rules-list";
import { ScheduledList } from "@/features/automation/components/scheduled-list";
import { CampaignDialog } from "@/features/marketing/components/campaign-dialog";

type Tab = "campaigns" | "rules" | "scheduled";

const TABS: { v: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { v: "campaigns", label: "Campanhas", icon: Megaphone },
  { v: "rules", label: "Automacoes", icon: Zap },
  { v: "scheduled", label: "Agendadas", icon: Calendar },
];

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("campaigns");

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Disparo em massa, automacoes recorrentes e fila de mensagens agendadas."
      />

      <div className="space-y-6 p-6">
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm font-semibold">
          {TABS.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 transition ${
                tab === t.v
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "campaigns" ? <CampaignsTab /> : null}
        {tab === "rules" ? <RulesList /> : null}
        {tab === "scheduled" ? <ScheduledList /> : null}
      </div>
    </div>
  );
}

function CampaignsTab() {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Campanha em massa</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Dispara o mesmo template pra varios contatos de uma vez. Util pra
            oferta da semana, divulgacao de evento, cupom de aniversario, etc.
            As mensagens sao enfileiradas em <strong>Agendadas</strong> e
            disparadas em background pelo cron.
          </p>
        </div>
        <CampaignDialog />
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Hint
          title="Quem recebe"
          body="Escolha a audiencia: todos com WhatsApp, todos com Email, leads quentes (quer trocar carro), opt-in WhatsApp ou opt-in Email."
        />
        <Hint
          title="Canal"
          body="WhatsApp ou Email. A sugestao do canal vem do tipo de audiencia mas voce pode mudar."
        />
        <Hint
          title="Template"
          body="Usa os mesmos templates do sistema. Variavel {{nome}} ja vem preenchida automaticamente."
        />
        <Hint
          title="Quando"
          body="Disparo imediato ou agendado pra data/hora especifica."
        />
      </div>

      <div className="mt-6 rounded-md border border-dashed border-[#F4B73F] bg-[#F4B73F]/10 px-4 py-3 text-xs">
        <p className="font-bold text-slate-800">⚠️ Boas praticas</p>
        <ul className="mt-1 space-y-1 text-slate-700">
          <li>
            • Mande so pra quem deu <strong>opt-in</strong> (audiencias "opt-in
            WhatsApp" e "opt-in Email"). Em compliance com LGPD.
          </li>
          <li>
            • Evite mandar mais de 1-2 disparos por mes — vira spam.
          </li>
          <li>
            • Teste antes em 1-2 contatos pelo "Agendar mensagem" individual
            (aba Agendadas).
          </li>
        </ul>
      </div>
    </section>
  );
}

function Hint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-700">{body}</p>
    </div>
  );
}
