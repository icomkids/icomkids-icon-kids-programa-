import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Coffee,
  Cog,
  FileSignature,
  Gauge,
  GraduationCap,
  Hourglass,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  PartyPopper,
  QrCode,
  Save,
  Shield,
  Smile,
  Star,
  Tv2,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERMISSION_CATALOG,
  PERMISSION_MODULES,
  permissionsByModule,
  type PermissionKey,
} from "@/features/auth/permissions";
import {
  createTemplate,
  getUserPermissions,
  listTemplates,
  setUserPermissions,
  type PermissionTemplate,
  type StaffProfile,
} from "@/features/auth/permissions-repo";

/**
 * Dialog de edicao de permissoes de um staff.
 * Owner abre, marca/desmarca checkboxes agrupados por modulo,
 * aplica templates pre-definidos, e salva.
 */

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Banknote, BookOpen, CalendarRange, ClipboardList, Coffee, Cog,
  FileSignature, Gauge, GraduationCap, Hourglass,
  Image: ImageIcon, LayoutDashboard, Megaphone, PartyPopper,
  QrCode, Smile, Star, Tv2, Users, Wrench,
};

interface Props {
  open: boolean;
  onClose: () => void;
  profile: StaffProfile;
  onSaved?: () => void;
}

export function PermissionsDialog({ open, onClose, profile, onSaved }: Props) {
  const [keys, setKeys] = useState<Set<PermissionKey>>(new Set());
  const [originalKeys, setOriginalKeys] = useState<Set<PermissionKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<
    null | { ok: boolean; msg: string }
  >(null);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Carrega quando o dialog abre.
  useEffect(() => {
    if (!open || !profile) return;
    let cancelled = false;
    setLoading(true);
    setFeedback(null);
    setShowSaveTemplate(false);
    setSaveTemplateName("");
    (async () => {
      try {
        const [perms, tpls] = await Promise.all([
          getUserPermissions(profile.id),
          listTemplates(),
        ]);
        if (cancelled) return;
        setKeys(new Set(perms));
        setOriginalKeys(new Set(perms));
        setTemplates(tpls);
        // Abre primeiro modulo por padrao
        setOpenModules(new Set([PERMISSION_MODULES[0]?.key].filter(Boolean) as string[]));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, profile]);

  const byModule = useMemo(() => permissionsByModule(), []);
  const isOwnerTarget = profile.role === "owner";

  function toggle(key: PermissionKey) {
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModule(moduleKey: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });
  }

  function selectAll(moduleKey: string) {
    const moduleKeys = byModule[moduleKey] ?? [];
    setKeys((prev) => {
      const next = new Set(prev);
      for (const p of moduleKeys) next.add(p.key);
      return next;
    });
  }

  function clearAll(moduleKey: string) {
    const moduleKeys = byModule[moduleKey] ?? [];
    setKeys((prev) => {
      const next = new Set(prev);
      for (const p of moduleKeys) next.delete(p.key);
      return next;
    });
  }

  function applyTemplate(tpl: PermissionTemplate) {
    setKeys(new Set(tpl.permission_keys));
    setOpenModules(new Set(PERMISSION_MODULES.map((m) => m.key)));
    setFeedback({
      ok: true,
      msg: `Template "${tpl.name}" carregado (${tpl.permission_keys.length} permissoes). Revise e salve.`,
    });
  }

  function selectAllEverything() {
    setKeys(new Set(PERMISSION_CATALOG.map((p) => p.key)));
  }

  function clearEverything() {
    setKeys(new Set());
  }

  async function save() {
    if (isOwnerTarget) {
      setFeedback({ ok: false, msg: "Nao da pra editar o owner." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await setUserPermissions(profile.id, [...keys]);
      setOriginalKeys(new Set(keys));
      setFeedback({ ok: true, msg: "Permissoes salvas com sucesso!" });
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      setFeedback({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro ao salvar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveAsTemplate() {
    if (!saveTemplateName.trim()) {
      setFeedback({ ok: false, msg: "Da um nome pro template." });
      return;
    }
    try {
      await createTemplate(saveTemplateName.trim(), null, [...keys]);
      const tpls = await listTemplates();
      setTemplates(tpls);
      setSaveTemplateName("");
      setShowSaveTemplate(false);
      setFeedback({ ok: true, msg: `Template "${saveTemplateName}" criado.` });
    } catch (e) {
      setFeedback({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro ao criar template.",
      });
    }
  }

  // Tem mudanca pendente?
  const dirty =
    keys.size !== originalKeys.size ||
    [...keys].some((k) => !originalKeys.has(k));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-[#7B36BF]" />
            Permissoes de {profile.full_name || profile.email}
          </DialogTitle>
          <DialogDescription>
            {isOwnerTarget ? (
              <span className="font-semibold text-[#F39230]">
                Este usuario eh OWNER — tem acesso total automaticamente. Nao
                ha como restringir.
              </span>
            ) : (
              <>
                Marque as permissoes que este funcionario tera. Owner pode mudar
                a qualquer momento. Total selecionado:{" "}
                <strong>{keys.size}</strong> de {PERMISSION_CATALOG.length}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar com templates e atalhos */}
        {!isOwnerTarget ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Aplicar template:
              </Label>
              {templates.length === 0 ? (
                <span className="text-xs italic text-muted-foreground">nenhum</span>
              ) : (
                templates.map((tpl) => (
                  <Button
                    key={tpl.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyTemplate(tpl)}
                    className="h-7 text-xs"
                  >
                    {tpl.name}{" "}
                    <span className="ml-1 text-muted-foreground">
                      ({tpl.permission_keys.length})
                    </span>
                  </Button>
                ))
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={selectAllEverything}
                className="h-7 text-xs"
              >
                Tudo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearEverything}
                className="h-7 text-xs text-[#EA4D8E]"
              >
                Nada
              </Button>
            </div>
          </div>
        ) : null}

        {/* Lista de modulos (accordion) */}
        <div className="-mx-6 max-h-[55vh] overflow-y-auto px-6 py-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isOwnerTarget ? (
            <div className="rounded-lg border-2 border-dashed border-[#F39230]/40 bg-[#F39230]/5 p-6 text-center">
              <Shield className="mx-auto mb-2 size-8 text-[#F39230]" />
              <p className="text-sm font-semibold">
                Owner sempre tem acesso a tudo
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pra restringir, mude o role do usuario pra "staff" antes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {PERMISSION_MODULES.map((mod) => {
                const moduleKeys = byModule[mod.key] ?? [];
                if (moduleKeys.length === 0) return null;
                const Icon = ICON_MAP[mod.icon] ?? Shield;
                const isOpen = openModules.has(mod.key);
                const selectedInModule = moduleKeys.filter((p) =>
                  keys.has(p.key)
                ).length;
                const allSelected = selectedInModule === moduleKeys.length;
                const partial =
                  selectedInModule > 0 && selectedInModule < moduleKeys.length;

                return (
                  <div
                    key={mod.key}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleModule(mod.key)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <div
                          className="flex size-8 shrink-0 items-center justify-center rounded-md text-white"
                          style={{ background: mod.color }}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {mod.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {selectedInModule}/{moduleKeys.length}{" "}
                            {selectedInModule === 1 ? "permissao" : "permissoes"}
                            {partial ? " · parcial" : allSelected ? " · todas" : " · nenhuma"}
                          </p>
                        </div>
                      </button>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => selectAll(mod.key)}
                          className="h-7 px-2 text-[10px]"
                        >
                          Todas
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => clearAll(mod.key)}
                          className="h-7 px-2 text-[10px] text-[#EA4D8E]"
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="grid grid-cols-1 gap-1 border-t border-border bg-muted/20 p-2 sm:grid-cols-2">
                        {moduleKeys.map((p) => (
                          <label
                            key={p.key}
                            className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition hover:bg-card"
                          >
                            <input
                              type="checkbox"
                              checked={keys.has(p.key)}
                              onChange={() => toggle(p.key)}
                              className="mt-0.5 size-4 shrink-0 rounded border-border"
                              style={{ accentColor: mod.color }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-900">
                                {p.description}
                              </p>
                              <p className="font-mono text-[9px] text-muted-foreground">
                                {p.key}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save as template */}
        {!isOwnerTarget ? (
          <div className="border-t border-border pt-2">
            {showSaveTemplate ? (
              <div className="flex items-end gap-2 rounded-lg border border-dashed border-[#7B36BF]/40 bg-[#7B36BF]/5 p-2">
                <div className="flex-1">
                  <Label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Nome do template
                  </Label>
                  <Input
                    value={saveTemplateName}
                    onChange={(e) => setSaveTemplateName(e.target.value)}
                    placeholder="Ex: Caixa avancado"
                    autoFocus
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowSaveTemplate(false);
                    setSaveTemplateName("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveAsTemplate()}
                  className="bg-[#7B36BF] text-white hover:bg-[#7B36BF]/90"
                >
                  Criar template
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowSaveTemplate(true)}
                className="text-xs text-[#7B36BF]"
                disabled={keys.size === 0}
              >
                <Save className="size-3.5" /> Salvar selecao atual como template
              </Button>
            )}
          </div>
        ) : null}

        {/* Feedback */}
        {feedback ? (
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
              feedback.ok
                ? "border-[#A6CD3F] bg-[#A6CD3F]/10 text-[#5a8e10]"
                : "border-[#EA4D8E] bg-[#EA4D8E]/10 text-[#EA4D8E]"
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <XCircle className="size-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          {!isOwnerTarget ? (
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
            >
              <Save className="size-4" />
              {saving ? "Salvando..." : `Salvar ${keys.size} permissoes`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
