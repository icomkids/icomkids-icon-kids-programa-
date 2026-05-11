import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
import { createRule, updateRule } from "../lib/automation-repo";
import type {
  AutomationChannel,
  AutomationRule,
  AutomationTrigger,
} from "../types";

interface Props {
  /** When provided, dialog opens in edit mode for this rule. */
  rule?: AutomationRule | null;
  /** Customize the trigger label/look. */
  trigger?: React.ReactNode;
  /** Programmatic open (used by parent to trigger via button click). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RuleDialog({ rule, trigger, open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? (open as boolean) : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const { templates } = useMessageTemplates();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] =
    useState<AutomationTrigger>("session_ended");
  const [channel, setChannel] = useState<AutomationChannel>("whatsapp");
  const [templateKey, setTemplateKey] = useState("");
  const [delayMinutes, setDelayMinutes] = useState<number>(60);
  const [daysBefore, setDaysBefore] = useState<number>(0);
  const [sendHour, setSendHour] = useState<number>(9);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  // Hydrate when editing
  useEffect(() => {
    if (!isOpen) return;
    if (rule) {
      setName(rule.name);
      setTriggerType(rule.trigger_type);
      setChannel(rule.channel);
      setTemplateKey(rule.template_key);
      setActive(rule.active);
      setNotes(rule.notes ?? "");
      const cfg = rule.trigger_config ?? {};
      setDelayMinutes(Number(cfg.delay_minutes ?? 60));
      setDaysBefore(Number(cfg.days_before ?? 0));
      setSendHour(Number(cfg.send_hour_local ?? 9));
    } else {
      setName("");
      setTriggerType("session_ended");
      setChannel("whatsapp");
      setTemplateKey("");
      setDelayMinutes(60);
      setDaysBefore(0);
      setSendHour(9);
      setActive(true);
      setNotes("");
    }
    setError(null);
  }, [isOpen, rule]);

  const triggerConfig =
    triggerType === "session_ended"
      ? { delay_minutes: delayMinutes }
      : { days_before: daysBefore, send_hour_local: sendHour };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !templateKey) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        channel,
        template_key: templateKey,
        active,
        notes: notes.trim() || null,
      };
      if (rule) {
        await updateRule(rule.id, payload);
      } else {
        await createRule(payload);
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar regra.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {rule ? "Editar regra" : "Nova regra de automacao"}
          </DialogTitle>
          <DialogDescription>
            Dispara mensagem automatica quando o gatilho acontece.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="rl-name">Nome interno</Label>
            <Input
              id="rl-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Agradecimento pos visita"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Gatilho</Label>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  { v: "session_ended" as const, label: "Fim de sessao" },
                  { v: "child_birthday" as const, label: "Aniversario" },
                ]
              ).map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTriggerType(t.v)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                    triggerType === t.v
                      ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {triggerType === "session_ended" ? (
            <div className="space-y-1.5">
              <Label htmlFor="rl-delay">Atraso apos a sessao (minutos)</Label>
              <Input
                id="rl-delay"
                type="number"
                min={0}
                value={delayMinutes}
                onChange={(e) =>
                  setDelayMinutes(parseInt(e.target.value || "0", 10))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                0 = manda na hora. 60 = uma hora depois. 1440 = 24h depois.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rl-days">Dias antes do aniversario</Label>
                <Input
                  id="rl-days"
                  type="number"
                  min={0}
                  value={daysBefore}
                  onChange={(e) =>
                    setDaysBefore(parseInt(e.target.value || "0", 10))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  0 = no proprio dia.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rl-hour">Hora de envio</Label>
                <Input
                  id="rl-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={sendHour}
                  onChange={(e) =>
                    setSendHour(parseInt(e.target.value || "9", 10))
                  }
                />
              </div>
            </div>
          )}

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

          <div className="space-y-1.5">
            <Label htmlFor="rl-template">Template</Label>
            <select
              id="rl-template"
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
              Variaveis disponiveis nos templates: {"{{"}nome{"}}"}, {"{{"}
              crianca{"}}"} (e {"{{"}idade{"}}"} no aniversario).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="rl-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4"
            />
            <Label htmlFor="rl-active" className="cursor-pointer">
              Ativa
            </Label>
          </div>

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
              {submitting ? "Salvando..." : rule ? "Salvar" : "Criar regra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewRuleButton() {
  return (
    <RuleDialog
      trigger={
        <Button className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90">
          <Plus className="size-4" /> Nova regra
        </Button>
      }
    />
  );
}
