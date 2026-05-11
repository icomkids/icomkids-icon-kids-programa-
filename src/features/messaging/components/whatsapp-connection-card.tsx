import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Power, RefreshCcw, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  connectInstance,
  disconnectInstance,
  getInstanceStatus,
  type InstanceStatus,
} from "@/features/messaging/lib/uazapi-instance";

const POLL_MS = 3000;

function isQrDataUrl(value: string | null): boolean {
  return Boolean(value && value.startsWith("data:image"));
}

function isQrSvgOrText(value: string | null): boolean {
  return Boolean(value && !value.startsWith("data:image"));
}

export function WhatsAppConnectionCard() {
  const [status, setStatus] = useState<InstanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const s = await getInstanceStatus();
    setStatus(s);
    setLoading(false);
    if (s.connected) stopPolling();
    return s;
  }, [stopPolling]);

  useEffect(() => {
    refresh();
    return stopPolling;
  }, [refresh, stopPolling]);

  const startConnect = async () => {
    setBusy(true);
    try {
      const s = await connectInstance();
      setStatus(s);
      // If we got a QR, start polling for status until it flips to connected.
      if (!s.connected) {
        stopPolling();
        pollRef.current = window.setInterval(() => {
          void refresh();
        }, POLL_MS);
      }
    } finally {
      setBusy(false);
    }
  };

  const doDisconnect = async () => {
    if (!confirm("Desconectar o WhatsApp do parque?")) return;
    setBusy(true);
    try {
      await disconnectInstance();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-44 w-full rounded-xl" />;
  }

  if (status?.error) {
    return (
      <div className="rounded-xl border-2 border-[#EA4D8E] bg-[#EA4D8E]/10 p-5">
        <div className="flex items-start gap-3">
          <XCircle className="size-5 shrink-0 text-[#EA4D8E]" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold text-[#EA4D8E]">Falha ao consultar a uazapi</p>
            <p className="mt-1 text-xs text-muted-foreground">{status.error}</p>
            {status.raw ? (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/5 p-2 text-[10px] text-muted-foreground">
                {JSON.stringify(status.raw, null, 2)}
              </pre>
            ) : null}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Verifique se os secrets <code>UAZAPI_BASE_URL</code> e{" "}
              <code>UAZAPI_TOKEN</code> estao corretos e se a function
              foi re-deployada apos a ultima alteracao do token.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => void refresh()}
            >
              <RefreshCcw className="size-3.5" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="rounded-xl border-2 border-[#A6CD3F] bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#A6CD3F]/15">
            <CheckCircle2 className="size-6 text-[#5a8e10]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              WhatsApp do parque conectado
            </p>
            <p className="mt-1 flex items-center gap-2 text-base font-bold">
              <Smartphone className="size-4" />
              {status.phone ?? "—"}
            </p>
            {status.profile_name ? (
              <p className="text-xs text-muted-foreground">
                {status.profile_name}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void doDisconnect()}
            className="text-[#EA4D8E]"
          >
            <Power className="size-4" />
            Desconectar
          </Button>
        </div>
      </div>
    );
  }

  // Not connected — either show idle "Connect" CTA or QR being scanned.
  const hasQr = Boolean(status?.qr);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[#1E78DC]/10">
          <Smartphone className="size-6 text-[#1E78DC]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            WhatsApp do parque
          </p>
          <p className="mt-1 text-base font-bold">Desconectado</p>
          <p className="text-xs text-muted-foreground">
            Status atual: <code>{status?.state ?? "—"}</code>
          </p>
        </div>
        {!hasQr ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void startConnect()}
            className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          >
            {busy ? "Carregando QR..." : "Conectar WhatsApp"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
          >
            <RefreshCcw className="size-3.5" /> Atualizar
          </Button>
        )}
      </div>

      {hasQr ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[auto_1fr]">
          <div className="flex justify-center rounded-xl border border-border bg-white p-4">
            {isQrDataUrl(status!.qr) ? (
              <img
                src={status!.qr!}
                alt="QR Code para conectar WhatsApp"
                width={224}
                height={224}
                className="size-56"
              />
            ) : isQrSvgOrText(status!.qr) ? (
              // uazapi sometimes returns the QR string itself — fall back to an
              // external rendering service via api.qrserver.com.
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=224x224&data=${encodeURIComponent(
                  status!.qr!
                )}`}
                alt="QR Code para conectar WhatsApp"
                width={224}
                height={224}
                className="size-56"
              />
            ) : null}
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-bold">Como conectar (1 minuto):</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                Abra o <strong>WhatsApp</strong> no celular do parque
              </li>
              <li>
                Toque nos <strong>3 pontinhos</strong> {">"}{" "}
                <strong>Aparelhos conectados</strong>
              </li>
              <li>
                Toque em <strong>Conectar um aparelho</strong>
              </li>
              <li>Aponte a camera para este QR Code aqui</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              A pagina vai detectar a conexao automaticamente em alguns
              segundos.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
