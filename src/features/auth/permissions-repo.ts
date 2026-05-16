import { supabase } from "@/lib/supabase";
import type { PermissionKey } from "@/features/auth/permissions";

/**
 * Repositorio do RBAC: lista profiles staff, suas permissoes, templates,
 * e operacoes de aplicacao.
 */

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "staff" | "partner" | "customer";
  permission_count: number;
}

export interface PermissionTemplate {
  id: string;
  name: string;
  description: string | null;
  permission_keys: PermissionKey[];
}

export interface PermissionAuditRow {
  id: string;
  user_id: string;
  changed_by: string | null;
  action: string;
  permission_key: string | null;
  snapshot: string[] | null;
  at: string;
}

/** Lista perfis que importam pro RBAC (staff + owner, ordenados). */
export async function listStaffProfiles(): Promise<StaffProfile[]> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (col: string, vals: string[]) => {
          order: (col: string) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };

  const res = await sb
    .from("profiles")
    .select("id, email, full_name, role")
    .in("role", ["owner", "staff"])
    .order("full_name");

  if (res.error) {
    throw new Error((res.error as { message?: string }).message ?? "erro listar profiles");
  }

  const profiles = ((res.data ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    role: StaffProfile["role"];
  }>);

  // Conta permissoes por usuario.
  const counts = await getPermissionCounts(profiles.map((p) => p.id));
  return profiles.map((p) => ({
    ...p,
    permission_count: counts[p.id] ?? 0,
  }));
}

async function getPermissionCounts(
  userIds: string[]
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (col: string, vals: string[]) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  const res = await sb
    .from("user_permissions")
    .select("user_id, permission_key")
    .in("user_id", userIds);
  if (res.error) return {};
  const rows = (res.data ?? []) as Array<{ user_id: string }>;
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
  return counts;
}

/** Permissoes de um usuario especifico. */
export async function getUserPermissions(userId: string): Promise<PermissionKey[]> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  const res = await sb
    .from("user_permissions")
    .select("permission_key")
    .eq("user_id", userId);
  if (res.error) {
    throw new Error((res.error as { message?: string }).message ?? "erro permissoes");
  }
  return ((res.data ?? []) as Array<{ permission_key: string }>).map(
    (r) => r.permission_key as PermissionKey
  );
}

/** Aplica novo conjunto de permissoes (substitui tudo). */
export async function setUserPermissions(
  userId: string,
  keys: PermissionKey[]
): Promise<void> {
  const sb = supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ error: unknown }>;
  };
  const { error } = await sb.rpc("set_user_permissions", {
    p_user_id: userId,
    p_keys: keys,
  });
  if (error) {
    throw new Error(
      (error as { message?: string }).message ?? "erro ao aplicar permissoes"
    );
  }
}

/** Lista templates disponiveis. */
export async function listTemplates(): Promise<PermissionTemplate[]> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (col: string) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  const res = await sb
    .from("permission_templates")
    .select("id, name, description, permission_keys")
    .order("name");
  if (res.error) return [];
  return (res.data ?? []) as PermissionTemplate[];
}

/** Cria um novo template a partir do conjunto atual. */
export async function createTemplate(
  name: string,
  description: string | null,
  keys: PermissionKey[]
): Promise<void> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (
        rows: Record<string, unknown>
      ) => Promise<{ error: unknown }>;
    };
  };
  const { error } = await sb.from("permission_templates").insert({
    name,
    description,
    permission_keys: keys,
  });
  if (error) {
    throw new Error(
      (error as { message?: string }).message ?? "erro ao criar template"
    );
  }
}

/** Log de auditoria recente pra um usuario (ou geral). */
export async function listPermissionAudit(
  userId?: string,
  limit = 50
): Promise<PermissionAuditRow[]> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq?: (col: string, v: string) => unknown;
        order: (col: string, opts?: { ascending?: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
  let q = sb.from("permission_audit_log").select(
    "id, user_id, changed_by, action, permission_key, snapshot, at"
  );
  if (userId) {
    q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq(
      "user_id",
      userId
    );
  }
  const res = await q.order("at", { ascending: false }).limit(limit);
  if (res.error) return [];
  return (res.data ?? []) as PermissionAuditRow[];
}
