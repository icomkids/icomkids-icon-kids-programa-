import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ScanLine, ShieldCheck, X } from "lucide-react";
import { Html5Qrcode, type Html5QrcodeResult } from "html5-qrcode";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sessionsRepo } from "@/features/crm/lib/sessions-repo";
import { remainingSeconds } from "@/features/crm/lib/session-timing";
import { formatCountdown, formatTimeOfDay } from "@/lib/format";
import type { ActiveSession } from "@/features/crm/types";

type Phase = "idle" | "scanning" | "found" | "released" | "not_found";

const SCAN_REGION_ID = "icomkids-qr-reader";

export default function CheckoutPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState("");
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Stop the scanner when the component unmounts.
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined);
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
  };

  const lookupToken = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setError(null);
    setSubmitting(true);
    try {
      const found = await sessionsRepo.findByQrToken(trimmed);
      await stopScanner();
      if (!found) {
        setSession(null);
        setPhase("not_found");
      } else {
        setSession(found);
        setPhase("found");
      }
      setToken(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar sessao");
    } finally {
      setSubmitting(false);
    }
  };

  const startScanner = async () => {
    setError(null);
    setPhase("scanning");
    setSession(null);
    setToken("");
    try {
      // Wait one tick so the #SCAN_REGION_ID div is mounted.
      await new Promise((r) => setTimeout(r, 50));
      const qr = new Html5Qrcode(SCAN_REGION_ID);
      scannerRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded: string, _result: Html5QrcodeResult) => {
          await lookupToken(decoded);
        },
        () => undefined
      );
    } catch (e) {
      setPhase("idle");
      setError(
        e instanceof Error
          ? e.message
          : "Nao foi possivel acessar a camera. Use o campo manual abaixo."
      );
    }
  };

  const release = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      await sessionsRepo.end(session.id);
      setPhase("released");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao liberar a crianca");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setPhase("idle");
    setSession(null);
    setToken("");
    setError(null);
    void stopScanner();
  };

  return (
    <div>
      <PageHeader
        title="QR Check-out"
        description="Valide o QR Code do responsavel para liberar a crianca."
      />

      <div className="space-y-6 p-6">
        {error ? (
          <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-3 text-sm text-[#EA4D8E]">
            {error}
          </div>
        ) : null}

        {phase === "idle" || phase === "scanning" || phase === "not_found" ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Escanear com a camera
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Use a camera do dispositivo para ler o QR Code do responsavel.
              </p>

              <div className="mt-4">
                {phase === "scanning" ? (
                  <>
                    <div
                      id={SCAN_REGION_ID}
                      className="overflow-hidden rounded-xl border border-border"
                    />
                    <Button
                      variant="ghost"
                      className="mt-3 w-full text-xs"
                      onClick={() => {
                        void stopScanner();
                        setPhase("idle");
                      }}
                    >
                      <X className="size-3.5" /> Parar
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void startScanner()}
                    className="w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
                  >
                    <Camera className="size-4" /> Abrir camera
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Inserir codigo manualmente
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Caso a camera nao funcione, cole o codigo do QR Code recebido.
              </p>
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void lookupToken(token);
                }}
              >
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="ck-token" className="sr-only">
                    Codigo
                  </Label>
                  <Input
                    id="ck-token"
                    placeholder="Cole o codigo aqui"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
                  disabled={submitting}
                >
                  <ScanLine className="size-4" /> Buscar
                </Button>
              </form>
              {phase === "not_found" ? (
                <div className="mt-3 rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-3 py-2 text-xs">
                  <strong>Nao encontrado.</strong> O codigo nao esta vinculado a
                  nenhuma sessao ativa. Pode ja ter sido liberado.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {phase === "found" && session ? (
          <section className="rounded-xl border-2 border-[#A6CD3F] bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-[#A6CD3F]/15 text-[#0f172a]">
                <ShieldCheck className="size-8" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Sessao validada
                </p>
                <p className="mt-1 text-2xl font-black">
                  {session.child.full_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Resp.: {session.guardian?.full_name ?? "—"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-md bg-muted px-2 py-1 tabular-nums">
                    Inicio: {formatTimeOfDay(session.started_at)}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1 tabular-nums">
                    Tempo restante: {formatCountdown(remainingSeconds(session))}
                  </span>
                  {session.partner_name ? (
                    <span className="rounded-md bg-[#1E78DC]/10 px-2 py-1 text-[#1E78DC]">
                      Parceiro: {session.partner_name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={reset} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                onClick={() => void release()}
                disabled={submitting}
                className="bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90"
              >
                <CheckCircle2 className="size-4" />
                {submitting ? "Liberando..." : "Confirmar saida e liberar"}
              </Button>
            </div>
          </section>
        ) : null}

        {phase === "released" && session ? (
          <section className="rounded-xl border-2 border-[#1E78DC] bg-card p-6 text-center">
            <ShieldCheck className="mx-auto size-12 text-[#1E78DC]" />
            <p className="mt-3 text-2xl font-black">{session.child.full_name}</p>
            <p className="text-sm text-muted-foreground">
              Liberado(a) com sucesso para {session.guardian?.full_name ?? "responsavel"}.
            </p>
            <Button onClick={reset} className="mt-4">
              Novo check-out
            </Button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
