import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileSignature, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/common/logo";
import { SignaturePad } from "@/features/terms/components/signature-pad";
import { termsRepo } from "@/features/terms/lib/terms-repo";
import type { PublicTermView } from "@/features/terms/types";

type Phase =
  | "loading"
  | "ready"
  | "submitting"
  | "thanks"
  | "not_found"
  | "already_done"
  | "error";

export default function TermSignPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<PublicTermView | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [document, setDocument] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("not_found");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const v = await termsRepo.getByToken(token);
        if (cancelled) return;
        if (!v) {
          setPhase("not_found");
          return;
        }
        setView(v);
        if (v.signed_at) {
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
    if (!token || !signature) return;
    setPhase("submitting");
    setError(null);
    try {
      await termsRepo.submitSignature(token, signature, {
        user_agent: navigator.userAgent,
        guardian_document: document.trim() || undefined,
      });
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
          "radial-gradient(circle at 20% 20%, rgba(30,120,220,0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(123,54,191,0.15), transparent 50%)",
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo height={72} />
        </div>

        {phase === "loading" ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Carregando termo...
          </p>
        ) : null}

        {phase === "not_found" ? (
          <NoticeCard
            icon={<XCircle className="size-8 text-[#EA4D8E]" />}
            title="Solicitacao nao encontrada"
            text="O link pode estar quebrado ou ter expirado. Entre em contato com o iCOM Kids."
          />
        ) : null}

        {phase === "already_done" ? (
          <NoticeCard
            icon={<CheckCircle2 className="size-10 text-[#5a8e10]" />}
            title="Voce ja assinou — obrigado!"
            text={`A assinatura de ${
              view?.guardian_name ?? ""
            } esta registrada.`}
          />
        ) : null}

        {phase === "error" ? (
          <NoticeCard
            icon={<XCircle className="size-8 text-[#EA4D8E]" />}
            title="Algo deu errado"
            text={error ?? "Tente novamente em alguns minutos."}
          />
        ) : null}

        {phase === "thanks" ? (
          <NoticeCard
            icon={<CheckCircle2 className="size-10 text-[#5a8e10]" />}
            title="Termo assinado com sucesso!"
            text="Obrigado. Boa visita ao iCOM Kids 💙"
          />
        ) : null}

        {phase === "ready" || phase === "submitting" ? (
          <>
            <header className="mt-6">
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <FileSignature className="size-3.5" /> v
                {view?.template_version}
              </p>
              <h1 className="mt-1 text-center text-2xl font-bold">
                {view?.template_title}
              </h1>
              {view?.guardian_name ? (
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Em nome de <strong>{view.guardian_name}</strong>
                  {view.child_name ? ` (resp. de ${view.child_name})` : ""}
                </p>
              ) : null}
            </header>

            <article className="mt-5 max-h-72 overflow-y-auto rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-line">
              {view?.template_body}
            </article>

            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ts-doc">CPF (opcional)</Label>
                <Input
                  id="ts-doc"
                  inputMode="numeric"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  placeholder="Para identificacao no documento assinado"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assine com o dedo ou o mouse</Label>
                <SignaturePad onChange={setSignature} />
              </div>
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={phase === "submitting" || !signature}
                className="w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
              >
                {phase === "submitting" ? "Enviando..." : "Aceito e assino"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Ao assinar, voce concorda com os termos acima e autoriza o
                iCOM Kids a guardar este documento.
              </p>
            </div>
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
