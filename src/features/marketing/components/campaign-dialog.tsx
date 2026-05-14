import { useEffect, useState } from "react";
import { Megaphone, Users } from "lucide-react";
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
import { useMessageTemplates } from "@/features/automation/hooks/use-templates";
import {
  AUDIENCE_LABELS,
  type AudienceContact,
  type AudienceKey,
  bulkSchedule,
  fetchAudience,
} from "../lib/audience";

function isoNowPlus(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toISOString();
}

function defaultDatetimeLocal(): string {
  // 5 minutos no futuro arredondado pro proximo minuto
  const d = new Date(Date.now() + 5 * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function CampaignDialog() {
  const { templates } = useMessageTemplates();
  const [open, setOpen] = useState(false);

  // ============== Form state ==============
  const [audience, setAudience] = useState<AudienceKey>("all_with_phone");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [templateKey, setTemplateKey] = useState("");
  const [subject, setSubject] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [scheduledLocal, setScheduledLocal] = useState(defaultDatetimeLocal());

  // ============== Audience load ==============
  const [contacts, setContacts] = useState<AudienceContact[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  // ============== Submit ==============
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ inserted: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Recarrega audiencia quando muda
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingAudience(true);
    setAudienceError(null);
    fetchAudience(audience)
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setAudienceError(e instanceof Error ? e.message : "Erro");
      })
      .finally(() => {
        if (!cancelled) setLoadingAudience(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, open]);

  // Sugere canal coerente com audiencia
  useEffect(() => {
    if (audience === "all_with_phone" || audience === "wa_optin") {
      setChannel("whatsapp");
    } else if (audience === "all_with_email" || audience === "email_optin") {
      setChannel("email");
    }
  }, [audience]);

  const reachable = contacts.filter((c) =>
    channel === "whatsapp" ? !!c.phone : !!c.email
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateKey || reachable.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const scheduled_for = sendNow
        ? isoNowPlus(0)
        : new Date(scheduledLocal).toISOString();
      const r = await bulkSchedule({
        contacts: reachable,
        channel,
        template_key: templateKey,
        subject: channel === "email" ? subject || undefined : undefined,
        scheduled_for,
      });
      setResult({ inserted: r.inserted });
      // Fecha apos 2s
      window.setTimeout(() => {
        setOpen(false);
        setResult(null);
      }, 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao agendar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#EA4D8E] text-white hover:bg-[#EA4D8E]/90">
          <Megaphone className="size-4" /> Nova campanha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha em massa</DialogTitle>
          <DialogDescription>
            Dispara o mesmo template pra varios contatos de uma vez.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          {/* 1. Audience */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-aud">1. Quem recebe?</Label>
            <select
              id="cp-aud"
              value={audience}
              onChange={(e) => setAudience(e.target.value as AudienceKey)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
            >
              {(Object.keys(AUDIENCE_LABELS) as AudienceKey[]).map((k) => (
                <option key={k} value={k}>
                  {AUDIENCE_LABELS[k]}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Users className="size-3" />
              {loadingAudience ? (
                <span>Contando...</span>
              ) : audienceError ? (
                <span className="text-[#EA4D8E]">{audienceError}</span>
              ) : (
                <span>
                  <strong className="text-foreground">{reachable.length}</strong>{" "}
                  contato(s) alcancavel(eis) por {channel}
                  {contacts.length !== reachable.length
                    ? ` (${contacts.length - reachable.length} sem ${
                        channel === "whatsapp" ? "telefone" : "email"
                      })`
                    : ""}
                </span>
              )}
            </div>
          </div>

          {/* 2. Channel */}
          <div className="space-y-1.5">
            <Label>2. Canal</Label>
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
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Template */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-tpl">3. Template</Label>
            <select
              id="cp-tpl"
              required
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
            >
              <option value="">Selecionar...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Variavel disponivel: <code>{"{{"}nome{"}}"}</code> (preenchida
              automaticamente).
            </p>
          </div>

          {channel === "email" ? (
            <div className="space-y-1.5">
              <Label htmlFor="cp-subj">Assunto do email (opcional)</Label>
              <Input
                id="cp-subj"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Se vazio, usa nome do template"
              />
            </div>
          ) : null}

          {/* 4. When */}
          <div className="space-y-1.5">
            <Label>4. Quando enviar</Label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setSendNow(true)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  sendNow
                    ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                Agora
              </button>
              <button
                type="button"
                onClick={() => setSendNow(false)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  !sendNow
                    ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                Agendado
              </button>
            </div>
            {!sendNow ? (
              <Input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
            ) : null}
          </div>

          {submitError ? (
            <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-3 py-2 text-xs text-[#EA4D8E]">
              {submitError}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-md border border-[#A6CD3F] bg-[#A6CD3F]/15 px-3 py-2 text-sm font-semibold">
              ✓ {result.inserted} mensagem(ns) enfileirada(s).
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
              className="bg-[#EA4D8E] text-white hover:bg-[#EA4D8E]/90"
              disabled={
                submitting ||
                !templateKey ||
                reachable.length === 0 ||
                loadingAudience
              }
            >
              {submitting
                ? "Enfileirando..."
                : `Enviar pra ${reachable.length}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
