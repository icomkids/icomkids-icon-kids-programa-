import { supabase } from "@/lib/supabase";

/**
 * Repositorio de historico — agrega dados de children + guardians +
 * sessions pra montar uma visao "ficha do cliente" completa.
 *
 * Usa join via supabase-js (sem RPC custom) pra simplicidade. Pode dar
 * lentidao com base grande (>10k criancas); nesse caso, criar uma
 * materialized view no banco.
 */

export interface ChildHistoryRow {
  /** ID da crianca. */
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: "boy" | "girl" | null;
  photo_url: string | null;
  child_notes: string | null;
  child_created_at: string;
  /** Responsavel principal (primeiro da lista de child_guardians). */
  primary_guardian: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    document: string | null;
    notes: string | null;
    relationship: string | null;
  } | null;
  /** Todos os responsaveis vinculados (pode ter mais de 1). */
  all_guardians: Array<{
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    relationship: string | null;
    is_primary: boolean;
  }>;
  /** Numero total de sessoes (concluidas + ativas). */
  total_sessions: number;
  /** Total gasto historico em centavos (soma de amount_paid_cents). */
  total_spent_cents: number;
  /** ISO da ultima sessao (started_at). */
  last_visit: string | null;
  /** ISO da primeira sessao. */
  first_visit: string | null;
  /** Distribuicao por forma de pagamento. */
  payment_methods: Record<string, number>;
}

export interface SessionHistoryRow {
  id: string;
  contracted_minutes: number;
  started_at: string;
  ended_at: string | null;
  status: "active" | "paused" | "ended";
  amount_paid_cents: number | null;
  payment_method: string | null;
  notes: string | null;
}

interface GuardianRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
}

interface ChildGuardianRow {
  relationship: string | null;
  is_primary: boolean;
  guardians: GuardianRow | GuardianRow[] | null;
}

interface SessionRow {
  child_id: string;
  amount_paid_cents: number | null;
  payment_method: string | null;
  started_at: string;
}

interface ChildRow {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: "boy" | "girl" | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  child_guardians: ChildGuardianRow[] | null;
}

/** Busca todas as criancas com agregados de sessoes (responsaveis + estatisticas). */
export async function listChildrenHistory(): Promise<ChildHistoryRow[]> {
  // Strategy: 1 query pra children (com nested guardians), depois 1 query
  // pra sessions agregada por child_id em memoria. Mais simples que tentar
  // fazer subselect agregado no PostgREST.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string, opts?: { count?: string }) => {
        order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };

  const childrenRes = await sb
    .from("children")
    .select(
      `id, full_name, birth_date, gender, photo_url, notes, created_at,
       child_guardians(
         relationship,
         is_primary,
         guardians (id, full_name, phone, email, document, notes)
       )`
    )
    .order("full_name", { ascending: true });

  if (childrenRes.error) {
    throw new Error(
      (childrenRes.error as { message?: string }).message ?? "Falha ao buscar criancas"
    );
  }

  const childrenData = (childrenRes.data ?? []) as ChildRow[];

  // 2a query: sessoes agregadas.
  const sessionsRes = await sb
    .from("sessions")
    .select("child_id, amount_paid_cents, payment_method, started_at")
    .order("started_at", { ascending: false });

  const sessionsData = (sessionsRes.data ?? []) as SessionRow[];

  // Agregacao em memoria: por child_id.
  const aggByChild = new Map<
    string,
    {
      total: number;
      spent: number;
      last: string | null;
      first: string | null;
      methods: Record<string, number>;
    }
  >();
  for (const s of sessionsData) {
    const cur = aggByChild.get(s.child_id) ?? {
      total: 0,
      spent: 0,
      last: null,
      first: null,
      methods: {} as Record<string, number>,
    };
    cur.total += 1;
    cur.spent += s.amount_paid_cents ?? 0;
    if (!cur.last || s.started_at > cur.last) cur.last = s.started_at;
    if (!cur.first || s.started_at < cur.first) cur.first = s.started_at;
    if (s.payment_method) {
      cur.methods[s.payment_method] = (cur.methods[s.payment_method] ?? 0) + 1;
    }
    aggByChild.set(s.child_id, cur);
  }

  return childrenData.map((c: ChildRow): ChildHistoryRow => {
    const links = Array.isArray(c.child_guardians) ? c.child_guardians : [];
    const guardiansList = links
      .map((link) => {
        const g = link.guardians;
        const gRow: GuardianRow | undefined = Array.isArray(g) ? g[0] : (g ?? undefined);
        if (!gRow) return null;
        return {
          id: gRow.id,
          full_name: gRow.full_name,
          phone: gRow.phone,
          email: gRow.email,
          relationship: link.relationship,
          is_primary: link.is_primary,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const primary =
      guardiansList.find((g) => g.is_primary) ?? guardiansList[0] ?? null;

    let primaryFull: ChildHistoryRow["primary_guardian"] = null;
    if (primary) {
      const fullRow = links.find((link) => {
        const g = link.guardians;
        const gRow: GuardianRow | undefined = Array.isArray(g) ? g[0] : (g ?? undefined);
        return gRow?.id === primary.id;
      });
      const gFull = fullRow?.guardians;
      const gRowFull: GuardianRow | undefined = Array.isArray(gFull)
        ? gFull[0]
        : (gFull ?? undefined);
      primaryFull = {
        id: primary.id,
        full_name: primary.full_name,
        phone: primary.phone,
        email: primary.email,
        document: gRowFull?.document ?? null,
        notes: gRowFull?.notes ?? null,
        relationship: primary.relationship,
      };
    }

    const agg = aggByChild.get(c.id);

    return {
      id: c.id,
      full_name: c.full_name,
      birth_date: c.birth_date,
      gender: c.gender,
      photo_url: c.photo_url,
      child_notes: c.notes,
      child_created_at: c.created_at,
      primary_guardian: primaryFull,
      all_guardians: guardiansList,
      total_sessions: agg?.total ?? 0,
      total_spent_cents: agg?.spent ?? 0,
      last_visit: agg?.last ?? null,
      first_visit: agg?.first ?? null,
      payment_methods: agg?.methods ?? {},
    };
  });
}

/** Busca o historico completo de sessoes de UMA crianca especifica. */
export async function listSessionsForChild(
  childId: string
): Promise<SessionHistoryRow[]> {
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };

  const res = await sb
    .from("sessions")
    .select(
      "id, contracted_minutes, started_at, ended_at, status, amount_paid_cents, payment_method, notes"
    )
    .eq("child_id", childId)
    .order("started_at", { ascending: false });

  if (res.error) {
    throw new Error(
      (res.error as { message?: string }).message ?? "Falha ao buscar sessoes da crianca"
    );
  }
  return (res.data ?? []) as SessionHistoryRow[];
}
