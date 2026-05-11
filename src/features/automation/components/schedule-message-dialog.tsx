import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessageTemplates } from "../hooks/use-templates";
import { createScheduled } from "../lib/automation-repo";
import type { AutomationChannel } from "../types";

function localDatetimeToISO(local: string): string {
  // local is from <input type="datetime-local">: 'YYYY-MM-DDTHH:mm'
  const d = new Date(local);
  return d.toISOString();
}

function defaultIn(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60_000);
  // pad components for datetime-local format
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function ScheduleMessageDialog() {
  const { templates } = useMessageTemplates();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<AutomationChannel>("whatsapp");
  const [recipient, setRecipient] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [bodyOverride, setBodyOverride] = useState("");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(defaultIn(60));
  const [varNome, setVarNome] = useState("");
  const [varCrianca, setVarCrianca] = useState("");

  const reset = () => {
    setChannel("whatsapp");
    setRecipient("");
    setRecipientName("");
    setTemplateKey("");
    setBodyOverride("");
    setSubjectOverride("");
    setScheduledLocal(defaultIn(60));
    setVarNome("");
    setVarCrianca("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !scheduledLocal) return;
    if (!templateKey && !bodyOverride.trim()) {
      setError("Escolha um template ou escreva um corpo de mensagem.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const variables: Record<string, string> = {};
      if (varNome.trim()) variables.nome = varNome.trim();
      if (varCrianca.trim()) variables.crianca = varCrianca.trim();
      await createScheduled({
        channel,
        recipient: recipient.trim(),
        recipient_name: recipientName.trim() || undefined,
        template_key: templateKey || undefined,
        body_override: bodyOverride.trim() || undefined,
        subject_override:
          channel === "email" && subjectOverride.trim()
            ? subjectOverride.trim()
            : undefined,
        variables,
        scheduled_for: localDatetimeToISO(scheduledLocal),
      });
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao agendar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-[#1E78DC] text-[#1E78DC] hover:bg-[#1E78DC]/10"
        >
          <CalendarPlus className="size-4" /> Agendar mensagem
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar mensagem</DialogTitle>
          <DialogDescription>
            Disparo unico em data/hora especifica (WhatsApp ou Email).
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label>Canal</Label>
            <div className="grid grid-cols-2 gap-1">
              {(["whatsapp", "email"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase transition ${
                    channel === c
                      ? c === "whatsapp"
                        ? "border-[#A6CD3F] bg-[#A6CD3F] text-slate-900"
                        : "border-[#EA4D8E] bg-[#EA4D8E] text-white"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sm-recipient">
                {channel === "whatsapp" ? "Telefone (com DDD)" : "Email"}
              </Label>
              <Input
                id="sm-recipient"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={
                  channel === "whatsapp" ? "(11) 91234-5678" : "pai@exemplo.com"
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-rname">Nome (opcional)</Label>
              <Input
                id="sm-rname"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sm-when">Quando enviar</Label>
            <Input
              id="sm-when"
              type="datetime-local"
              required
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sm-template">Template (opcional)</Label>
            <select
              id="sm-template"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
            >
              <option value="">Sem template (escrever na mao)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {!templateKey ? (
            <>
              {channel === "email" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="sm-subject">Assunto</Label>
                  <Input
                    id="sm-subject"
                    value={subjectOverride}
                    onChange={(e) => setSubjectOverride(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="sm-body">
                  Mensagem {channel === "email" ? "(HTML ou texto)" : ""}
                </Label>
                <textarea
                  id="sm-body"
                  rows={3}
                  value={bodyOverride}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sm-vn">Variavel: nome</Label>
                <Input
                  id="sm-vn"
                  value={varNome}
                  onChange={(e) => setVarNome(e.target.value)}
                  placeholder="Maria"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sm-vc">Variavel: crianca</Label>
                <Input
                  id="sm-vc"
                  value={varCrianca}
                  onChange={(e) => setVarCrianca(e.target.value)}
                  placeholder="Helena"
                />
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-3 py-2 text-xs text-[#EA4D8E]">
              {error}
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
              disabled={submitting}
            >
              {submitting ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
