import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  LockKeyhole,
  Unlock,
} from "lucide-react";
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
import { formatBRL } from "@/lib/format";
import {
  abrirCaixa,
  cancelarMovimento,
  fecharCaixa,
  lancarMovimento,
} from "../lib/caixa-repo";
import type { CaixaResumo } from "../types";

function parseReais(s: string): number {
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

// ============================================================================
// ABRIR CAIXA
// ============================================================================
export function AbrirCaixaButton() {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseReais(valor);
    if (cents < 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await abrirCaixa(cents);
      setOpen(false);
      setValor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir caixa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90">
          <Unlock className="size-4" /> Abrir caixa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
          <DialogDescription>
            Informe o troco inicial (dinheiro fisico que esta na gaveta).
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="ab-valor">Troco inicial (R$)</Label>
            <Input
              id="ab-valor"
              inputMode="decimal"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Pode ser 0 se nao tiver troco inicial.
            </p>
          </div>
          {error ? (
            <p className="text-xs text-[#EA4D8E]">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90"
            >
              {submitting ? "Abrindo..." : "Abrir caixa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SANGRIA / SUPRIMENTO / AJUSTE — mesmo dialog parametrizado
// ============================================================================
function MovimentoDialog({
  tipo,
  triggerLabel,
  triggerColor,
  triggerIcon: TriggerIcon,
  title,
  description,
}: {
  tipo: "sangria" | "suprimento" | "ajuste";
  triggerLabel: string;
  triggerColor: string;
  triggerIcon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseReais(valor);
    if (cents <= 0) {
      setError("Valor deve ser maior que zero");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await lancarMovimento({
        tipo,
        valor_cents: cents,
        descricao: descricao.trim() || undefined,
      });
      setOpen(false);
      setValor("");
      setDescricao("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          style={{ borderColor: triggerColor, color: triggerColor }}
        >
          <TriggerIcon className="size-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="mv-valor">Valor (R$)</Label>
            <Input
              id="mv-valor"
              inputMode="decimal"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-desc">Motivo / descricao</Label>
            <Input
              id="mv-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: troco do caixa, deposito banco, ajuste"
            />
          </div>
          {error ? <p className="text-xs text-[#EA4D8E]">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Lancando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SangriaButton() {
  return (
    <MovimentoDialog
      tipo="sangria"
      triggerLabel="Sangria"
      triggerColor="#EA4D8E"
      triggerIcon={ArrowUpFromLine}
      title="Sangria (saida de dinheiro)"
      description="Dinheiro fisico saindo do caixa. Ex: deposito bancario, pagamento de fornecedor."
    />
  );
}

export function SuprimentoButton() {
  return (
    <MovimentoDialog
      tipo="suprimento"
      triggerLabel="Suprimento"
      triggerColor="#1E78DC"
      triggerIcon={ArrowDownToLine}
      title="Suprimento (entrada de troco)"
      description="Dinheiro fisico entrando sem ser venda. Ex: reforco de troco do dono."
    />
  );
}

// ============================================================================
// FECHAR CAIXA
// ============================================================================
export function FecharCaixaButton({ resumo }: { resumo: CaixaResumo }) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = parseReais(valor);
  const diferenca = cents - resumo.esperado_em_caixa_cents;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cents < 0) return;
    if (diferenca !== 0 && obs.trim().length === 0) {
      setError("Diferenca detectada — observacao obrigatoria");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await fecharCaixa(cents, obs.trim() || undefined);
      setOpen(false);
      setValor("");
      setObs("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#7B36BF] text-white hover:bg-[#7B36BF]/90">
          <LockKeyhole className="size-4" /> Fechar caixa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar caixa</DialogTitle>
          <DialogDescription>
            Conte o dinheiro fisico e informe o valor. O sistema calcula a
            diferenca em relacao ao esperado.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="rounded-lg border-2 border-border bg-muted/40 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Dinheiro esperado no caixa
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#1E78DC]">
              {formatBRL(resumo.esperado_em_caixa_cents)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Abertura + dinheiro de vendas + suprimentos − sangrias + ajustes
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fc-valor">Dinheiro contado (R$)</Label>
            <Input
              id="fc-valor"
              inputMode="decimal"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>

          {valor && (
            <div
              className="rounded-md border-2 px-3 py-2"
              style={{
                borderColor:
                  diferenca === 0
                    ? "#A6CD3F"
                    : Math.abs(diferenca) > 500
                    ? "#EA4D8E"
                    : "#F4B73F",
                background:
                  diferenca === 0
                    ? "#A6CD3F10"
                    : Math.abs(diferenca) > 500
                    ? "#EA4D8E10"
                    : "#F4B73F10",
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">
                Diferenca
              </p>
              <p className="font-mono text-xl font-bold tabular-nums">
                {diferenca > 0 ? "+" : ""}
                {formatBRL(diferenca)}
              </p>
              {diferenca !== 0 ? (
                <p className="mt-1 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="size-3" />
                  {diferenca > 0
                    ? "Sobrou dinheiro — verifique"
                    : "Faltou dinheiro — verifique"}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fc-obs">
              Observacao {diferenca !== 0 ? "(obrigatoria)" : "(opcional)"}
            </Label>
            <textarea
              id="fc-obs"
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B36BF]"
              placeholder={
                diferenca !== 0
                  ? "Ex: troco esquecido na gaveta, erro de digitacao..."
                  : ""
              }
            />
          </div>

          {error ? <p className="text-xs text-[#EA4D8E]">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !valor}
              className="bg-[#7B36BF] text-white hover:bg-[#7B36BF]/90"
            >
              {submitting ? "Fechando..." : "Confirmar fechamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CANCELAR MOVIMENTO (owner only)
// ============================================================================
export function CancelarMovimentoDialog({
  movimentoId,
  trigger,
}: {
  movimentoId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 3) {
      setError("Motivo obrigatorio (min 3 caracteres)");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await cancelarMovimento(movimentoId, motivo.trim());
      setOpen(false);
      setMotivo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancelar movimento</DialogTitle>
          <DialogDescription>
            O movimento fica marcado como cancelado, mas a auditoria preserva o
            registro. Apenas owner pode cancelar.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="cn-motivo">Motivo</Label>
            <textarea
              id="cn-motivo"
              rows={3}
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA4D8E]"
              placeholder="Por que esse movimento esta sendo cancelado?"
              autoFocus
            />
          </div>
          {error ? <p className="text-xs text-[#EA4D8E]">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#EA4D8E] text-white hover:bg-[#EA4D8E]/90"
            >
              {submitting ? "Cancelando..." : "Cancelar movimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
