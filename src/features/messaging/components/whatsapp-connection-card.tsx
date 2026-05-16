import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Power,
  RefreshCcw,
  Smartphone,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [disconnectOk, setDisconnectOk] = useState(false);
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
    setBusy(true);
    setDisconnectError(null);
    setDisconnectOk(false);
    try {
      const r = await disconnectInstance();
      if (r.error) {
        setDisconnectError(r.error);
        return;
      }
      // Da um tempinho pra uazapi processar e dai re-busca status.
      await new Promise((res) => setTimeout(res, 800));
      const s = await refresh();
      if (s.connected) {
        // Em algumas builds da uazapi o logout demora pra refletir.
        // Tenta de novo apos mais 2s.
        await new Promise((res) => setTimeout(res, 2000));
        const s2 = await refresh();
        if (s2.connected) {
          setDisconnectError(
            "A uazapi confirmou o logout mas o numero ainda aparece como conectado. Aguarde alguns segundos e clique em 'Atualizar status'. Se persistir, tente 'Forcar limpeza' abaixo."
          );
          return;
        }
      }
      setDisconnectOk(true);
      // Fecha o dialog automaticamente em 1.5s.
      setTimeout(() => {
        setShowDisconnect(false);
        setDisconnectOk(false);
      }, 1500);
    } catch (e) {
      setDisconnectError(
        e instanceof Error ? e.message : "Erro desconhecido ao desconectar."
      );
    } finally {
      setBusy(false);
    }
  };

  const forceDisconnect = async () => {
    // Tenta desconectar 3x seguidas pra forcar uazapi a derrubar a sessao.
    setBusy(true);
    setDisconnectError(null);
    try {
      for (let i = 0; i < 3; i++) {
        await disconnectInstance();
        await new Promise((res) => setTimeout(res, 600));
      }
      const s = await refresh();
      if (!s.connected) {
        setDisconnectOk(true);
        setTimeout(() => {
          setShowDisconnect(false);
          setDisconnectOk(false);
        }, 1500);
      } else {
        setDisconnectError(
          "Mesmo apos forcar 3x, a uazapi continua reportando conectado. Isso pode indicar problema na conta da uazapi. Acesse https://free.uazapi.com e faca logout manualmente."
        );
      }
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

  return (
    <>
      {status?.connected ? (
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
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void refresh()}
                title="Atualizar status"
              >
                <RefreshCcw className="size-3.5" />
                Atualizar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDisconnectError(null);
                  setDisconnectOk(false);
                  setShowDisconnect(true);
                }}
                className="text-[#EA4D8E] hover:bg-[#EA4D8E]/10"
              >
                <Power className="size-4" />
                Desconectar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Not connected — either show idle "Connect" CTA or QR being scanned.
        <NotConnectedView
          status={status}
          busy={busy}
          onConnect={() => void startConnect()}
          onRefresh={() => void refresh()}
        />
      )}

      {/* Dialog de desconectar */}
      <Dialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-[#F39230]" />
              Desconectar o WhatsApp?
            </DialogTitle>
            <DialogDescription>
              O numero{" "}
              <strong className="text-foreground">
                {status?.phone ?? "—"}
              </strong>{" "}
              vai ser desconectado da plataforma. Mensagens automaticas
              (welcome, NPS, lembretes) <strong>nao serao enviadas</strong> ate
              voce conectar um numero de novo.
            </DialogDescription>
          </DialogHeader>

          {disconnectOk ? (
            <div className="rounded-md border border-[#A6CD3F] bg-[#A6CD3F]/15 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-[#5a8e10]">
                <CheckCircle2 className="size-4" />
                WhatsApp desconectado com sucesso!
              </div>
            </div>
          ) : null}

          {disconnectError ? (
            <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-3 py-2 text-xs text-slate-700">
              <div className="mb-1 flex items-center gap-1.5 font-bold text-[#EA4D8E]">
                <XCircle className="size-3.5" />
                Erro
              </div>
              <p>{disconnectError}</p>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDisconnect(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            {disconnectError ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void forceDisconnect()}
                disabled={busy}
                className="border-[#F39230] text-[#F39230] hover:bg-[#F39230]/10"
              >
                <AlertTriangle className="size-3.5" />
                Forcar limpeza (3x)
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => void doDisconnect()}
              disabled={busy || disconnectOk}
              className="bg-[#EA4D8E] text-white hover:bg-[#EA4D8E]/90"
            >
              <Power className="size-4" />
              {busy ? "Desconectando..." : "Confirmar desconexao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotConnectedView({
  status,
  busy,
  onConnect,
  onRefresh,
}: {
  status: InstanceStatus | null;
  busy: boolean;
  onConnect: () => void;
  onRefresh: () => void;
}) {
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
            onClick={onConnect}
            className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          >
            {busy ? "Carregando QR..." : "Conectar WhatsApp"}
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
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
