import { useState } from "react";
import { Plus } from "lucide-react";
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
import type { SubscriptionPlanInput } from "../types";

interface Props {
  onSubmit: (input: SubscriptionPlanInput) => Promise<unknown>;
}

export function NewPlanDialog({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [monthly, setMonthly] = useState("");
  const [includedHours, setIncludedHours] = useState("0");
  const [discount, setDiscount] = useState("0");

  const reset = () => {
    setName("");
    setDescription("");
    setMonthly("");
    setIncludedHours("0");
    setDiscount("0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !monthly) return;
    const monthlyCents = Math.round(
      parseFloat(monthly.replace(",", ".")) * 100
    );
    const includedMinutes = Math.round(
      (parseFloat(includedHours.replace(",", ".")) || 0) * 60
    );
    const pct = parseFloat(discount.replace(",", ".")) || 0;
    if (Number.isNaN(monthlyCents) || monthlyCents < 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        monthly_cents: monthlyCents,
        included_minutes: includedMinutes,
        discount_pct: pct,
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
          <Plus className="size-4" /> Novo plano
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo plano de assinatura</DialogTitle>
          <DialogDescription>
            Defina o pacote mensal que sera oferecido aos clientes.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Nome do plano</Label>
            <Input
              id="np-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Mensal Premium"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-desc">Descricao</Label>
            <Input
              id="np-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beneficios do plano"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-monthly">Mensalidade (R$)</Label>
              <Input
                id="np-monthly"
                required
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="149,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-hours">Horas incluidas/mes</Label>
              <Input
                id="np-hours"
                inputMode="decimal"
                value={includedHours}
                onChange={(e) => setIncludedHours(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-discount">Desconto (%)</Label>
              <Input
                id="np-discount"
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
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
              {submitting ? "Salvando..." : "Cadastrar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
