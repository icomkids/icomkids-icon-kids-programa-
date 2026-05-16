import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  RotateCcw,
  Save,
  Smile,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import type { MessageTemplate } from "@/features/messaging/types";

/**
 * Painel de edicao dos templates de mensagem (WhatsApp e Email). O
 * operador pode trocar emojis, formato, ou desativar templates sem
 * precisar mexer no banco. Cada linha mostra o nome amigavel, a chave
 * tecnica (so pra referencia), e um textarea grande pra editar o corpo.
 *
 * Variaveis suportadas usam o formato {{nome}}, {{crianca}}, {{link}},
 * etc. — sao substituidas no envio. Cada template tem variaveis
 * proprias documentadas no campo notes.
 *
 * O botao "Restaurar padrao" busca o body original da migration via
 * RPC `get_default_template_body(p_key)`. Caso a RPC nao exista, faz
 * fallback pra um aviso amigavel.
 */

const COMMON_EMOJIS = [
  "💙",
  "💜",
  "🧡",
  "💛",
  "💚",
  "🎉",
  "🎈",
  "🎂",
  "🎁",
  "✨",
  "🌟",
  "⭐",
  "👋",
  "👏",
  "🙌",
  "🤗",
  "😊",
  "😍",
  "🥳",
  "📱",
  "📧",
  "📅",
  "🕐",
  "👉",
  "✅",
  "❤️",
  "🔥",
];

/** Categorias pra agrupar templates por canal. */
function templateChannel(key: string): "whatsapp" | "email" | "outro" {
  if (key.startsWith("email_")) return "email";
  if (key.startsWith("wa_") || /^(nps_|term_|appointment_|waitlist_|session_|subscription_|birthday_)/.test(key)) {
    return "whatsapp";
  }
  return "outro";
}

export function MessageTemplatesCard() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeDrafts, setActiveDrafts] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("message_templates")
      .select("id, key, name, body, active, notes")
      .order("name");
    setTemplates((data ?? []) as MessageTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  function startEdit(t: MessageTemplate) {
    setOpenId(t.id);
    setDrafts((prev) => ({ ...prev, [t.id]: t.body }));
    setActiveDrafts((prev) => ({ ...prev, [t.id]: t.active }));
  }

  function cancel(id: string) {
    setOpenId(null);
    setDrafts((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setFeedback((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }

  function setDraft(id: string, body: string) {
    setDrafts((prev) => ({ ...prev, [id]: body }));
  }

  function insertEmoji(id: string, emoji: string) {
    const ta = document.getElementById(`tpl-body-${id}`) as HTMLTextAreaElement | null;
    const current = drafts[id] ?? "";
    if (ta) {
      const start = ta.selectionStart ?? current.length;
      const end = ta.selectionEnd ?? current.length;
      const next = current.slice(0, start) + emoji + current.slice(end);
      setDraft(id, next);
      // Move cursor after the inserted emoji on next tick.
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + emoji.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setDraft(id, current + emoji);
    }
  }

  async function save(t: MessageTemplate) {
    const body = drafts[t.id] ?? t.body;
    const active = activeDrafts[t.id] ?? t.active;
    if (!body.trim()) {
      setFeedback((prev) => ({
        ...prev,
        [t.id]: { ok: false, msg: "O texto nao pode ficar vazio." },
      }));
      return;
    }
    setSaving(t.id);
    setFeedback((prev) => ({ ...prev, [t.id]: { ok: false, msg: "" } }));
    const { error } = await supabase
      .from("message_templates")
      .update({ body, active })
      .eq("id", t.id);
    setSaving(null);
    if (error) {
      setFeedback((prev) => ({
        ...prev,
        [t.id]: { ok: false, msg: error.message ?? "Falha ao salvar." },
      }));
      return;
    }
    setFeedback((prev) => ({
      ...prev,
      [t.id]: { ok: true, msg: "Salvo com sucesso!" },
    }));
    // Atualiza lista em memoria.
    setTemplates((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, body, active } : x))
    );
    // Some o feedback verde depois de 3s.
    setTimeout(() => {
      setFeedback((prev) => {
        const { [t.id]: _, ...rest } = prev;
        return rest;
      });
    }, 3000);
  }

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  // Agrupa por canal pra exibir.
  const grouped = {
    whatsapp: templates.filter((t) => templateChannel(t.key) === "whatsapp"),
    email: templates.filter((t) => templateChannel(t.key) === "email"),
    outro: templates.filter((t) => templateChannel(t.key) === "outro"),
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-[#7B36BF]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Templates de mensagem
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {templates.length} templates · clique pra editar
        </p>
      </header>

      <div className="space-y-1 p-3">
        {grouped.whatsapp.length ? (
          <Group title="WhatsApp" color="#A6CD3F" templates={grouped.whatsapp} {...{ openId, drafts, activeDrafts, saving, feedback, setActiveDrafts, startEdit, cancel, setDraft, insertEmoji, save }} />
        ) : null}
        {grouped.email.length ? (
          <Group title="Email" color="#EA4D8E" templates={grouped.email} {...{ openId, drafts, activeDrafts, saving, feedback, setActiveDrafts, startEdit, cancel, setDraft, insertEmoji, save }} />
        ) : null}
        {grouped.outro.length ? (
          <Group title="Outros" color="#94a3b8" templates={grouped.outro} {...{ openId, drafts, activeDrafts, saving, feedback, setActiveDrafts, startEdit, cancel, setDraft, insertEmoji, save }} />
        ) : null}
      </div>
    </section>
  );
}

interface GroupProps {
  title: string;
  color: string;
  templates: MessageTemplate[];
  openId: string | null;
  drafts: Record<string, string>;
  activeDrafts: Record<string, boolean>;
  saving: string | null;
  feedback: Record<string, { ok: boolean; msg: string }>;
  setActiveDrafts: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  startEdit: (t: MessageTemplate) => void;
  cancel: (id: string) => void;
  setDraft: (id: string, body: string) => void;
  insertEmoji: (id: string, emoji: string) => void;
  save: (t: MessageTemplate) => Promise<void>;
}

function Group({
  title,
  color,
  templates,
  openId,
  drafts,
  activeDrafts,
  saving,
  feedback,
  setActiveDrafts,
  startEdit,
  cancel,
  setDraft,
  insertEmoji,
  save,
}: GroupProps) {
  return (
    <div className="mb-1">
      <div
        className="mb-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
        style={{ background: color }}
      >
        {title}
      </div>
      <div className="space-y-1.5">
        {templates.map((t) => {
          const isOpen = openId === t.id;
          const draftBody = drafts[t.id] ?? t.body;
          const draftActive = activeDrafts[t.id] ?? t.active;
          const fb = feedback[t.id];
          return (
            <div
              key={t.id}
              className="overflow-hidden rounded-lg border border-border bg-background"
            >
              <button
                onClick={() => (isOpen ? cancel(t.id) : startEdit(t))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-muted/50"
              >
                {isOpen ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {t.name}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {t.key}
                  </p>
                </div>
                {!t.active ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Desativado
                  </span>
                ) : null}
              </button>

              {isOpen ? (
                <div className="space-y-3 border-t border-border bg-card p-3">
                  {/* Picker de emojis */}
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Smile className="size-3" /> Clique pra inserir emoji
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {COMMON_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => insertEmoji(t.id, e)}
                          className="rounded border border-border bg-background px-1.5 py-0.5 text-base transition hover:bg-muted"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Textarea */}
                  <div>
                    <label
                      htmlFor={`tpl-body-${t.id}`}
                      className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Texto da mensagem
                    </label>
                    <textarea
                      id={`tpl-body-${t.id}`}
                      value={draftBody}
                      onChange={(e) => setDraft(t.id, e.target.value)}
                      rows={8}
                      className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Use <code className="rounded bg-muted px-1">{"{{nome}}"}</code>,{" "}
                      <code className="rounded bg-muted px-1">{"{{crianca}}"}</code>,{" "}
                      <code className="rounded bg-muted px-1">{"{{link}}"}</code> etc — sao
                      substituidos no envio.
                    </p>
                  </div>

                  {/* Notes do template, se houver */}
                  {t.notes ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                      <strong>Nota:</strong> {t.notes}
                    </div>
                  ) : null}

                  {/* Toggle ativo */}
                  <div className="flex items-center gap-2">
                    <input
                      id={`tpl-active-${t.id}`}
                      type="checkbox"
                      checked={draftActive}
                      onChange={(e) =>
                        setActiveDrafts((prev) => ({
                          ...prev,
                          [t.id]: e.target.checked,
                        }))
                      }
                      className="size-4 rounded border-border"
                    />
                    <label
                      htmlFor={`tpl-active-${t.id}`}
                      className="text-xs text-slate-700"
                    >
                      Template ativo (se desligado, nao sera enviado)
                    </label>
                  </div>

                  {/* Acoes */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 text-xs">
                      {fb ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
                            fb.ok
                              ? "bg-[#A6CD3F]/15 text-[#5a8e10]"
                              : "bg-[#EA4D8E]/15 text-[#EA4D8E]"
                          }`}
                        >
                          {fb.ok ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <XCircle className="size-3.5" />
                          )}
                          {fb.msg}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        // Restaurar = recarregar do banco (descarta edicao)
                        setDraft(t.id, t.body);
                        setActiveDrafts((prev) => ({
                          ...prev,
                          [t.id]: t.active,
                        }));
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Descartar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving === t.id}
                      onClick={() => void save(t)}
                      style={{ background: color, color: "#fff" }}
                      className="hover:opacity-90"
                    >
                      <Save className="size-3.5" />
                      {saving === t.id ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>

                  {/* Preview simples */}
                  <div className="rounded-lg border border-border bg-[#f8fafc] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Preview (com exemplos)
                    </p>
                    <p className="whitespace-pre-wrap text-xs text-slate-800">
                      {previewWithExamples(draftBody)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Substitui variaveis pelas amostras pra ficar mais facil de visualizar. */
function previewWithExamples(body: string) {
  const examples: Record<string, string> = {
    nome: "Ana",
    crianca: "Lucas",
    crianca_sufix: " (Lucas)",
    tipo: "agendamento",
    plano: "Plano Mensal",
    dias: "3",
    link: "https://sistema.icomkids.com.br/...",
    data: "20/05",
    hora: "15:00",
    tempo: "30",
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    examples[k] != null ? examples[k] : `{{${k}}}`
  );
}
