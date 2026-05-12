import { useEffect, useState } from "react";
import {
  Copy,
  FileSignature,
  MessageCircle,
  Plus,
  Save,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useTerms } from "@/features/terms/hooks/use-terms";
import { sendWhatsApp } from "@/features/messaging/lib/uazapi";
import { formatTimeOfDay } from "@/lib/format";
import type {
  NewSignatureRequest,
  TermSignature,
} from "@/features/terms/types";

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function buildSignUrl(token: string): string {
  return `${window.location.origin}/termo/sign/${token}`;
}

export default function TermsPage() {
  const {
    template,
    signatures,
    loading,
    saveTemplate,
    createRequest,
  } = useTerms();
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setEditTitle(template.title);
      setEditBody(template.body);
    }
  }, [template?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    template !== null &&
    (editTitle !== template.title || editBody !== template.body);

  const handleSave = async () => {
    if (!editTitle.trim() || !editBody.trim()) return;
    setSaving(true);
    try {
      await saveTemplate({ title: editTitle.trim(), body: editBody.trim() });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  const totals = {
    signed: signatures.filter((s) => s.signed_at != null).length,
    pending: signatures.filter((s) => s.signed_at == null).length,
  };

  return (
    <div>
      <PageHeader
        title="Termo de Responsabilidade"
        description="Edite o texto e gere links unicos para os pais assinarem digitalmente."
        actions={<NewRequestDialog onSubmit={createRequest} />}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Assinados" value={totals.signed.toString()} color="#A6CD3F" />
          <Kpi label="Pendentes" value={totals.pending.toString()} color="#F4B73F" />
          <Kpi
            label="Versao do termo"
            value={template ? `v${template.version}` : "—"}
            color="#7B36BF"
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Texto do termo (versao ativa)
            </h2>
            {savedAt ? (
              <p className="text-[11px] text-[#A6CD3F]">
                Salvo {formatTimeOfDay(savedAt.toISOString())}
              </p>
            ) : null}
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-3 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="tt-title">Titulo</Label>
                <Input
                  id="tt-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tt-body">Texto</Label>
                <textarea
                  id="tt-body"
                  rows={12}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E78DC]"
                />
                <p className="text-[11px] text-muted-foreground">
                  Salvar gera uma nova versao (atual:{" "}
                  v{template?.version ?? "—"}). Versoes antigas continuam
                  vinculadas as assinaturas ja feitas.
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!dirty || saving}
                  onClick={() => void handleSave()}
                  className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
                >
                  <Save className="size-4" />
                  {saving ? "Salvando..." : "Salvar nova versao"}
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <FileSignature className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Assinaturas
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">{signatures.length}</p>
          </header>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : signatures.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <FileSignature className="size-8 text-muted-foreground" />
              <p className="text-base font-semibold">
                Nenhuma assinatura ainda
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Use <strong>Nova solicitacao</strong> no topo para gerar o
                primeiro link de assinatura.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsavel</TableHead>
                    <TableHead>Crianca</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Assinado em</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signatures.map((s) => (
                    <SignatureRow key={s.id} signature={s} />
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

function SignatureRow({ signature }: { signature: TermSignature }) {
  const [open, setOpen] = useState(false);
  const signed = signature.signed_at != null;
  const url = buildSignUrl(signature.token);

  return (
    <TableRow>
      <TableCell>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            background: signed ? "#A6CD3F" : "#F4B73F",
            color: "#0f172a",
          }}
        >
          {signed ? "Assinado" : "Pendente"}
        </span>
      </TableCell>
      <TableCell className="font-medium">{signature.guardian_name}</TableCell>
      <TableCell className="text-muted-foreground">
        {signature.child_name ?? "—"}
      </TableCell>
      <TableCell className="text-xs tabular-nums text-muted-foreground">
        {formatDateBR(signature.created_at)}
      </TableCell>
      <TableCell className="text-xs tabular-nums">
        {signature.signed_at ? formatDateBR(signature.signed_at) : "—"}
      </TableCell>
      <TableCell className="text-right">
        {signed ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-xs">
                Ver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{signature.guardian_name}</DialogTitle>
                <DialogDescription>
                  Assinado em {formatDateBR(signature.signed_at!)} ·{" "}
                  {signature.child_name ?? "sem crianca"}
                </DialogDescription>
              </DialogHeader>
              {signature.signature_data_url?.startsWith("data:image") ? (
                <div className="rounded-xl border border-border bg-white p-3">
                  <img
                    src={signature.signature_data_url}
                    alt="Assinatura"
                    className="mx-auto max-h-48"
                  />
                </div>
              ) : signature.signature_data_url === "checkbox:accepted" ? (
                <div className="rounded-xl border-2 border-[#1E78DC] bg-[#1E78DC]/10 p-4 text-center">
                  <p className="text-sm font-bold text-[#1E78DC]">
                    ✓ Aceito via checkbox
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O responsavel marcou "Li e aceito os termos" na pagina
                    publica.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem dados da assinatura.
                </p>
              )}
            </DialogContent>
          </Dialog>
        ) : (
          <PendingActions signature={signature} url={url} />
        )}
      </TableCell>
    </TableRow>
  );
}

function PendingActions({
  signature,
  url,
}: {
  signature: TermSignature;
  url: string;
}) {
  const [sent, setSent] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
  };

  const sendViaWhatsApp = async () => {
    if (!signature.guardian_phone) return;
    const r = await sendWhatsApp({
      phone: signature.guardian_phone,
      template_key: "term_sign_link",
      variables: {
        nome: signature.guardian_name,
        link: url,
      },
      event_type: "term_sign_link",
      context: { signature_id: signature.id },
    });
    if (r.ok) setSent(true);
  };

  return (
    <div className="flex justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="text-xs"
        onClick={() => void copy()}
        title={url}
      >
        <Copy className="size-3.5" /> Link
      </Button>
      {signature.guardian_phone ? (
        <Button
          size="sm"
          className="bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90 text-xs"
          onClick={() => void sendViaWhatsApp()}
        >
          <MessageCircle className="size-3.5" />
          {sent ? "Enviado" : "Enviar"}
        </Button>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function NewRequestDialog({
  onSubmit,
}: {
  onSubmit: (input: NewSignatureRequest) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [child, setChild] = useState("");

  const reset = () => {
    setName("");
    setPhone("");
    setChild("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        guardian_name: name.trim(),
        guardian_phone: phone.trim() || undefined,
        child_name: child.trim() || undefined,
      });
      reset();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#F39230] text-slate-900 hover:bg-[#F39230]/90">
          <Plus className="size-4" /> Nova solicitacao
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar assinatura</DialogTitle>
          <DialogDescription>
            Gera um link unico para o responsavel assinar pelo celular.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="nr-name">Responsavel</Label>
            <Input
              id="nr-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nr-phone">WhatsApp (opcional)</Label>
            <Input
              id="nr-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 9..."
            />
            <p className="text-[11px] text-muted-foreground">
              Se preencher, o sistema te oferece envio direto pelo WhatsApp
              depois.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nr-child">Crianca (opcional)</Label>
            <Input
              id="nr-child"
              value={child}
              onChange={(e) => setChild(e.target.value)}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
              disabled={submitting}
            >
              {submitting ? "Gerando..." : "Gerar link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
