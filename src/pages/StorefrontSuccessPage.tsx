import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { salesRepo } from "@/features/sales/lib/sales-repo";
import { formatBRL } from "@/lib/format";
import type { PublicOrderView } from "@/features/sales/types";

const POLL_MS = 3000;

export default function StorefrontSuccessPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [order, setOrder] = useState<PublicOrderView | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "not_found">("loading");

  useEffect(() => {
    if (!token) {
      setPhase("not_found");
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    const refresh = async () => {
      try {
        const o = await salesRepo.getOrderByToken(token);
        if (cancelled) return;
        if (!o) {
          setPhase("not_found");
          return;
        }
        setOrder(o);
        setPhase("ready");
        // Webhook pode demorar alguns segundos para marcar como paid;
        // mantemos o polling enquanto estiver pending.
        if (o.status === "pending") {
          timer = window.setTimeout(refresh, POLL_MS);
        }
      } catch {
        if (!cancelled) setPhase("not_found");
      }
    };
    refresh();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [token]);

  return (
    <div
      className="flex min-h-svh items-center justify-center px-4 py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(30,120,220,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(166,205,63,0.18), transparent 50%)",
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo height={80} />
        </div>

        {phase === "loading" ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Confirmando pagamento...
          </p>
        ) : null}

        {phase === "not_found" ? (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <XCircle className="size-8 text-[#EA4D8E]" />
            <p className="text-xl font-bold">Pedido nao encontrado</p>
            <p className="max-w-md text-sm text-muted-foreground">
              O link pode estar quebrado. Verifique o email ou entre em
              contato pelo WhatsApp.
            </p>
          </div>
        ) : null}

        {phase === "ready" && order ? (
          <>
            {order.status === "paid" ? (
              <div className="mt-6 text-center">
                <CheckCircle2 className="mx-auto size-10 text-[#5a8e10]" />
                <p className="mt-3 text-2xl font-black">
                  Pagamento confirmado!
                </p>
                <p className="text-sm text-muted-foreground">
                  Apresente este QR Code na entrada do parque.
                </p>
                <div className="mt-5 flex justify-center rounded-2xl bg-white p-4">
                  <QRCodeSVG
                    value={token!}
                    size={224}
                    level="M"
                    fgColor="#1E78DC"
                    bgColor="#ffffff"
                  />
                </div>
                <p className="mt-3 font-mono text-[10px] text-muted-foreground break-all">
                  {token}
                </p>
              </div>
            ) : (
              <div className="mt-6 text-center">
                <Clock3 className="mx-auto size-10 text-[#F4B73F]" />
                <p className="mt-3 text-xl font-bold">
                  Aguardando confirmacao de pagamento
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Em alguns segundos o sistema atualiza. Pode deixar essa
                  pagina aberta.
                </p>
              </div>
            )}

            <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-background text-sm">
              <li className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pacote
                </span>
                <span className="font-semibold">{order.offer_name}</span>
              </li>
              {order.offer_duration_minutes ? (
                <li className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Duracao
                  </span>
                  <span className="tabular-nums">
                    {order.offer_duration_minutes} minutos
                  </span>
                </li>
              ) : null}
              <li className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Responsavel
                </span>
                <span>{order.guardian_name}</span>
              </li>
              {order.child_name ? (
                <li className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Crianca
                  </span>
                  <span>{order.child_name}</span>
                </li>
              ) : null}
              <li className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Valor
                </span>
                <span className="font-bold tabular-nums">
                  {formatBRL(order.amount_cents)}
                </span>
              </li>
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
