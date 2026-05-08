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
import { usePartners } from "@/features/partners/hooks/use-partners";
import type { ChildGender, QuickRegisterInput } from "../types";

interface Props {
  onSubmit: (input: QuickRegisterInput) => Promise<unknown>;
}

const PRESETS = [30, 45, 60, 90, 120];

export function QuickRegisterDialog({ onSubmit }: Props) {
  const { partners } = usePartners(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [childName, setChildName] = useState("");
  const [childBirth, setChildBirth] = useState("");
  const [childGender, setChildGender] = useState<ChildGender | "">("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [amountReais, setAmountReais] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");

  const reset = () => {
    setChildName("");
    setChildBirth("");
    setChildGender("");
    setGuardianName("");
    setGuardianPhone("");
    setMinutes(60);
    setPaymentMethod("pix");
    setAmountReais("");
    setPartnerId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim() || !guardianName.trim() || minutes <= 0) return;
    setSubmitting(true);
    try {
      const cents = amountReais
        ? Math.round(parseFloat(amountReais.replace(",", ".")) * 100)
        : undefined;
      await onSubmit({
        child_full_name: childName.trim(),
        child_birth_date: childBirth || undefined,
        child_gender: childGender || undefined,
        guardian_full_name: guardianName.trim(),
        guardian_phone: guardianPhone.trim() || undefined,
        contracted_minutes: minutes,
        payment_method: paymentMethod,
        amount_paid_cents: Number.isFinite(cents) ? cents : undefined,
        partner_id: partnerId || null,
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
          <Plus className="size-4" /> Novo cadastro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastro rapido</DialogTitle>
          <DialogDescription>
            Registre a crianca e inicie o tempo na hora.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="qr-child">Nome da crianca</Label>
            <Input
              id="qr-child"
              required
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-birth">Data de nascimento</Label>
              <Input
                id="qr-birth"
                type="date"
                value={childBirth}
                onChange={(e) => setChildBirth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <div className="flex gap-1">
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
                      setChildGender(childGender === g.v ? "" : g.v)
                    }
                    className="flex h-9 w-10 items-center justify-center rounded-md text-sm font-bold transition"
                    style={{
                      background:
                        childGender === g.v ? g.color : "transparent",
                      color: childGender === g.v ? "#ffffff" : g.color,
                      border: `1px solid ${g.color}`,
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-guardian">Responsavel</Label>
              <Input
                id="qr-guardian"
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-phone">WhatsApp</Label>
              <Input
                id="qr-phone"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="(11) 9..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tempo</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                    minutes === m
                      ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {m} min
                </button>
              ))}
              <Input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value || "0", 10))}
                className="w-24"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-amount">Valor (R$)</Label>
              <Input
                id="qr-amount"
                inputMode="decimal"
                value={amountReais}
                onChange={(e) => setAmountReais(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pagamento</Label>
              <div className="flex gap-1">
                {(["pix", "dinheiro", "cartao"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold uppercase transition ${
                      paymentMethod === m
                        ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {partners.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="qr-partner">Parceiro (opcional)</Label>
              <select
                id="qr-partner"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
              >
                <option value="">Nenhum (cliente direto)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
              {submitting ? "Iniciando..." : "Iniciar tempo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
