import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Hourglass,
  MessageCircle,
  Phone,
  UserPlus,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";
import { sendWhatsApp } from "@/features/messaging/lib/uazapi";
import { useWaitlist } from "@/features/waitlist/hooks/use-waitlist";
import { formatTimeOfDay } from "@/lib/format";
import type { WaitlistEntry, WaitlistInput } from "@/features/waitlist/types";

function elapsedMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function WaitlistPage() {
  const { active, closed, loading, error, add, setStatus } = useWaitlist();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const callGuardian = async (entry: WaitlistEntry) => {
    setSendingId(entry.id);
    setSendError(null);
    try {
      const result = await sendWhatsApp({
        phone: entry.guardian_phone,
        template_key: "waitlist_called",
        variables: {
          nome: entry.guardian_full_name,
          crianca_sufix: entry.child_full_name
            ? `, ${entry.child_full_name}`
            : "",
        },
        event_type: "waitlist_called",
        context: { waitlist_id: entry.id },
      });
      if (!result.ok) {
        setSendError(
          result.error ?? "Falha ao enviar — verifique a configuracao do WhatsApp."
        );
        return;
      }
      await setStatus(entry.id, "called");
    } finally {
      setSendingId(null);
    }
  };

  const totals = useMemo(() => {
    const waiting = active.filter((e) => e.status === "waiting");
    const called = active.filter((e) => e.status === "called");
    const arrivedToday = closed.filter((e) => e.status === "arrived").length;
    const avgWaitMin =
      waiting.length === 0
        ? 0
        : Math.round(
            waiting.reduce((acc, e) => acc + elapsedMinutes(e.created_at), 0) /
              waiting.length
          );
    return {
      waiting: waiting.length,
      called: called.length,
      arrivedToday,
      avgWaitMin,
    };
  }, [active, closed]);

  return (
    <div>
      <PageHeader
        title="Lista de espera"
        description="Pais aguardando vaga — chame quando o parque liberar."
        actions={<AddToWaitlistDialog onSubmit={add} />}
      />

      <div className="space-y-6 p-6">
        {isUsingMockData ? (
          <div className="rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-2 text-xs">
            <strong>Modo demo:</strong> a lista comeca vazia.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {error}
          </div>
        ) : null}
        {sendError ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {sendError}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Aguardando" value={totals.waiting.toString()} color="#F4B73F" />
          <Kpi label="Chamados" value={totals.called.toString()} color="#3CB4E0" />
          <Kpi label="Chegaram hoje" value={totals.arrivedToday.toString()} color="#A6CD3F" />
          <Kpi
            label="Espera media"
            value={`${totals.avgWaitMin} min`}
            color="#7B36BF"
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Fila ativa
            </h2>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Hourglass className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">
                Ninguem na lista no momento
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use o botao <strong>Adicionar a lista</strong> quando o parque
                estiver lotado.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {active.map((e, i) => {
                const minutes = elapsedMinutes(e.created_at);
                const isCalled = e.status === "called";
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span
                      className="flex size-9 items-center justify-center rounded-full text-sm font-black"
                      style={{
                        background: isCalled ? "#3CB4E0" : "#F4B73F",
                        color: "#0f172a",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {e.guardian_full_name}
                        {e.child_full_name ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {e.child_full_name}
                          </span>
                        ) : null}
                        {e.party_size > 1 ? (
                          <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {e.party_size} criancas
                          </span>
                        ) : null}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="size-3" />
                        {e.guardian_phone}
                        <span>·</span>
                        <span>
                          entrou {formatTimeOfDay(e.created_at)} ({minutes} min atras)
                        </span>
                        {isCalled && e.called_at ? (
                          <>
                            <span>·</span>
                            <span className="text-[#3CB4E0]">
                              chamado {formatTimeOfDay(e.called_at)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!isCalled ? (
                        <Button
                          size="sm"
                          className="bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90"
                          disabled={sendingId === e.id}
                          onClick={() => void callGuardian(e)}
                        >
                          <MessageCircle className="size-3.5" />
                          {sendingId === e.id ? "Enviando..." : "Chamar"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
                          onClick={() => void setStatus(e.id, "arrived")}
                        >
                          <CheckCircle2 className="size-3.5" /> Chegou
                        </Button>
                      )}
                      {isCalled ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => void setStatus(e.id, "no_show")}
                        >
                          Nao veio
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-[#EA4D8E]"
                        onClick={() => void setStatus(e.id, "canceled")}
                        aria-label="Cancelar"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Recentes
            </h2>
            <p className="text-xs text-muted-foreground">{closed.length}</p>
          </header>
          {closed.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhuma entrada encerrada ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsavel</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Encerrado</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closed.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.guardian_full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.guardian_phone}
                      </TableCell>
                      <TableCell>{formatTimeOfDay(e.created_at)}</TableCell>
                      <TableCell>
                        {e.closed_at ? formatTimeOfDay(e.closed_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <ClosedStatusPill status={e.status} />
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
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function ClosedStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    arrived: { label: "Chegou", bg: "#A6CD3F", fg: "#0f172a" },
    no_show: { label: "Nao veio", bg: "#EA4D8E", fg: "#ffffff" },
    canceled: { label: "Cancelado", bg: "#94a3b8", fg: "#ffffff" },
  };
  const s = map[status] ?? { label: status, bg: "#94a3b8", fg: "#ffffff" };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function AddToWaitlistDialog({
  onSubmit,
}: {
  onSubmit: (input: WaitlistInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [child, setChild] = useState("");
  const [party, setParty] = useState("1");

  const reset = () => {
    setName("");
    setPhone("");
    setChild("");
    setParty("1");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        guardian_full_name: name.trim(),
        guardian_phone: phone.trim(),
        child_full_name: child.trim() || undefined,
        party_size: parseInt(party, 10) || 1,
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
          <UserPlus className="size-4" /> Adicionar a lista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar a lista de espera</DialogTitle>
          <DialogDescription>
            Notificacao por WhatsApp quando uma vaga liberar.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="wl-name">Responsavel</Label>
            <Input
              id="wl-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wl-phone">WhatsApp</Label>
            <Input
              id="wl-phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 9..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wl-child">Crianca (opcional)</Label>
              <Input
                id="wl-child"
                value={child}
                onChange={(e) => setChild(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-party">Quantas criancas</Label>
              <Input
                id="wl-party"
                type="number"
                min={1}
                value={party}
                onChange={(e) => setParty(e.target.value)}
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
              {submitting ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
