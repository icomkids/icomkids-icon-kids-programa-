import { useState } from "react";
import { UserPlus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useGuardiansList } from "../hooks/use-guardians-list";
import { usePlans } from "../hooks/use-plans";
import type { SubscriptionInput } from "../types";

interface Props {
  onSubmit: (input: SubscriptionInput) => Promise<unknown>;
}

export function NewSubscriptionDialog({ onSubmit }: Props) {
  const { plans } = usePlans(true);
  const { guardians } = useGuardiansList();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [planId, setPlanId] = useState<string>("");
  const [guardianId, setGuardianId] = useState<string>("");
  const [startsOn, setStartsOn] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  const reset = () => {
    setPlanId("");
    setGuardianId("");
    setStartsOn(new Date().toISOString().slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId || !guardianId) return;
    setSubmitting(true);
    try {
      await onSubmit({
        plan_id: planId,
        guardian_id: guardianId,
        starts_on: startsOn,
      });
      reset();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const noPlans = plans.length === 0;
  const noGuardians = guardians.length === 0;
  const blocked = noPlans || noGuardians;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90">
          <UserPlus className="size-4" /> Novo assinante
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar assinante</DialogTitle>
          <DialogDescription>
            Vincula um responsavel a um plano mensal.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="space-y-3 rounded-md border border-[#F4B73F] bg-[#F4B73F]/10 p-4 text-sm">
            {noPlans ? (
              <p>
                <strong>Sem planos ativos.</strong> Crie um plano primeiro
                clicando em <em>Novo plano</em>.
              </p>
            ) : null}
            {noGuardians ? (
              <p>
                <strong>Sem responsaveis cadastrados.</strong> Faca o
                cadastro de uma crianca no painel CRM antes — o responsavel e
                criado junto.
              </p>
            ) : null}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="ns-plan">Plano</Label>
              <select
                id="ns-plan"
                required
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
              >
                <option value="">Selecione...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — R$ {(p.monthly_cents / 100).toFixed(2)}/mes
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-guardian">Responsavel</Label>
              <select
                id="ns-guardian"
                required
                value={guardianId}
                onChange={(e) => setGuardianId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
              >
                <option value="">Selecione...</option>
                {guardians.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.full_name}
                    {g.phone ? ` · ${g.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-starts">Inicio</Label>
              <Input
                id="ns-starts"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
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
                {submitting ? "Salvando..." : "Cadastrar assinante"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
