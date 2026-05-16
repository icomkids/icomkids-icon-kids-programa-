import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/auth-context";
import type { PermissionKey } from "@/features/auth/permissions";

/**
 * Hook que carrega as permissoes do usuario atual via RPC my_permissions()
 * e expoe um `can(key)` pra checagem.
 *
 * - Owner sempre retorna true em qualquer can() (a propria RPC ja devolve
 *   o catalogo inteiro, mas tambem checamos o role local pra cobrir cache).
 * - Carrega 1 vez no mount (e ao mudar de usuario via signIn/signOut).
 * - Atencao: NUNCA confie no front pra seguranca. As RLS policies do banco
 *   tambem bloqueiam — esse hook serve so pra esconder/desabilitar UI.
 */

const CACHE_KEY = "icomkids:my_permissions";

interface CacheEntry {
  email: string;
  keys: PermissionKey[];
  cachedAt: number;
}

function loadCache(email: string | null): PermissionKey[] | null {
  if (!email) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed.email !== email) return null;
    // Cache valido por 5 min (alteracoes de permissao sao raras).
    if (Date.now() - parsed.cachedAt > 5 * 60 * 1000) return null;
    return parsed.keys;
  } catch {
    return null;
  }
}

function saveCache(email: string, keys: PermissionKey[]) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ email, keys, cachedAt: Date.now() } as CacheEntry)
    );
  } catch {
    // ignora — sessionStorage cheio etc
  }
}

export function clearPermissionsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignora
  }
}

interface UsePermissionsResult {
  keys: Set<PermissionKey>;
  loading: boolean;
  /** true se o usuario eh owner (bypass total). */
  isOwner: boolean;
  /** Checa se o usuario tem a permissao. Owner sempre retorna true. */
  can: (key: PermissionKey) => boolean;
  /** Verifica varias chaves de uma vez (true = tem todas). */
  canAll: (keys: PermissionKey[]) => boolean;
  /** Verifica se tem pelo menos uma das chaves. */
  canAny: (keys: PermissionKey[]) => boolean;
  refresh: () => Promise<void>;
}

export function usePermissions(): UsePermissionsResult {
  const { email, isMock } = useAuth();
  const [keys, setKeys] = useState<Set<PermissionKey>>(() => {
    const cached = loadCache(email);
    return new Set(cached ?? []);
  });
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const refresh = useCallback(async () => {
    if (isMock) {
      // Em modo mock, considera owner pra nao bloquear desenvolvimento.
      setIsOwner(true);
      setKeys(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Busca role
      const { data: prof } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => {
              maybeSingle: () => Promise<{ data: { role?: string } | null }>;
            };
          };
        };
      })
        .from("profiles")
        .select("role")
        .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      const ownerFlag = prof?.role === "owner";
      setIsOwner(ownerFlag);

      // Carrega permissoes via RPC.
      const { data, error } = await (supabase as unknown as {
        rpc: (
          name: string,
          args?: Record<string, unknown>
        ) => Promise<{ data: Array<{ permission_key: string }> | null; error: unknown }>;
      }).rpc("my_permissions");

      if (error) {
        // eslint-disable-next-line no-console
        console.warn("Falha ao carregar permissoes:", error);
        setKeys(new Set());
        return;
      }
      const set = new Set<PermissionKey>(
        (data ?? []).map((r) => r.permission_key as PermissionKey)
      );
      setKeys(set);
      if (email) saveCache(email, [...set]);
    } finally {
      setLoading(false);
    }
  }, [email, isMock]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const can = useCallback(
    (key: PermissionKey) => {
      if (isOwner) return true;
      return keys.has(key);
    },
    [isOwner, keys]
  );

  const canAll = useCallback(
    (list: PermissionKey[]) => {
      if (isOwner) return true;
      return list.every((k) => keys.has(k));
    },
    [isOwner, keys]
  );

  const canAny = useCallback(
    (list: PermissionKey[]) => {
      if (isOwner) return true;
      return list.some((k) => keys.has(k));
    },
    [isOwner, keys]
  );

  return { keys, loading, isOwner, can, canAll, canAny, refresh };
}
