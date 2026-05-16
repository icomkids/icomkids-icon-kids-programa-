import { useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfilesPermissionsSection } from "@/features/auth/components/profiles-permissions-section";
import { useStaff, useShifts } from "@/features/staff/hooks/use-staff";
import { formatBRL } from "@/lib/format";
import type {
  StaffMember,
  StaffMemberInput,
  StaffShiftInput,
} from "@/features/staff/types";

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(reference: Date = new Date()): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

export default function TeamPage() {
  const { members, commissions, loading, create, setActive } = useStaff();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const {
    shifts,
    createShift,
    deleteShift,
  } = useShifts(isoDate(weekStart), isoDate(weekEnd));

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const totals = useMemo(() => {
    const activeMembers = members.filter((m) => m.active).length;
    const totalCommission = commissions.reduce(
      (acc, c) => acc + c.commission_cents,
      0
    );
    const totalAttributed = commissions.reduce(
      (acc, c) => acc + c.attributed_cents,
      0
    );
    return { activeMembers, totalCommission, totalAttributed };
  }, [members, commissions]);

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Funcionarios, escalas e comissoes do mes corrente."
        actions={<NewStaffDialog onSubmit={create} />}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Funcionarios ativos"
            value={totals.activeMembers.toString()}
            color="#1E78DC"
          />
          <Kpi
            label="Comissao do mes"
            value={formatBRL(totals.totalCommission)}
            color="#A6CD3F"
            sub="a pagar"
          />
          <Kpi
            label="Receita atribuida"
            value={formatBRL(totals.totalAttributed)}
            color="#3CB4E0"
            sub="ao time este mes"
          />
          <Kpi
            label="Turnos esta semana"
            value={shifts.length.toString()}
            color="#7B36BF"
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Time
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">{members.length}</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Users className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">
                Nenhum funcionario cadastrado
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use <strong>Novo funcionario</strong> no topo para registrar
                o primeiro membro do time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Funcao</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Comissao</TableHead>
                    <TableHead className="text-right">Receita do mes</TableHead>
                    <TableHead className="text-right">A pagar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const c = commissions.find((x) => x.member_id === m.id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.role_label ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.phone ?? m.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.commission_pct}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(c?.attributed_cents ?? 0)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-[#A6CD3F]">
                          {formatBRL(c?.commission_cents ?? 0)}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: m.active ? "#A6CD3F" : "#94a3b8",
                              color: m.active ? "#0f172a" : "#ffffff",
                            }}
                          >
                            {m.active ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => void setActive(m.id, !m.active)}
                          >
                            {m.active ? "Desativar" : "Reativar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <ProfilesPermissionsSection />

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Escala da semana
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() - 7);
                  setWeekStart(d);
                }}
              >
                ←
              </Button>
              <p className="text-xs tabular-nums text-muted-foreground">
                {weekStart.toLocaleDateString("pt-BR")} —{" "}
                {weekEnd.toLocaleDateString("pt-BR")}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + 7);
                  setWeekStart(d);
                }}
              >
                →
              </Button>
              <NewShiftDialog members={members} onSubmit={createShift} />
            </div>
          </header>
          {members.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Cadastre funcionarios primeiro pra montar a escala.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Funcionario
                    </th>
                    {days.map((d, i) => (
                      <th
                        key={i}
                        className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        {weekdayLabels[d.getDay()]}{" "}
                        {String(d.getDate()).padStart(2, "0")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.filter((m) => m.active).map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 align-top">
                        <p className="text-sm font-bold">{m.full_name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {m.role_label ?? "—"}
                        </p>
                      </td>
                      {days.map((d, i) => {
                        const dayShifts = shifts.filter(
                          (s) =>
                            s.member_id === m.id &&
                            s.scheduled_date === isoDate(d)
                        );
                        return (
                          <td key={i} className="px-1 py-1 align-top">
                            <ul className="space-y-1">
                              {dayShifts.map((s) => (
                                <li
                                  key={s.id}
                                  className="group flex items-center justify-between gap-1 rounded-md bg-[#1E78DC]/10 px-1.5 py-0.5 text-[11px] tabular-nums text-[#1E78DC]"
                                >
                                  <span>
                                    {formatTime(s.start_time)}–
                                    {formatTime(s.end_time)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void deleteShift(s.id)}
                                    className="opacity-0 transition group-hover:opacity-100"
                                    aria-label="Remover turno"
                                  >
                                    <Trash2 className="size-3 text-[#EA4D8E]" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {sub ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

function NewStaffDialog({
  onSubmit,
}: {
  onSubmit: (input: StaffMemberInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Atendente");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [commission, setCommission] = useState("0");

  const reset = () => {
    setName("");
    setRole("Atendente");
    setPhone("");
    setEmail("");
    setCommission("0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const pct = parseFloat(commission.replace(",", ".")) || 0;
      await onSubmit({
        full_name: name.trim(),
        role_label: role.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        commission_pct: pct,
        active: true,
      });
      reset();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#F39230] text-slate-900 hover:bg-[#F39230]/90">
          <Plus className="size-4" /> Novo funcionario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar funcionario</DialogTitle>
          <DialogDescription>
            Membro da equipe que opera o parque ou faz vendas.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="ns-name">Nome completo</Label>
            <Input
              id="ns-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ns-role">Funcao</Label>
              <Input
                id="ns-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Atendente, Caixa, Supervisor..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-comm">Comissao (%)</Label>
              <Input
                id="ns-comm"
                inputMode="decimal"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ns-phone">WhatsApp</Label>
              <Input
                id="ns-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 9..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-email">Email</Label>
              <Input
                id="ns-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
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
              {submitting ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewShiftDialog({
  members,
  onSubmit,
}: {
  members: StaffMember[];
  onSubmit: (input: StaffShiftInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !date || !start || !end) return;
    setSubmitting(true);
    try {
      await onSubmit({
        member_id: memberId,
        scheduled_date: date,
        start_time: start,
        end_time: end,
      });
      setMemberId("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          disabled={members.filter((m) => m.active).length === 0}
        >
          <Plus className="size-3.5" /> Turno
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo turno</DialogTitle>
          <DialogDescription>Adicione uma escala individual.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="ns-member">Funcionario</Label>
            <select
              id="ns-member"
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
            >
              <option value="">Selecione...</option>
              {members
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                    {m.role_label ? ` · ${m.role_label}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ns-date">Data</Label>
              <Input
                id="ns-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-start">Inicio</Label>
              <Input
                id="ns-start"
                type="time"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-end">Fim</Label>
              <Input
                id="ns-end"
                type="time"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
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
              {submitting ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
