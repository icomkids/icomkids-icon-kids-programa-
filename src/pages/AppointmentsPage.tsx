import { useMemo, useState } from "react";
import {
  Baby,
  CalendarRange,
  CheckCircle2,
  MessageCircle,
  PartyPopper,
  Plus,
  Trash2,
  X,
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
import { useAppointments } from "@/features/appointments/hooks/use-appointments";
import { sendWhatsApp } from "@/features/messaging/lib/uazapi";
import { formatBRL } from "@/lib/format";
import type {
  Appointment,
  AppointmentChild,
  AppointmentInput,
  AppointmentKind,
  AppointmentStatus,
  Gender,
} from "@/features/appointments/types";

const statusMeta: Record<AppointmentStatus, { label: string; bg: string; fg: string }> = {
  requested: { label: "Solicitado", bg: "#F4B73F", fg: "#0f172a" },
  confirmed: { label: "Confirmado", bg: "#3CB4E0", fg: "#0f172a" },
  in_progress: { label: "Em curso", bg: "#1E78DC", fg: "#ffffff" },
  completed: { label: "Concluido", bg: "#A6CD3F", fg: "#0f172a" },
  canceled: { label: "Cancelado", bg: "#94a3b8", fg: "#ffffff" },
  no_show: { label: "Nao compareceu", bg: "#EA4D8E", fg: "#ffffff" },
};

const kindLabels: Record<AppointmentKind, string> = {
  visit: "visita",
  event: "festa / evento",
};

function formatDateBR(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

export default function AppointmentsPage() {
  const { upcoming, closed, loading, error, create, setStatus } = useAppointments();
  const [busyId, setBusyId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const today = upcoming.filter((a) => a.scheduled_date === todayIso);
    const events = upcoming.filter((a) => a.kind === "event");
    const projectedRevenueCents = upcoming.reduce(
      (acc, a) => acc + a.total_cents,
      0
    );
    return {
      today: today.length,
      upcoming: upcoming.length,
      events: events.length,
      projected: projectedRevenueCents,
    };
  }, [upcoming]);

  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of upcoming) {
      const arr = map.get(a.scheduled_date) ?? [];
      arr.push(a);
      map.set(a.scheduled_date, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [upcoming]);

  const confirmAndNotify = async (appt: Appointment) => {
    setBusyId(appt.id);
    try {
      await setStatus(appt.id, "confirmed");
      void sendWhatsApp({
        phone: appt.guardian_phone,
        template_key: "appointment_confirmed",
        variables: {
          nome: appt.guardian_name,
          tipo: kindLabels[appt.kind],
          data: formatDateBR(appt.scheduled_date),
          hora: formatTime(appt.scheduled_start_time),
        },
        event_type: "appointment_confirmed",
        context: { appointment_id: appt.id },
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Agendamento e eventos"
        description="Visitas marcadas e festas privadas no parque."
        actions={<NewAppointmentDialog onSubmit={create} />}
      />

      <div className="space-y-6 p-6">
        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Hoje" value={totals.today.toString()} color="#1E78DC" />
          <Kpi label="Agendados" value={totals.upcoming.toString()} color="#3CB4E0" />
          <Kpi label="Festas no roteiro" value={totals.events.toString()} color="#7B36BF" />
          <Kpi
            label="Receita projetada"
            value={formatBRL(totals.projected)}
            color="#A6CD3F"
            sub="dos agendamentos abertos"
          />
        </div>

        <section className="space-y-4">
          {loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center">
              <CalendarRange className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">
                Nenhum agendamento futuro
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use <strong>Novo agendamento</strong> no topo para registrar
                a primeira visita ou festa.
              </p>
            </div>
          ) : (
            grouped.map(([date, items]) => (
              <div
                key={date}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <header className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    {formatDateBR(date)}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {items.length}{" "}
                    {items.length === 1 ? "agendamento" : "agendamentos"}
                  </p>
                </header>
                <ul className="divide-y divide-border">
                  {items.map((a) => {
                    const meta = statusMeta[a.status];
                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        <div
                          className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg text-white"
                          style={{
                            background:
                              a.kind === "event" ? "#7B36BF" : "#1E78DC",
                          }}
                        >
                          {a.kind === "event" ? (
                            <PartyPopper className="size-5" />
                          ) : (
                            <CalendarRange className="size-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">
                            {a.title ??
                              (a.kind === "event"
                                ? `Festa de ${a.child_name ?? "—"}`
                                : `Visita de ${a.child_name ?? a.guardian_name}`)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(a.scheduled_start_time)}
                            {a.scheduled_end_time
                              ? `–${formatTime(a.scheduled_end_time)}`
                              : ""}{" "}
                            · {a.guardian_name} · {a.guardian_phone} ·{" "}
                            {a.party_size}{" "}
                            {a.party_size === 1 ? "crianca" : "criancas"}
                          </p>
                          {a.children.length > 0 ? (
                            <ul className="mt-1.5 flex flex-wrap gap-1">
                              {a.children.map((c, i) => (
                                <li
                                  key={c.id ?? i}
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    background:
                                      c.gender === "girl"
                                        ? "#EA4D8E"
                                        : c.gender === "boy"
                                        ? "#1E78DC"
                                        : "#94a3b8",
                                    color: "#ffffff",
                                  }}
                                >
                                  {c.full_name}
                                  {c.age != null
                                    ? ` · ${c.age}a`
                                    : ""}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {a.total_cents > 0 ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Total {formatBRL(a.total_cents)}
                              {a.deposit_cents > 0
                                ? ` · Sinal ${formatBRL(a.deposit_cents)}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{ background: meta.bg, color: meta.fg }}
                        >
                          {meta.label}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {a.status === "requested" ? (
                            <Button
                              size="sm"
                              className="bg-[#3CB4E0] text-slate-900 hover:bg-[#3CB4E0]/90"
                              disabled={busyId === a.id}
                              onClick={() => void confirmAndNotify(a)}
                            >
                              <MessageCircle className="size-3.5" />
                              Confirmar
                            </Button>
                          ) : null}
                          {a.status === "confirmed" ? (
                            <Button
                              size="sm"
                              className="bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90"
                              onClick={() => void setStatus(a.id, "completed")}
                            >
                              <CheckCircle2 className="size-3.5" /> Concluir
                            </Button>
                          ) : null}
                          {a.status === "requested" || a.status === "confirmed" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-[#EA4D8E]"
                              onClick={() => void setStatus(a.id, "canceled")}
                            >
                              <X className="size-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historico recente
            </h2>
            <p className="text-xs text-muted-foreground">{closed.length}</p>
          </header>
          {closed.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sem registros encerrados ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Crianca</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closed.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {formatDateBR(a.scheduled_date)}{" "}
                        {formatTime(a.scheduled_start_time)}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                          {kindLabels[a.kind]}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {a.guardian_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.child_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: statusMeta[a.status].bg,
                            color: statusMeta[a.status].fg,
                          }}
                        >
                          {statusMeta[a.status].label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(a.total_cents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

interface ChildDraft {
  full_name: string;
  age: string;
  gender: Gender | "";
}

const emptyChild = (): ChildDraft => ({ full_name: "", age: "", gender: "" });

function NewAppointmentDialog({
  onSubmit,
}: {
  onSubmit: (input: AppointmentInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [kind, setKind] = useState<AppointmentKind>("visit");
  const [title, setTitle] = useState("");
  const [guardian, setGuardian] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()]);

  const reset = () => {
    setKind("visit");
    setTitle("");
    setGuardian("");
    setPhone("");
    setDate(new Date().toISOString().slice(0, 10));
    setStart("14:00");
    setEnd("");
    setTotal("");
    setDeposit("");
    setChildren([emptyChild()]);
  };

  const updateChild = (idx: number, patch: Partial<ChildDraft>) => {
    setChildren((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const addChild = () => setChildren((prev) => [...prev, emptyChild()]);
  const removeChild = (idx: number) =>
    setChildren((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardian.trim() || !phone.trim() || !date || !start) return;
    const filledChildren: AppointmentChild[] = children
      .filter((c) => c.full_name.trim().length > 0)
      .map((c) => ({
        full_name: c.full_name.trim(),
        age: c.age ? Math.max(0, parseInt(c.age, 10)) : null,
        gender: c.gender || null,
        notes: null,
      }));
    if (filledChildren.length === 0) {
      // Need at least one child
      return;
    }
    setSubmitting(true);
    try {
      const totalCents = total
        ? Math.round(parseFloat(total.replace(",", ".")) * 100)
        : 0;
      const depositCents = deposit
        ? Math.round(parseFloat(deposit.replace(",", ".")) * 100)
        : 0;
      await onSubmit({
        kind,
        title: title.trim() || undefined,
        guardian_name: guardian.trim(),
        guardian_phone: phone.trim(),
        child_name: filledChildren[0]?.full_name,
        party_size: filledChildren.length,
        scheduled_date: date,
        scheduled_start_time: start,
        scheduled_end_time: end || undefined,
        total_cents: Number.isFinite(totalCents) ? totalCents : 0,
        deposit_cents: Number.isFinite(depositCents) ? depositCents : 0,
        children: filledChildren,
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
          <Plus className="size-4" /> Novo agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Visita marcada ou reserva de espaco para festa.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex gap-1">
              {(["visit", "event"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold uppercase transition ${
                    kind === k
                      ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {k === "visit" ? "Visita" : "Festa / Evento"}
                </button>
              ))}
            </div>
          </div>
          {kind === "event" ? (
            <div className="space-y-1.5">
              <Label htmlFor="ap-title">Titulo do evento</Label>
              <Input
                id="ap-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Festa do Pedro 5 anos"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-guardian">Responsavel</Label>
              <Input
                id="ap-guardian"
                required
                value={guardian}
                onChange={(e) => setGuardian(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-phone">WhatsApp</Label>
              <Input
                id="ap-phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 9..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Baby className="size-3.5" />
                Criancas ({children.length})
              </Label>
              <button
                type="button"
                onClick={addChild}
                className="flex items-center gap-1 rounded-md bg-[#1E78DC]/10 px-2 py-1 text-[11px] font-semibold text-[#1E78DC] hover:bg-[#1E78DC]/20"
              >
                <Plus className="size-3" /> Adicionar
              </button>
            </div>
            <ul className="space-y-2">
              {children.map((c, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 rounded-md border border-border p-2"
                >
                  <Input
                    placeholder="Nome"
                    value={c.full_name}
                    onChange={(e) => updateChild(i, { full_name: e.target.value })}
                    className="h-8 text-sm"
                    required={i === 0}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={18}
                    placeholder="Idade"
                    value={c.age}
                    onChange={(e) => updateChild(i, { age: e.target.value })}
                    className="h-8 w-20 text-sm"
                  />
                  <div className="flex gap-0.5">
                    {(
                      [
                        { v: "boy" as const, label: "M", color: "#1E78DC" },
                        { v: "girl" as const, label: "F", color: "#EA4D8E" },
                      ]
                    ).map((g) => (
                      <button
                        key={g.v}
                        type="button"
                        onClick={() =>
                          updateChild(i, {
                            gender: c.gender === g.v ? "" : g.v,
                          })
                        }
                        className="flex size-8 items-center justify-center rounded text-xs font-bold transition"
                        style={{
                          background: c.gender === g.v ? g.color : "transparent",
                          color: c.gender === g.v ? "#ffffff" : g.color,
                          border: `1px solid ${g.color}`,
                        }}
                        aria-label={g.v === "boy" ? "Menino" : "Menina"}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChild(i)}
                    disabled={children.length === 1}
                    className="flex size-8 items-center justify-center rounded text-muted-foreground hover:text-[#EA4D8E] disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remover crianca"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-date">Data</Label>
              <Input
                id="ap-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-start">Inicio</Label>
              <Input
                id="ap-start"
                type="time"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-end">Fim</Label>
              <Input
                id="ap-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-total">Valor (R$)</Label>
              <Input
                id="ap-total"
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-deposit">Sinal (R$)</Label>
              <Input
                id="ap-deposit"
                inputMode="decimal"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0,00"
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
