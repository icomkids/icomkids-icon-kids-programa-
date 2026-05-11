import { Calendar, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScheduledMessages } from "../hooks/use-automation";
import { cancelScheduled } from "../lib/automation-repo";
import { ScheduleMessageDialog } from "./schedule-message-dialog";
import type { ScheduledStatus } from "../types";

const STATUS_PILL: Record<
  ScheduledStatus,
  { label: string; bg: string; fg: string }
> = {
  pending: { label: "Agendada", bg: "#F4B73F", fg: "#0f172a" },
  sent: { label: "Enviada", bg: "#A6CD3F", fg: "#0f172a" },
  failed: { label: "Falhou", bg: "#EA4D8E", fg: "#fff" },
  canceled: { label: "Cancelada", bg: "#94a3b8", fg: "#fff" },
};

function fmt(date: string): string {
  const d = new Date(date);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScheduledList() {
  const { messages, loading } = useScheduledMessages(50);

  const cancel = async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    await cancelScheduled(id);
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-[#1E78DC]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Mensagens agendadas
          </h2>
        </div>
        <ScheduleMessageDialog />
      </header>
      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
          <Clock3 className="size-6" />
          <p>Nenhuma mensagem na fila.</p>
          <p className="text-xs">
            Mensagens criadas pelas regras ou agendadas manualmente aparecem
            aqui.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {messages.map((m) => {
            const s = STATUS_PILL[m.status];
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: s.bg, color: s.fg }}
                    >
                      {s.label}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        background:
                          m.channel === "whatsapp" ? "#A6CD3F" : "#EA4D8E",
                        color: m.channel === "whatsapp" ? "#0f172a" : "#fff",
                      }}
                    >
                      {m.channel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmt(m.scheduled_for)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm">
                    <span className="font-mono text-xs">{m.recipient}</span>
                    {m.template_key ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · template <code>{m.template_key}</code>
                      </span>
                    ) : null}
                  </p>
                  {m.last_error ? (
                    <p className="mt-0.5 truncate text-xs text-[#EA4D8E]">
                      Erro: {m.last_error}
                    </p>
                  ) : null}
                </div>
                {m.status === "pending" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => cancel(m.id)}
                    aria-label="Cancelar"
                    className="text-[#EA4D8E]"
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
