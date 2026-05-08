import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Heart, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { npsRepo } from "@/features/nps/lib/nps-repo";
import type { PublicNpsView } from "@/features/nps/types";

type Phase = "loading" | "ready" | "submitting" | "thanks" | "not_found" | "already_done" | "error";

const SCORE_COLORS: string[] = [
  "#EA4D8E",
  "#EA4D8E",
  "#EA4D8E",
  "#EA4D8E",
  "#EA4D8E",
  "#EA4D8E",
  "#EA4D8E", // 0-6 detractor
  "#F4B73F",
  "#F4B73F", // 7-8 passive
  "#A6CD3F",
  "#A6CD3F", // 9-10 promoter
];

export default function NpsResponsePage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [survey, setSurvey] = useState<PublicNpsView | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
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
    if (!token || score == null) return;
    setPhase("submitting");
    setError(null);
    try {
      await npsRepo.submitResponse(token, score, comment.trim() || undefined);
      setPhase("thanks");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setPhase("error");
    }
  };

  return (
    <div
      className="flex min-h-svh items-center justify-center px-4 py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(30,120,220,0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(234,77,142,0.15), transparent 50%), radial-gradient(circle at 50% 100%, rgba(244,183,63,0.15), transparent 50%)",
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-xl">
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
            text="Sua avaliacao foi registrada. A gente agradece."
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
              score != null && score >= 9
                ? "Que bom que voces curtiram! Adoramos receber a familia de novo."
                : score != null && score >= 7
                ? "Vamos seguir trabalhando pra ficar ainda melhor."
                : "Vamos olhar com carinho o que pode ser melhor. Obrigado pela honestidade."
            }
          />
        ) : null}

        {phase === "ready" || phase === "submitting" ? (
          <>
            <h1 className="mt-6 text-center text-2xl font-bold">
              Como foi a experiencia?
            </h1>
            {survey?.child_name ? (
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Avaliando a visita de <strong>{survey.child_name}</strong>
              </p>
            ) : null}
            <p className="mt-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              De 0 a 10, quanto recomendaria pra um amigo?
            </p>

            <div className="mt-3 grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }).map((_, n) => (
                <button
                  key={n}
                  type="button"
                  disabled={phase === "submitting"}
                  onClick={() => setScore(n)}
                  className={`flex aspect-square items-center justify-center rounded-md border text-sm font-bold transition ${
                    score === n
                      ? "border-transparent text-white shadow-md"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                  style={
                    score === n ? { background: SCORE_COLORS[n] } : undefined
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between px-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Nada provavel</span>
              <span>Muito provavel</span>
            </div>

            {score != null ? (
              <div className="mt-5 space-y-2">
                <label
                  htmlFor="nps-comment"
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Quer deixar um comentario? (opcional)
                </label>
                <textarea
                  id="nps-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte como foi a experiencia, o que mais gostou, o que daria pra melhorar..."
                  className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
                />
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={phase === "submitting"}
                  className="w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
                >
                  {phase === "submitting" ? "Enviando..." : "Enviar avaliacao"}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
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
