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
  Eye,
  EyeOff,
  FileSignature,
  Gauge,
  GraduationCap,
  Hourglass,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  PartyPopper,
  Plus,
  QrCode,
  Save,
  Shield,
  Smile,
  Star,
  Tv2,
  Users,
  UserCog,
  Wrench,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERMISSION_CATALOG,
  PERMISSION_MODULES,
  defaultStaffPermissions,
  permissionsByModule,
  type PermissionKey,
} from "@/features/auth/permissions";
import {
  getUserPermissions,
  listTemplates,
  type PermissionTemplate,
} from "@/features/auth/permissions-repo";
import type { StaffMember } from "@/features/staff/types";

/**
 * Dialog unificado de funcionario:
 *  - Modo "novo": cria auth user + profile staff + staff_member + permissoes
 *  - Modo "editar": atualiza nome/cargo/comissao + permissoes + (opcional)
 *    troca senha
 *
 * Chama a edge function /functions/v1/create-employee?action=create|update
 * que valida que o caller eh owner.
 */

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Banknote, BookOpen, CalendarRange, ClipboardList, Coffee, Cog,
  FileSignature, Gauge, GraduationCap, Hourglass,
  Image: ImageIcon, LayoutDashboard, Megaphone, PartyPopper,
  QrCode, Smile, Star, Tv2, Users, Wrench,
};

interface Props {
  /** Quando passado, dialog vira modo "editar". Senao, "novo". */
  member?: StaffMember | null;
  /** Trigger custom (opcional). Senao usa botao default. */
  trigger?: React.ReactNode;
  /** Controle externo do open (opcional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
}

export function EmployeeDialog({
  member,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: Props) {
  const isEdit = !!member;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleLabel, setRoleLabel] = useState("Atendente");
  const [phone, setPhone] = useState("");
  const [commission, setCommission] = useState("0");
  const [perms, setPerms] = useState<Set<PermissionKey>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [showPermissions, setShowPermissions] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<null | { ok: boolean; msg: string }>(
    null
  );

  const byModule = useMemo(() => permissionsByModule(), []);

  // Resetar form quando abrir
  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    if (isEdit && member) {
      setFullName(member.full_name);
      setEmail(member.email ?? "");
      setRoleLabel(member.role_label ?? "");
      setPhone(member.phone ?? "");
      setCommission(String(member.commission_pct ?? 0));
      setNewPassword("");
      setPassword("");
      // Carrega permissoes atuais do profile
      if (member.profile_id) {
        void getUserPermissions(member.profile_id).then((keys) => {
          setPerms(new Set(keys));
        });
      } else {
        setPerms(new Set());
      }
    } else {
      // Modo novo
      setFullName("");
      setEmail("");
      setPassword("");
      setNewPassword("");
      setRoleLabel("Atendente");
      setPhone("");
      setCommission("0");
      // Default = permissoes default_for_staff=true
      setPerms(new Set(defaultStaffPermissions()));
    }
    // Carrega templates
    void listTemplates().then(setTemplates);
    // Primeiro modulo aberto
    setOpenModules(new Set([PERMISSION_MODULES[0]?.key].filter(Boolean) as string[]));
  }, [open, isEdit, member]);

  function togglePerm(key: PermissionKey) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModule(k: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function selectAllInModule(modKey: string) {
    const list = byModule[modKey] ?? [];
    setPerms((prev) => {
      const next = new Set(prev);
      for (const p of list) next.add(p.key);
      return next;
    });
  }

  function clearAllInModule(modKey: string) {
    const list = byModule[modKey] ?? [];
    setPerms((prev) => {
      const next = new Set(prev);
      for (const p of list) next.delete(p.key);
      return next;
    });
  }

  function applyTemplate(tpl: PermissionTemplate) {
    setPerms(new Set(tpl.permission_keys));
    setOpenModules(new Set(PERMISSION_MODULES.map((m) => m.key)));
    setFeedback({
      ok: true,
      msg: `Template "${tpl.name}" carregado (${tpl.permission_keys.length} permissoes).`,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setFeedback({ ok: false, msg: "Nome eh obrigatorio." });
      return;
    }
    if (!isEdit && (!email.trim() || !password.trim())) {
      setFeedback({ ok: false, msg: "Email e senha sao obrigatorios pra criar." });
      return;
    }
    if (!isEdit && password.length < 6) {
      setFeedback({ ok: false, msg: "Senha precisa ter pelo menos 6 caracteres." });
      return;
    }
    if (isEdit && newPassword && newPassword.length < 6) {
      setFeedback({ ok: false, msg: "Nova senha precisa ter 6+ caracteres." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const pct = parseFloat(commission.replace(",", ".")) || 0;
      const action = isEdit ? "update" : "create";
      const body: Record<string, unknown> = isEdit
        ? {
            member_id: member?.id,
            profile_id: member?.profile_id ?? undefined,
            full_name: fullName.trim(),
            role_label: roleLabel.trim() || null,
            phone: phone.trim() || null,
            commission_pct: pct,
            permission_keys: [...perms],
            ...(newPassword ? { new_password: newPassword } : {}),
          }
        : {
            email: email.trim().toLowerCase(),
            password,
            full_name: fullName.trim(),
            role_label: roleLabel.trim() || null,
            phone: phone.trim() || null,
            commission_pct: pct,
            permission_keys: [...perms],
          };

      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string;
      }>(`create-employee?action=${action}`, { body });

      if (error || data?.error) {
        const detail =
          data?.error ??
          (error as { message?: string })?.message ??
          "Erro desconhecido";
        setFeedback({ ok: false, msg: detail });
        return;
      }

      setFeedback({
        ok: true,
        msg: isEdit ? "Funcionario atualizado!" : "Funcionario cadastrado com sucesso!",
      });
      onSaved?.();
      setTimeout(() => setOpen(false), 1200);
    } catch (e) {
      setFeedback({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro inesperado.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isEdit ? (
        <DialogTrigger asChild>
          <Button className="bg-[#F39230] text-slate-900 hover:bg-[#F39230]/90">
            <Plus className="size-4" /> Novo funcionario
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>
                <UserCog className="size-5 text-[#1E78DC]" />
                Editar {fullName || "funcionario"}
              </>
            ) : (
              <>
                <Plus className="size-5 text-[#F39230]" />
                Novo funcionario
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize dados, comissao, permissoes e (se quiser) troque a senha."
              : "Cria o login + registro de equipe + permissoes em um so passo."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={submit}>
          {/* Dados basicos */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dados pessoais
            </legend>
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Nome completo *</Label>
              <Input
                id="emp-name"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emp-role">Cargo</Label>
                <Input
                  id="emp-role"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder="Atendente, Caixa, Gerente..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-comm">Comissao (%)</Label>
                <Input
                  id="emp-comm"
                  inputMode="decimal"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-phone">WhatsApp</Label>
              <Input
                id="emp-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 9..."
              />
            </div>
          </fieldset>

          {/* Login (novo) ou troca de senha (editar) */}
          <fieldset className="space-y-3 rounded-lg border border-dashed border-[#1E78DC]/40 bg-[#1E78DC]/5 p-3">
            <legend className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#1E78DC]">
              <KeyRound className="mr-1 inline size-3" /> Login no sistema
            </legend>
            {!isEdit ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-email">Email *</Label>
                  <Input
                    id="emp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="funcionario@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-pass">Senha inicial *</Label>
                  <div className="relative">
                    <Input
                      id="emp-pass"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Pelo menos 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    O funcionario pode trocar depois pelo proprio perfil.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Email atual:{" "}
                  <strong className="text-foreground">{email || "—"}</strong>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-newpass">Nova senha (opcional)</Label>
                  <div className="relative">
                    <Input
                      id="emp-newpass"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Deixe vazio pra manter a atual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </fieldset>

          {/* Permissoes */}
          <fieldset className="space-y-2 rounded-lg border border-dashed border-[#7B36BF]/40 bg-[#7B36BF]/5 p-3">
            <button
              type="button"
              onClick={() => setShowPermissions((s) => !s)}
              className="flex w-full items-center justify-between"
            >
              <legend className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#7B36BF]">
                <Shield className="size-3" /> Permissoes ({perms.size} de{" "}
                {PERMISSION_CATALOG.length})
              </legend>
              {showPermissions ? (
                <ChevronDown className="size-4 text-[#7B36BF]" />
              ) : (
                <ChevronRight className="size-4 text-[#7B36BF]" />
              )}
            </button>

            {showPermissions ? (
              <>
                {/* Toolbar de templates */}
                <div className="flex flex-wrap items-center gap-1 border-b border-[#7B36BF]/20 pb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Template:
                  </span>
                  {templates.length === 0 ? (
                    <span className="text-[10px] italic text-muted-foreground">
                      (nenhum)
                    </span>
                  ) : (
                    templates.map((tpl) => (
                      <Button
                        key={tpl.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => applyTemplate(tpl)}
                        className="h-6 px-2 text-[10px]"
                      >
                        {tpl.name} ({tpl.permission_keys.length})
                      </Button>
                    ))
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() =>
                        setPerms(new Set(PERMISSION_CATALOG.map((p) => p.key)))
                      }
                    >
                      Tudo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-[#EA4D8E]"
                      onClick={() => setPerms(new Set())}
                    >
                      Nada
                    </Button>
                  </div>
                </div>

                {/* Modulos */}
                <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                  {PERMISSION_MODULES.map((mod) => {
                    const list = byModule[mod.key] ?? [];
                    if (list.length === 0) return null;
                    const Icon = ICON_MAP[mod.icon] ?? Shield;
                    const isOpen = openModules.has(mod.key);
                    const selected = list.filter((p) => perms.has(p.key)).length;
                    return (
                      <div
                        key={mod.key}
                        className="overflow-hidden rounded-md border border-border bg-card"
                      >
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggleModule(mod.key)}
                            className="flex flex-1 items-center gap-2 text-left"
                          >
                            {isOpen ? (
                              <ChevronDown className="size-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3 text-muted-foreground" />
                            )}
                            <div
                              className="flex size-6 items-center justify-center rounded text-white"
                              style={{ background: mod.color }}
                            >
                              <Icon className="size-3" />
                            </div>
                            <span className="flex-1 text-xs font-semibold text-slate-900">
                              {mod.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {selected}/{list.length}
                            </span>
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => selectAllInModule(mod.key)}
                            className="h-5 px-1.5 text-[10px]"
                          >
                            Todas
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => clearAllInModule(mod.key)}
                            className="h-5 px-1.5 text-[10px] text-[#EA4D8E]"
                          >
                            Limpar
                          </Button>
                        </div>
                        {isOpen ? (
                          <div className="grid grid-cols-1 gap-0.5 border-t border-border bg-muted/20 p-1.5 sm:grid-cols-2">
                            {list.map((p) => (
                              <label
                                key={p.key}
                                className="flex cursor-pointer items-start gap-1.5 rounded px-1.5 py-1 transition hover:bg-card"
                              >
                                <input
                                  type="checkbox"
                                  checked={perms.has(p.key)}
                                  onChange={() => togglePerm(p.key)}
                                  className="mt-0.5 size-3.5 shrink-0 rounded border-border"
                                  style={{ accentColor: mod.color }}
                                />
                                <span className="text-[11px] leading-tight text-slate-900">
                                  {p.description}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {isEdit
                  ? "Clica acima pra revisar/editar permissoes."
                  : "Comeca com permissoes padrao de atendente. Clica acima pra customizar."}
              </p>
            )}
          </fieldset>

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
              disabled={submitting}
              className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
            >
              <Save className="size-4" />
              {submitting
                ? "Salvando..."
                : isEdit
                  ? "Atualizar"
                  : "Cadastrar funcionario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Helper pra carregar templates dentro do componente sem precisar Skeleton externo. */
export function EmployeeDialogSkeleton() {
  return <Skeleton className="h-44 w-full rounded-xl" />;
}
