import { useState } from "react";
import { CheckCircle2, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/common/logo";
import { useFeedbackFormConfig } from "@/features/nps/hooks/use-form-config";
import { npsRepo } from "@/features/nps/lib/nps-repo";
import type {
  QIntendsTrade,
  QLastCarPurchase,
  QOffersOptin,
} from "@/features/nps/types";

type Phase = "ready" | "submitting" | "thanks" | "error";

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

const LAST_CAR_OPTIONS: RadioOption<QLastCarPurchase>[] = [
  { value: "lt_1y", label: "Menos de 1 ano" },
  { value: "1_3y", label: "1 a 3 anos" },
  { value: "gt_3y", label: "Mais de 3 anos" },
  { value: "no_car", label: "Nao tenho carro" },
];

const INTENDS_TRADE_OPTIONS: RadioOption<QIntendsTrade>[] = [
  { value: "yes", label: "Sim" },
  { value: "maybe", label: "Talvez" },
  { value: "no", label: "Nao" },
];

const OFFERS_OPTIN_OPTIONS: RadioOption<QOffersOptin>[] = [
  { value: "whatsapp", label: "Sim, no WhatsApp" },
  { value: "email", label: "Sim, no Email" },
  { value: "no", label: "Nao, obrigado" },
];

export default function PublicFeedbackPage() {
  const { value: formConfig } = useFeedbackFormConfig();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [child, setChild] = useState("");
  const [stars, setStars] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [qLastCar, setQLastCar] = useState<QLastCarPurchase | null>(null);
  const [qIntends, setQIntends] = useState<QIntendsTrade | null>(null);
  const [qOptin, setQOptin] = useState<QOffersOptin | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || stars == null) return;
    setPhase("submitting");
    setError(null);
    try {
      await npsRepo.submitPublic({
        guardian_name: name.trim(),
        guardian_phone: phone.trim() || undefined,
        guardian_email: email.trim() || undefined,
        child_name: child.trim() || undefined,
        stars,
        comment: comment.trim() || undefined,
        q_last_car_purchase: qLastCar ?? undefined,
        q_intends_trade: qIntends ?? undefined,
        q_offers_optin: qOptin ?? undefined,
      });
      setPhase("thanks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar.");
      setPhase("error");
    }
  };

  return (
    <div
      className="flex min-h-svh items-start justify-center px-4 py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(30,120,220,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(234,77,142,0.18), transparent 50%), radial-gradient(circle at 50% 100%, rgba(244,183,63,0.18), transparent 50%)",
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo height={80} />
        </div>

        {phase === "thanks" ? (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="size-10 text-[#5a8e10]" />
            <p className="text-xl font-bold">Obrigado pela avaliacao!</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {stars != null && stars >= 4
                ? "Que bom que voces curtiram! Adoramos receber a familia de novo."
                : "Vamos olhar com carinho o que pode melhorar. Obrigado pela honestidade."}
            </p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <XCircle className="size-8 text-[#EA4D8E]" />
            <p className="text-xl font-bold">Algo deu errado</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {error ?? "Tente novamente."}
            </p>
            <Button onClick={() => setPhase("ready")} variant="outline">
              Tentar de novo
            </Button>
          </div>
        ) : null}

        {phase === "ready" || phase === "submitting" ? (
          <form onSubmit={submit}>
            <h1 className="mt-6 text-center text-2xl font-bold">
              Como foi sua experiencia no iCOM Kids?
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Sua opiniao ajuda a gente a melhorar.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-name">Seu nome *</Label>
                <Input
                  id="pf-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-child">Nome da crianca (opcional)</Label>
                <Input
                  id="pf-child"
                  value={child}
                  onChange={(e) => setChild(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-phone">WhatsApp</Label>
                <Input
                  id="pf-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 9..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-email">Email</Label>
                <Input
                  id="pf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Sua nota de 1 a 5 *
              </p>
              <div
                className="mt-3 flex items-center justify-center gap-2"
                onMouseLeave={() => setHoveredStar(null)}
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hoveredStar ?? stars ?? 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={phase === "submitting"}
                      onClick={() => setStars(n)}
                      onMouseEnter={() => setHoveredStar(n)}
                      className="transition"
                      aria-label={`${n} estrelas`}
                    >
                      <Star
                        className="size-10 transition"
                        style={{
                          color: active ? "#F4B73F" : "#cbd5e1",
                          fill: active ? "#F4B73F" : "transparent",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {stars != null ? (
              <>
                <div className="mt-6 space-y-1.5">
                  <Label htmlFor="pf-comment">
                    Algo a nos contar? (opcional)
                  </Label>
                  <textarea
                    id="pf-comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
                  />
                </div>

                <div className="mt-8 rounded-xl border-2 border-dashed border-[#7B36BF]/40 bg-[#7B36BF]/5 p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#7B36BF]">
                    iCOM Motos · Pra te conhecer melhor
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    Tres perguntinhas rapidas (todas opcionais).
                  </p>

                  <RadioGroup
                    label={formConfig.q_last_car_label}
                    options={LAST_CAR_OPTIONS}
                    value={qLastCar}
                    onChange={setQLastCar}
                  />
                  <RadioGroup
                    label={formConfig.q_intends_label}
                    options={INTENDS_TRADE_OPTIONS}
                    value={qIntends}
                    onChange={setQIntends}
                  />
                  <RadioGroup
                    label={formConfig.q_offers_label}
                    options={OFFERS_OPTIN_OPTIONS}
                    value={qOptin}
                    onChange={setQOptin}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={phase === "submitting"}
                  className="mt-6 w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
                >
                  {phase === "submitting" ? "Enviando..." : "Enviar avaliacao"}
                </Button>
              </>
            ) : (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Escolha de 1 a 5 estrelas pra continuar.
              </p>
            )}
          </form>
        ) : null}
      </div>
    </div>
  );
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: RadioOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm font-bold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-[#7B36BF] bg-[#7B36BF] text-white"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
