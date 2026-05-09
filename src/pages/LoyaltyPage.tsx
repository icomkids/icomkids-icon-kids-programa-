import { useMemo, useState } from "react";
import { Award, Gift, Plus, Sparkles } from "lucide-react";
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
import { useLoyalty } from "@/features/loyalty/hooks/use-loyalty";
import { formatTimeOfDay } from "@/lib/format";
import type {
  LoyaltyAccount,
  LoyaltyReward,
  LoyaltyRewardInput,
} from "@/features/loyalty/types";

function formatPoints(n: number): string {
  return n.toLocaleString("pt-BR");
}

export default function LoyaltyPage() {
  const {
    rewards,
    accounts,
    transactions,
    loading,
    createReward,
    setRewardActive,
    redeemReward,
  } = useLoyalty();

  const totals = useMemo(() => {
    const totalAccounts = accounts.length;
    const totalEarned = accounts.reduce((acc, a) => acc + a.total_earned, 0);
    const outstanding = accounts.reduce(
      (acc, a) => acc + a.points_balance,
      0
    );
    const totalRedeemed = accounts.reduce(
      (acc, a) => acc + a.total_redeemed,
      0
    );
    return { totalAccounts, totalEarned, outstanding, totalRedeemed };
  }, [accounts]);

  const tier = (balance: number): { label: string; color: string } => {
    if (balance >= 1000) return { label: "Diamante", color: "#7B36BF" };
    if (balance >= 500) return { label: "Ouro", color: "#F4B73F" };
    if (balance >= 200) return { label: "Prata", color: "#94a3b8" };
    return { label: "Bronze", color: "#F39230" };
  };

  return (
    <div>
      <PageHeader
        title="Fidelidade"
        description="Pontos por visita / compra e catalogo de recompensas."
        actions={<NewRewardDialog onSubmit={createReward} />}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Membros"
            value={totals.totalAccounts.toString()}
            color="#1E78DC"
          />
          <Kpi
            label="Pontos circulantes"
            value={formatPoints(totals.outstanding)}
            color="#F4B73F"
            sub="saldo total"
          />
          <Kpi
            label="Pontos ganhos"
            value={formatPoints(totals.totalEarned)}
            color="#A6CD3F"
            sub="historico total"
          />
          <Kpi
            label="Pontos resgatados"
            value={formatPoints(totals.totalRedeemed)}
            color="#7B36BF"
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-[#7B36BF]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Recompensas
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">{rewards.length}</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : rewards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <Gift className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">Sem recompensas no catalogo</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use <strong>Nova recompensa</strong> no topo para criar a
                primeira opcao de resgate.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-bold">{r.name}</p>
                      {r.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.description}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        background: r.active ? "#A6CD3F" : "#94a3b8",
                        color: r.active ? "#0f172a" : "#ffffff",
                      }}
                    >
                      {r.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-[#7B36BF]">
                    {formatPoints(r.cost_points)}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      pontos
                    </span>
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-2 w-full text-xs"
                    onClick={() => setRewardActive(r.id, !r.active)}
                  >
                    {r.active ? "Desativar" : "Reativar"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Membros
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">{accounts.length}</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">
                Nenhum membro cadastrado ainda
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Membros sao criados automaticamente quando uma sessao com
                pagamento e encerrada no painel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Ganhos</TableHead>
                    <TableHead className="text-right">Resgatados</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => {
                    const t = tier(a.points_balance);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.guardian_name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.guardian_phone ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: t.color, color: "#ffffff" }}
                          >
                            {t.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-[#7B36BF]">
                          {formatPoints(a.points_balance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatPoints(a.total_earned)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatPoints(a.total_redeemed)}
                        </TableCell>
                        <TableCell className="text-right">
                          <RedeemDialog
                            account={a}
                            rewards={rewards.filter(
                              (r) => r.active && r.cost_points <= a.points_balance
                            )}
                            onRedeem={redeemReward}
                          />
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
              Movimentacoes recentes
            </h2>
            <p className="text-xs text-muted-foreground">{transactions.length}</p>
          </header>
          {transactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sem movimentacoes ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.map((t) => {
                const credit = t.delta > 0;
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.guardian_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.reason} · {formatTimeOfDay(t.created_at)}
                      </p>
                    </div>
                    <p
                      className="text-base font-black tabular-nums"
                      style={{ color: credit ? "#5a8e10" : "#EA4D8E" }}
                    >
                      {credit ? "+" : ""}
                      {formatPoints(t.delta)}
                    </p>
                  </li>
                );
              })}
            </ul>
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

function NewRewardDialog({
  onSubmit,
}: {
  onSubmit: (input: LoyaltyRewardInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("100");

  const reset = () => {
    setName("");
    setDescription("");
    setCost("100");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cost) return;
    const c = parseInt(cost, 10) || 0;
    if (c <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        cost_points: c,
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
          <Plus className="size-4" /> Nova recompensa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova recompensa</DialogTitle>
          <DialogDescription>
            O cliente troca pontos por essa recompensa no caixa.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="nr-name">Nome</Label>
            <Input
              id="nr-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: 30 minutos extras"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nr-desc">Descricao</Label>
            <Input
              id="nr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nr-cost">Custo em pontos</Label>
            <Input
              id="nr-cost"
              type="number"
              min={1}
              required
              value={cost}
              onChange={(e) => setCost(e.target.value)}
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
              className="bg-[#7B36BF] text-white hover:bg-[#7B36BF]/90"
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

function RedeemDialog({
  account,
  rewards,
  onRedeem,
}: {
  account: LoyaltyAccount;
  rewards: LoyaltyReward[];
  onRedeem: (accountId: string, rewardId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async (rewardId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await onRedeem(account.id, rewardId);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao resgatar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          disabled={rewards.length === 0}
        >
          <Gift className="size-3.5" /> Resgatar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resgatar recompensa</DialogTitle>
          <DialogDescription>
            {account.guardian_name} tem{" "}
            <strong>{formatPoints(account.points_balance)}</strong> pontos.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-3 py-2 text-xs text-[#EA4D8E]">
            {error}
          </div>
        ) : null}
        <ul className="space-y-2">
          {rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Saldo insuficiente para qualquer recompensa do catalogo.
            </p>
          ) : (
            rewards.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold">{r.name}</p>
                  {r.description ? (
                    <p className="text-[11px] text-muted-foreground">
                      {r.description}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  className="bg-[#7B36BF] text-white hover:bg-[#7B36BF]/90"
                  disabled={submitting}
                  onClick={() => void handleRedeem(r.id)}
                >
                  {formatPoints(r.cost_points)} pts
                </Button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
