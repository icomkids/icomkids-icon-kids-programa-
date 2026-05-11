import { useState } from "react";
import { MessageSquare, Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutomationRules } from "../hooks/use-automation";
import { deleteRule, updateRule } from "../lib/automation-repo";
import { NewRuleButton, RuleDialog } from "./rule-dialog";
import type { AutomationRule } from "../types";

const TRIGGER_LABEL: Record<AutomationRule["trigger_type"], string> = {
  session_ended: "Fim de sessao",
  child_birthday: "Aniversario",
};

function describeConfig(rule: AutomationRule): string {
  const cfg = rule.trigger_config ?? {};
  if (rule.trigger_type === "session_ended") {
    const m = Number(cfg.delay_minutes ?? 0);
    if (m === 0) return "envia na hora";
    if (m < 60) return `${m} min depois`;
    if (m % 60 === 0) return `${m / 60}h depois`;
    return `${m} min depois`;
  }
  if (rule.trigger_type === "child_birthday") {
    const d = Number(cfg.days_before ?? 0);
    const h = Number(cfg.send_hour_local ?? 9);
    return d === 0
      ? `no dia, ${h.toString().padStart(2, "0")}h`
      : `${d} dias antes, ${h.toString().padStart(2, "0")}h`;
  }
  return "";
}

export function RulesList() {
  const { rules, loading } = useAutomationRules();
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const toggle = async (rule: AutomationRule) => {
    await updateRule(rule.id, { active: !rule.active });
  };

  const remove = async (rule: AutomationRule) => {
    if (!confirm(`Excluir a regra "${rule.name}"?`)) return;
    await deleteRule(rule.id);
  };

  const startEdit = (rule: AutomationRule) => {
    setEditing(rule);
    setEditOpen(true);
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-[#F4B73F]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Regras de automacao
          </h2>
        </div>
        <NewRuleButton />
      </header>
      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
          <MessageSquare className="size-6" />
          <p>Nenhuma regra configurada ainda.</p>
          <p className="text-xs">
            Crie uma regra para mandar agradecimento depois da visita ou
            mensagem no aniversario.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{rule.name}</p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      background:
                        rule.channel === "whatsapp" ? "#A6CD3F" : "#EA4D8E",
                      color: rule.channel === "whatsapp" ? "#0f172a" : "#fff",
                    }}
                  >
                    {rule.channel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_LABEL[rule.trigger_type]} · {describeConfig(rule)} ·
                  template <code>{rule.template_key}</code>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(rule)}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase transition ${
                    rule.active
                      ? "bg-[#A6CD3F] text-slate-900"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {rule.active ? "ativa" : "pausada"}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startEdit(rule)}
                  aria-label="Editar"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(rule)}
                  aria-label="Excluir"
                  className="text-[#EA4D8E]"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <RuleDialog
        rule={editing}
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditing(null);
        }}
      />
    </section>
  );
}
