import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Wrench,
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
import { useInventory } from "@/features/inventory/hooks/use-inventory";
import { formatBRL } from "@/lib/format";
import type {
  Asset,
  AssetCondition,
  AssetInput,
  MaintenanceInput,
  MaintenanceType,
} from "@/features/inventory/types";

const conditionMeta: Record<
  AssetCondition,
  { label: string; bg: string; fg: string }
> = {
  good: { label: "OK", bg: "#A6CD3F", fg: "#0f172a" },
  attention: { label: "Atencao", bg: "#F4B73F", fg: "#0f172a" },
  broken: { label: "Quebrado", bg: "#EA4D8E", fg: "#ffffff" },
};

function formatDateBR(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function daysFromNow(iso: string): number {
  const d = new Date(iso + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / (24 * 60 * 60 * 1000));
}

export default function InventoryPage() {
  const {
    assets,
    pending,
    recent,
    loading,
    createAsset,
    setAssetActive,
    scheduleMaintenance,
    completeMaintenance,
    setMaintenanceStatus,
  } = useInventory();

  const totals = useMemo(() => {
    const active = assets.filter((a) => a.active).length;
    const overdue = pending.filter((p) => p.status === "overdue").length;
    const dueSoon = pending.filter((p) => {
      if (p.status === "overdue") return false;
      const d = daysFromNow(p.scheduled_date);
      return d >= 0 && d <= 7;
    }).length;
    const broken = assets.filter(
      (a) => a.active && a.condition === "broken"
    ).length;
    return { active, overdue, dueSoon, broken };
  }, [assets, pending]);

  return (
    <div>
      <PageHeader
        title="Inventario de ativos"
        description="Brinquedos, equipamentos e manutencao preventiva."
        actions={
          <div className="flex items-center gap-2">
            <NewAssetDialog onSubmit={createAsset} />
            <NewMaintenanceDialog
              assets={assets.filter((a) => a.active)}
              onSubmit={scheduleMaintenance}
            />
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Ativos no parque" value={totals.active.toString()} color="#1E78DC" />
          <Kpi
            label="Manutencoes em atraso"
            value={totals.overdue.toString()}
            color="#EA4D8E"
          />
          <Kpi
            label="Vencendo em 7 dias"
            value={totals.dueSoon.toString()}
            color="#F4B73F"
          />
          <Kpi
            label="Itens quebrados"
            value={totals.broken.toString()}
            color="#7B36BF"
          />
        </div>

        {totals.overdue > 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-2 text-sm">
            <AlertTriangle className="size-4 text-[#EA4D8E]" />
            <strong>{totals.overdue}</strong>{" "}
            {totals.overdue === 1 ? "manutencao em atraso" : "manutencoes em atraso"}.
            Veja a sessao "Pendentes" abaixo.
          </div>
        ) : null}

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Manutencoes pendentes
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">{pending.length}</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="size-6 text-[#A6CD3F]" />
              <p>Nada pendente. Todos os ativos em dia ✔</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((p) => {
                const days = daysFromNow(p.scheduled_date);
                const overdue = p.status === "overdue";
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3"
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-md text-white"
                      style={{
                        background: overdue ? "#EA4D8E" : "#1E78DC",
                      }}
                    >
                      <Wrench className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{p.asset_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.type === "preventive" ? "Preventiva" : "Corretiva"} ·{" "}
                        {formatDateBR(p.scheduled_date)}{" "}
                        {overdue
                          ? `(atraso de ${Math.abs(days)} dias)`
                          : days === 0
                          ? "(hoje)"
                          : days > 0
                          ? `(em ${days} dias)`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        className="bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90"
                        onClick={() => void completeMaintenance(p.id)}
                      >
                        <CheckCircle2 className="size-3.5" /> Feita
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-[#EA4D8E]"
                        onClick={() => void setMaintenanceStatus(p.id, "canceled")}
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
              Ativos cadastrados
            </h2>
            <p className="text-xs text-muted-foreground">{assets.length}</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Wrench className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">Nenhum ativo cadastrado</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use <strong>Novo ativo</strong> no topo para registrar o
                primeiro brinquedo ou equipamento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Condicao</TableHead>
                    <TableHead>Proxima manutencao</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => {
                    const cond = conditionMeta[a.condition];
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.location ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: cond.bg, color: cond.fg }}
                          >
                            {cond.label}
                          </span>
                        </TableCell>
                        <TableCell
                          className={
                            a.next_maintenance_date &&
                            daysFromNow(a.next_maintenance_date) < 0
                              ? "font-semibold text-[#EA4D8E]"
                              : a.next_maintenance_date &&
                                daysFromNow(a.next_maintenance_date) <= 7
                              ? "font-semibold text-[#F39230]"
                              : "text-muted-foreground"
                          }
                        >
                          {a.next_maintenance_date
                            ? formatDateBR(a.next_maintenance_date)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: a.active ? "#A6CD3F" : "#94a3b8",
                              color: a.active ? "#0f172a" : "#ffffff",
                            }}
                          >
                            {a.active ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => void setAssetActive(a.id, !a.active)}
                          >
                            {a.active ? "Desativar" : "Reativar"}
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

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historico
            </h2>
            <p className="text-xs text-muted-foreground">{recent.length}</p>
          </header>
          {recent.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sem manutencoes registradas ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tecnico</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {r.completed_at
                          ? formatDateBR(r.completed_at.slice(0, 10))
                          : formatDateBR(r.scheduled_date)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.asset_name}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                          {r.type === "preventive" ? "Preventiva" : "Corretiva"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.performed_by ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(r.cost_cents)}
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

function NewAssetDialog({
  onSubmit,
}: {
  onSubmit: (input: AssetInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("brinquedo");
  const [location, setLocation] = useState("");
  const [serial, setSerial] = useState("");
  const [purchase, setPurchase] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("good");

  const reset = () => {
    setName("");
    setCategory("brinquedo");
    setLocation("");
    setSerial("");
    setPurchase("");
    setCondition("good");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        category: category.trim() || undefined,
        location: location.trim() || undefined,
        serial_number: serial.trim() || undefined,
        purchase_date: purchase || undefined,
        condition,
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
          <Plus className="size-4" /> Novo ativo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar ativo</DialogTitle>
          <DialogDescription>
            Brinquedo, equipamento ou movel do parque.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="na-name">Nome</Label>
            <Input
              id="na-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Piscina de bolinhas"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="na-cat">Categoria</Label>
              <Input
                id="na-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-loc">Local</Label>
              <Input
                id="na-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Sala azul"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="na-serial">N. de serie</Label>
              <Input
                id="na-serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-purchase">Aquisicao</Label>
              <Input
                id="na-purchase"
                type="date"
                value={purchase}
                onChange={(e) => setPurchase(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Condicao</Label>
            <div className="flex gap-1">
              {(
                [
                  { v: "good" as const, label: "OK", color: "#A6CD3F" },
                  { v: "attention" as const, label: "Atencao", color: "#F4B73F" },
                  { v: "broken" as const, label: "Quebrado", color: "#EA4D8E" },
                ]
              ).map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setCondition(c.v)}
                  className="flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase transition"
                  style={{
                    background: condition === c.v ? c.color : "transparent",
                    color: condition === c.v ? "#0f172a" : c.color,
                    borderColor: c.color,
                  }}
                >
                  {c.label}
                </button>
              ))}
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

function NewMaintenanceDialog({
  assets,
  onSubmit,
}: {
  assets: Asset[];
  onSubmit: (input: MaintenanceInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [type, setType] = useState<MaintenanceType>("preventive");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || !date) return;
    setSubmitting(true);
    try {
      await onSubmit({
        asset_id: assetId,
        type,
        scheduled_date: date,
        notes: notes.trim() || undefined,
      });
      setAssetId("");
      setNotes("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          disabled={assets.length === 0}
        >
          <Wrench className="size-4" /> Agendar manutencao
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar manutencao</DialogTitle>
          <DialogDescription>
            Preventiva (revisao periodica) ou corretiva (reparo).
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="nm-asset">Ativo</Label>
            <select
              id="nm-asset"
              required
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
            >
              <option value="">Selecione...</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.location ? ` · ${a.location}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex gap-1">
                {(["preventive", "corrective"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold uppercase transition ${
                      type === t
                        ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {t === "preventive" ? "Preventiva" : "Corretiva"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-date">Data</Label>
              <Input
                id="nm-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nm-notes">Observacoes</Label>
            <Input
              id="nm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que precisa fazer"
            />
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
              {submitting ? "Salvando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
