import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Heart, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/common/logo";
import { npsRepo } from "@/features/nps/lib/nps-repo";
import type {
  PublicNpsView,
  QIntendsTrade,
  QLastCarPurchase,
  QOffersOptin,
} from "@/features/nps/types";

type Phase =
  | "loading"
  | "ready"
  | "submitting"
  | "thanks"
  | "not_found"
  | "already_done"
  | "error";

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

export default function NpsResponsePage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [survey, setSurvey] = useState<PublicNpsView | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [qLastCar, setQLastCar] = useState<QLastCarPurchase | null>(null);
  const [qIntends, setQIntends] = useState<QIntendsTrade | null>(null);
  const [qOptin, setQOptin] = useState<QOffersOptin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("not_found");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await npsRepo.getByToken(token);
        if (cancelled) return;
        if (!s) {
          setPhase("not_found");
          return;
        }
        setSurvey(s);
        if (s.guardian_email) setEmail(s.guardian_email);
        if (s.responded_at) {
          setPhase("already_done");
          return;
        }
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erro");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (!token || stars == null) return;
    setPhase("submitting");
    setError(null);
    try {
      await npsRepo.submitFeedback(token, {
        stars,
        comment: comment.trim() || undefined,
        guardian_email: email.trim() || undefined,
        q_last_car_purchase: qLastCar ?? undefined,
        q_intends_trade: qIntends ?? undefined,
        q_offers_optin: qOptin ?? undefined,
      });
      setPhase("thanks");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
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

        {phase === "loading" ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Carregando pesquisa...
          </p>
        ) : null}

        {phase === "not_found" ? (
          <NoticeCard
            icon={<XCircle className="size-8 text-[#EA4D8E]" />}
            title="Pesquisa nao encontrada"
            text="O link pode estar quebrado ou ja ter expirado. Entre em contato com o iCOM Kids se precisar."
          />
        ) : null}

        {phase === "already_done" ? (
          <NoticeCard
            icon={<Heart className="size-8 text-[#EA4D8E]" />}
            title="Voce ja respondeu — obrigado!"
            text="Sua avaliacao ja foi registrada. A gente agradece."
          />
        ) : null}

        {phase === "error" ? (
          <NoticeCard
            icon={<XCircle className="size-8 text-[#EA4D8E]" />}
            title="Algo deu errado"
            text={error ?? "Tente abrir o link novamente."}
          />
        ) : null}

        {phase === "thanks" ? (
          <NoticeCard
            icon={<CheckCircle2 className="size-10 text-[#5a8e10]" />}
            title="Obrigado pela avaliacao!"
            text={
              stars != null && stars >= 4
                ? "Que bom que voces curtiram! Adoramos receber a familia de novo."
                : stars != null && stars >= 3
                ? "Vamos seguir trabalhando pra ficar ainda melhor."
                : "Vamos olhar com carinho o que pode melhorar. Obrigado pela honestidade."
            }
          />
        ) : null}

        {phase === "ready" || phase === "submitting" ? (
          <>
            <h1 className="mt-6 text-center text-2xl font-bold">
              Como foi a experiencia no iCOM Kids?
            </h1>
            {survey?.child_name ? (
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Avaliando a visita de <strong>{survey.child_name}</strong>
              </p>
            ) : null}

            {/* Pergunta 1 — estrelas */}
            <div className="mt-6">
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Sua nota de 1 a 5
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
                {/* Pergunta 2 — comentario livre */}
                <div className="mt-6 space-y-1.5">
                  <label
                    htmlFor="fb-comment"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Algo a nos contar? (opcional)
                  </label>
                  <textarea
                    id="fb-comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="O que mais gostou, o que poderia melhorar..."
                    className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
                  />
                </div>

                {/* Bloco iCOM Motos */}
                <div className="mt-8 rounded-xl border-2 border-dashed border-[#7B36BF]/40 bg-[#7B36BF]/5 p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#7B36BF]">
                    iCOM Motos · Pra te conhecer melhor
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    Tres perguntinhas rapidas. Se nao quiser, e so deixar em
                    branco e enviar.
                  </p>

                  <RadioGroup
                    label="Ha quanto tempo voce comprou seu carro atual?"
                    options={LAST_CAR_OPTIONS}
                    value={qLastCar}
                    onChange={setQLastCar}
                  />

                  <RadioGroup
                    label="Pretende trocar de carro nos proximos 12 meses?"
                    options={INTENDS_TRADE_OPTIONS}
                    value={qIntends}
                    onChange={setQIntends}
                  />

                  <RadioGroup
                    label="Posso te mandar ofertas exclusivas da iCOM Motos sobre carros pra familia?"
                    options={OFFERS_OPTIN_OPTIONS}
                    value={qOptin}
                    onChange={setQOptin}
                  />

                  {qOptin && qOptin !== "no" ? (
                    <div className="mt-3 space-y-1.5">
                      <label
                        htmlFor="fb-email"
                        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                      >
                        {qOptin === "email"
                          ? "Confirma seu email"
                          : "Email (opcional, vai junto com WhatsApp)"}
                      </label>
                      <Input
                        id="fb-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                      />
                    </div>
                  ) : null}
                </div>

                <Button
                  type="button"
                  onClick={() => void submit()}
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
          </>
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

function NoticeCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 text-center">
      {icon}
      <p className="text-xl font-bold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
