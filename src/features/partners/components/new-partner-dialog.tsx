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
import type { PartnerInput } from "../types";

interface Props {
  onSubmit: (input: PartnerInput) => Promise<unknown>;
}

export function NewPartnerDialog({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [commission, setCommission] = useState("10");

  const reset = () => {
    setName("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setCommission("10");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const pct = parseFloat(commission.replace(",", ".")) || 0;
    if (pct < 0 || pct > 100) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        contact_name: contactName.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
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
          <Plus className="size-4" /> Novo parceiro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar parceiro</DialogTitle>
          <DialogDescription>
            Escola ou parceiro que indica criancas para o parque.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Nome do parceiro</Label>
            <Input
              id="np-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Escola Crescer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-contact">Contato</Label>
              <Input
                id="np-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome do responsavel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-phone">WhatsApp</Label>
              <Input
                id="np-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(11) 9..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <Input
              id="np-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contato@escola.edu.br"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-commission">Comissao (%)</Label>
            <Input
              id="np-commission"
              required
              inputMode="decimal"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              placeholder="10"
            />
            <p className="text-[11px] text-muted-foreground">
              Percentual sobre o faturamento gerado pelas criancas indicadas.
            </p>
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
