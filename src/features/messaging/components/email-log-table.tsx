import { Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmailLog } from "../hooks/use-email-log";
import { formatTimeOfDay } from "@/lib/format";

export function EmailLogTable() {
  const { emails, loading } = useEmailLog(50);

  const stats = {
    total: emails.length,
    sent: emails.filter((e) => e.status === "sent").length,
    failed: emails.filter((e) => e.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Emails
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Total" value={stats.total.toString()} color="#EA4D8E" />
          <Stat label="Entregues" value={stats.sent.toString()} color="#A6CD3F" />
          <Stat label="Falhas" value={stats.failed.toString()} color="#EA4D8E" />
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-[#EA4D8E]" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Log de emails
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            ultimos {emails.length}
          </p>
        </header>
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
            <Mail className="size-6" />
            <p>Nenhum email enviado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {formatTimeOfDay(m.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.to_email}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        {m.event_type ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                      {m.subject}
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
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
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
