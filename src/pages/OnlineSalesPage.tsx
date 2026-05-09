import { useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  Plus,
  ShoppingBag,
  Tags,
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
import { useSalesAdmin } from "@/features/sales/hooks/use-sales";
import { formatBRL } from "@/lib/format";
import type {
  TicketOfferInput,
  TicketOrderStatus,
} from "@/features/sales/types";

const statusMeta: Record<
  TicketOrderStatus,
  { label: string; bg: string; fg: string }
> = {
  pending: { label: "Aguardando", bg: "#F4B73F", fg: "#0f172a" },
  paid: { label: "Pago", bg: "#A6CD3F", fg: "#0f172a" },
  canceled: { label: "Cancelado", bg: "#94a3b8", fg: "#ffffff" },
  expired: { label: "Expirado", bg: "#94a3b8", fg: "#ffffff" },
  refunded: { label: "Reembolsado", bg: "#EA4D8E", fg: "#ffffff" },
};

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function OnlineSalesPage() {
  const { offers, orders, loading, createOffer, setOfferActive } = useSalesAdmin();

  const totals = useMemo(() => {
    const since = startOfMonthIso();
    const paid = orders.filter((o) => o.status === "paid");
    const monthRevenue = paid
      .filter((o) => (o.paid_at ?? o.created_at) >= since)
      .reduce((acc, o) => acc + o.amount_cents, 0);
    const pending = orders.filter((o) => o.status === "pending").length;
    return {
      activeOffers: offers.filter((o) => o.active).length,
      totalOrders: orders.length,
      monthRevenue,
      pending,
    };
  }, [offers, orders]);

  const storeUrl = `${window.location.origin}/loja`;

  return (
    <div>
      <PageHeader
        title="Vendas online"
        description="Catalogo da loja, pedidos e link publico do storefront."
        actions={
          <div className="flex items-center gap-2">
            <NewOfferDialog onSubmit={createOffer} />
            <Button
              asChild
              variant="ghost"
              className="text-xs"
            >
              <a href={storeUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Abrir loja
              </a>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Ofertas ativas"
            value={totals.activeOffers.toString()}
            color="#1E78DC"
          />
          <Kpi
            label="Pedidos"
            value={totals.totalOrders.toString()}
            color="#3CB4E0"
          />
          <Kpi
            label="Receita do mes"
            value={formatBRL(totals.monthRevenue)}
            color="#A6CD3F"
            sub="pagos"
          />
          <Kpi
            label="Pendentes"
            value={totals.pending.toString()}
            color="#F4B73F"
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Tags className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Catalogo
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">{offers.length}</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Tags className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">
                Nenhuma oferta no catalogo
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use <strong>Nova oferta</strong> no topo para criar a primeira
                opcao da loja online.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-bold">{o.name}</p>
                      {o.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {o.description}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        background: o.active ? "#A6CD3F" : "#94a3b8",
                        color: o.active ? "#0f172a" : "#ffffff",
                      }}
                    >
                      {o.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-[#1E78DC]">
                    {formatBRL(o.price_cents)}
                  </p>
                  {o.duration_minutes ? (
                    <p className="text-[11px] text-muted-foreground">
                      {o.duration_minutes} min
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-2 w-full text-xs"
                    onClick={() => setOfferActive(o.id, !o.active)}
                  >
                    {o.active ? "Desativar" : "Reativar"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Pedidos
              </h2>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/70"
              onClick={() => void navigator.clipboard.writeText(storeUrl)}
            >
              <Copy className="size-3" />
              Copiar link da loja
            </button>
          </header>
          {orders.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              Sem pedidos ainda. Compartilhe a loja: <code>{storeUrl}</code>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pacote</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const meta = statusMeta[o.status];
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {new Date(o.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-medium">
                          <p>{o.guardian_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {o.guardian_email ?? o.guardian_phone ?? "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.offer_name}
                          {o.child_name ? (
                            <span className="ml-1 text-muted-foreground">
                              · {o.child_name}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(o.amount_cents)}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: meta.bg, color: meta.fg }}
                          >
                            {meta.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

function NewOfferDialog({
  onSubmit,
}: {
  onSubmit: (input: TicketOfferInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const reset = () => {
    setName("");
    setDescription("");
    setDuration("60");
    setPrice("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setSubmitting(true);
    try {
      const cents = Math.round(parseFloat(price.replace(",", ".")) * 100);
      const dur = parseInt(duration, 10);
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        duration_minutes: Number.isFinite(dur) && dur > 0 ? dur : undefined,
        price_cents: Number.isFinite(cents) ? cents : 0,
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
          <Plus className="size-4" /> Nova oferta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova oferta para a loja</DialogTitle>
          <DialogDescription>
            Pacote que aparece na loja online (ex: 60 min de brincadeira por
            R$ 50).
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="no-name">Nome</Label>
            <Input
              id="no-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Pacote 60 minutos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="no-desc">Descricao</Label>
            <Input
              id="no-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="no-duration">Duracao (min)</Label>
              <Input
                id="no-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="no-price">Preco (R$)</Label>
              <Input
                id="no-price"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="50,00"
              />
            </div>
          </div>
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Pagamento via Asaas (PIX, cartao, boleto). A oferta nao precisa
            ser cadastrada antes no painel Asaas — o checkout e criado na
            hora.
          </p>
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
              {submitting ? "Salvando..." : "Cadastrar oferta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
