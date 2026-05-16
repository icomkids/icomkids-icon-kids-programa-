import { useCallback, useEffect, useState } from "react";
import { Crown, Shield, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionsDialog } from "@/features/auth/components/permissions-dialog";
import {
  listStaffProfiles,
  type StaffProfile,
} from "@/features/auth/permissions-repo";
import { PERMISSION_CATALOG } from "@/features/auth/permissions";

/**
 * Section listando todos os profiles (owner + staff) com a contagem
 * de permissoes atuais e botao pra editar.
 *
 * So owner pode usar (a propria RLS bloqueia gravacao caso staff tente).
 */

export function ProfilesPermissionsSection() {
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStaffProfiles();
      setProfiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPerms = PERMISSION_CATALOG.length;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[#7B36BF]" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Permissoes de acesso
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Defina exatamente o que cada funcionario pode ver e fazer no sistema
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="m-4 rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-2 text-xs text-[#EA4D8E]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Shield className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm font-semibold">Nenhum funcionario com login</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cadastre um funcionario via Supabase Auth (ou peca pro time de TI)
            e o role aparecera aqui pra voce atribuir permissoes.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Permissoes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const isOwner = p.role === "owner";
                const pct = isOwner ? 100 : Math.round((p.permission_count / totalPerms) * 100);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isOwner ? (
                          <Crown className="size-3.5 text-[#F4B73F]" />
                        ) : (
                          <UserCog className="size-3.5 text-[#1E78DC]" />
                        )}
                        <span className="font-medium">
                          {p.full_name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.email}
                    </TableCell>
                    <TableCell>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: isOwner ? "#F4B73F" : "#1E78DC",
                          color: isOwner ? "#0f172a" : "#fff",
                        }}
                      >
                        {isOwner ? "Owner" : "Staff"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isOwner ? (
                        <span className="text-xs font-bold text-[#F4B73F]">
                          Tudo
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background:
                                  pct === 0
                                    ? "#EA4D8E"
                                    : pct < 30
                                      ? "#F4B73F"
                                      : "#A6CD3F",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold">
                            {p.permission_count}/{totalPerms}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(p)}
                        disabled={isOwner}
                        title={isOwner ? "Owner sempre tem tudo" : "Editar permissoes"}
                      >
                        <Shield className="size-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing ? (
        <PermissionsDialog
          open={!!editing}
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </section>
  );
}
