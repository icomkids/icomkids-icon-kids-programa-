import { useState } from "react";
import { CheckCircle2, Mail, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendEmail } from "../lib/resend";

export function EmailTestCard() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Teste iCOM Kids");
  const [body, setBody] = useState(
    "<h2>Ola! 💙</h2><p>Esta e uma mensagem de teste enviada pelo sistema iCOM Kids via Resend.</p>"
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | null
    | { ok: true; message: string }
    | { ok: false; message: string }
  >(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const r = await sendEmail({
        to: to.trim(),
        subject: subject.trim(),
        body_html: body.trim(),
        event_type: "manual_test",
      });
      if (r.ok) {
        setResult({ ok: true, message: "Email enviado." });
      } else {
        setResult({ ok: false, message: r.error ?? "Falha ao enviar." });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-center gap-2">
        <Mail className="size-4 text-[#EA4D8E]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Enviar email de teste
        </h2>
      </header>
      <p className="mt-2 text-xs text-muted-foreground">
        Mande um email de teste para validar a integracao Resend. O remetente
        usa o RESEND_FROM_EMAIL configurado no servidor.
      </p>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="et-to">Destinatario</Label>
          <Input
            id="et-to"
            type="email"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="seu@email.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-subject">Assunto</Label>
          <Input
            id="et-subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-body">Corpo (HTML)</Label>
          <textarea
            id="et-body"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA4D8E]"
          />
        </div>
        <Button
          type="submit"
          disabled={sending}
          className="w-full bg-[#EA4D8E] text-white hover:bg-[#EA4D8E]/90"
        >
          {sending ? "Enviando..." : "Enviar email de teste"}
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
  );
}
