import { useState } from "react";
import {
  CheckCircle2,
  MessageSquare,
  Send,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WhatsAppConnectionCard } from "@/features/messaging/components/whatsapp-connection-card";
import { useMessagesLog } from "@/features/messaging/hooks/use-messages-log";
import { sendWhatsApp } from "@/features/messaging/lib/uazapi";
import { formatTimeOfDay } from "@/lib/format";

export default function SettingsPage() {
  const { messages, loading } = useMessagesLog(50);
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState(
    "Mensagem de teste do iCOM Kids. Se voce recebeu isso, a integracao esta funcionando 🎉"
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | null
    | { ok: true; message: string }
    | { ok: false; message: string }
  >(null);

  const submitTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const r = await sendWhatsApp({
        phone: phone.trim(),
        body: body.trim(),
        event_type: "manual_test",
      });
      if (r.ok) {
        setResult({ ok: true, message: "Mensagem enviada." });
      } else {
        setResult({
          ok: false,
          message: r.error ?? "Falha ao enviar.",
        });
      }
    } finally {
      setSending(false);
    }
  };

  const stats = {
    total: messages.length,
    sent: messages.filter((m) => m.status === "sent").length,
    failed: messages.filter((m) => m.status === "failed").length,
  };

  return (
    <div>
      <PageHeader
        title="Configuracoes"
        description="WhatsApp / uazapi e log de mensagens enviadas pelo sistema."
      />

      <div className="space-y-6 p-6">
        <WhatsAppConnectionCard />

        <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Mensagens
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Total" value={stats.total.toString()} color="#1E78DC" />
              <Stat
                label="Entregues"
                value={stats.sent.toString()}
                color="#A6CD3F"
              />
              <Stat
                label="Falhas"
                value={stats.failed.toString()}
                color="#EA4D8E"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <header className="flex items-center gap-2">
              <Send className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Enviar teste
              </h2>
            </header>
            <p className="mt-2 text-xs text-muted-foreground">
              Mande uma mensagem para o seu proprio numero para validar a
              conexao.
            </p>
            <form className="mt-3 space-y-3" onSubmit={submitTest}>
              <div className="space-y-1.5">
                <Label htmlFor="st-phone">Numero (com DDD)</Label>
                <Input
                  id="st-phone"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 91234-5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-body">Mensagem</Label>
                <textarea
                  id="st-body"
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
                />
              </div>
              <Button
                type="submit"
                disabled={sending}
                className="w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
              >
                {sending ? "Enviando..." : "Enviar mensagem de teste"}
              </Button>
            </form>
            {result ? (
              <div
                className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  result.ok
                    ? "border-[#A6CD3F] bg-[#A6CD3F]/10"
                    : "border-[#EA4D8E] bg-[#EA4D8E]/10 text-[#EA4D8E]"
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#5a8e10]" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0" />
                )}
                <span>{result.message}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Log de mensagens
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              ultimas {messages.length}
            </p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
              <MessageSquare className="size-6" />
              <p>Nenhuma mensagem enviada ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {formatTimeOfDay(m.created_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        +{m.phone}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                          {m.event_type ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                        {m.body}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={m.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    queued: { label: "Fila", bg: "#F4B73F", fg: "#0f172a" },
    sent: { label: "Entregue", bg: "#A6CD3F", fg: "#0f172a" },
    failed: { label: "Falhou", bg: "#EA4D8E", fg: "#ffffff" },
  };
  const s = map[status] ?? { label: status, bg: "#94a3b8", fg: "#ffffff" };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
