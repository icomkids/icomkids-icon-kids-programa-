import { useEffect, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { usePartners } from "@/features/partners/hooks/use-partners";
import { formatBRL } from "@/lib/format";
import { uploadChildPhoto } from "../lib/child-photo-upload";
import { usePricing } from "../hooks/use-pricing";
import type { ChildGender, QuickRegisterInput } from "../types";
import { WebcamCapture } from "./webcam-capture";

interface PhoneMatch {
  id: string;
  full_name: string;
  phone: string;
}

interface Props {
  onSubmit: (input: QuickRegisterInput) => Promise<unknown>;
}

export function QuickRegisterDialog({ onSubmit }: Props) {
  const { partners } = usePartners(true);
  const { value: pricing } = usePricing();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [childName, setChildName] = useState("");
  const [childBirth, setChildBirth] = useState("");
  const [childGender, setChildGender] = useState<ChildGender | "">("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [amountReais, setAmountReais] = useState<string>("");

  /** Quando o operador clica num preset, preenche minutos + valor sugerido. */
  const selectTier = (tier: { minutes: number; price_cents: number }) => {
    setMinutes(tier.minutes);
    setAmountReais((tier.price_cents / 100).toFixed(2).replace(".", ","));
  };
  const [partnerId, setPartnerId] = useState<string>("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [phoneMatches, setPhoneMatches] = useState<PhoneMatch[]>([]);

  // Debounce: 500ms apos parar de digitar o telefone, consulta a RPC
  // pra ver se ja existe outro guardian com o mesmo numero. Se sim,
  // mostra warning amarelo (operador pode seguir mesmo assim).
  useEffect(() => {
    if (!open) {
      setPhoneMatches([]);
      return;
    }
    const digits = guardianPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneMatches([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const { data } = await supabase.rpc("find_guardians_by_phone", {
          p_phone: guardianPhone,
        });
        if (!cancelled) setPhoneMatches((data as PhoneMatch[] | null) ?? []);
      } catch {
        if (!cancelled) setPhoneMatches([]);
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [guardianPhone, open]);

  const reset = () => {
    setChildName("");
    setChildBirth("");
    setChildGender("");
    setGuardianName("");
    setGuardianPhone("");
    setGuardianEmail("");
    setMinutes(60);
    setPaymentMethod("pix");
    setAmountReais("");
    setPartnerId("");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim() || !guardianName.trim() || minutes <= 0) return;
    setSubmitting(true);
    setUploadError(null);
    try {
      let photoUrl: string | undefined;
      if (photoBlob) {
        try {
          photoUrl = await uploadChildPhoto(photoBlob);
        } catch (err) {
          setUploadError(
            err instanceof Error
              ? `Falha ao subir foto: ${err.message}`
              : "Falha ao subir foto."
          );
          setSubmitting(false);
          return;
        }
      }
      const cents = amountReais
        ? Math.round(parseFloat(amountReais.replace(",", ".")) * 100)
        : undefined;
      await onSubmit({
        child_full_name: childName.trim(),
        child_birth_date: childBirth || undefined,
        child_gender: childGender || undefined,
        guardian_full_name: guardianName.trim(),
        guardian_phone: guardianPhone.trim() || undefined,
        guardian_email: guardianEmail.trim() || undefined,
        contracted_minutes: minutes,
        photo_url: photoUrl,
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
          <div className="space-y-1.5">
            <Label>Foto (opcional)</Label>
            <WebcamCapture
              existingPreviewUrl={photoPreview}
              onCapture={(blob, url) => {
                if (photoPreview) URL.revokeObjectURL(photoPreview);
                setPhotoBlob(blob);
                setPhotoPreview(url);
                setUploadError(null);
              }}
              onClear={() => {
                if (photoPreview) URL.revokeObjectURL(photoPreview);
                setPhotoBlob(null);
                setPhotoPreview(null);
              }}
            />
            {uploadError ? (
              <p className="text-xs text-[#EA4D8E]">{uploadError}</p>
            ) : null}
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
          {phoneMatches.length > 0 ? (
            <div className="flex gap-2 rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-3 py-2 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-[#F4B73F]" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800">
                  {phoneMatches.length === 1
                    ? `Este telefone ja esta no cadastro de ${phoneMatches[0].full_name}.`
                    : `Este telefone ja aparece em ${phoneMatches.length} cadastros: ${phoneMatches
                        .map((m) => m.full_name)
                        .join(", ")}.`}
                </p>
                <p className="mt-0.5 text-slate-600">
                  Se for a mesma familia, segue normal. Se digitou errado,
                  corrige antes de iniciar.
                </p>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="qr-email">Email (opcional)</Label>
            <Input
              id="qr-email"
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="pai@exemplo.com"
            />
            <p className="text-[11px] text-muted-foreground">
              Usado pra mandar a pesquisa pos-visita por email tambem.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Tempo e valor</Label>
            <div className="grid grid-cols-3 gap-2">
              {pricing.tiers.map((t) => {
                const active = minutes === t.minutes;
                return (
                  <button
                    key={t.minutes}
                    type="button"
                    onClick={() => selectTier(t)}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-2 transition ${
                      active
                        ? "border-[#1E78DC] bg-[#1E78DC]/10"
                        : "border-border bg-card hover:border-[#1E78DC]/40"
                    }`}
                  >
                    <span className="text-sm font-bold">
                      {t.minutes < 60 ? `${t.minutes} min` : `${t.minutes / 60}h`}
                    </span>
                    <span
                      className={`text-lg font-black tabular-nums ${
                        active ? "text-[#1E78DC]" : "text-foreground"
                      }`}
                    >
                      {formatBRL(t.price_cents)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                Outro tempo:
              </span>
              <Input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) =>
                  setMinutes(parseInt(e.target.value || "0", 10))
                }
                className="w-20"
              />
              <span className="text-[11px] text-muted-foreground">minutos</span>
            </div>
            {pricing.overage_note ? (
              <p className="rounded-md bg-[#F4B73F]/15 px-2 py-1 text-[11px] text-slate-700">
                ⏰ {pricing.overage_note}
              </p>
            ) : null}
          </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-amount">Valor (R$)</Label>
              <Input
                id="qr-amount"
                inputMode="decimal"
                value={amountReais}
                readOnly
                placeholder="—"
                className="cursor-not-allowed bg-muted/50"
              />
              <p className="text-[11px] text-muted-foreground">
                Definido pelo tempo escolhido acima.
              </p>
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
