import { supabase } from "@/lib/supabase";
import { mockPartners } from "@/features/partners/lib/partners-repo";
import type { ActiveSession, QuickRegisterInput } from "../types";

export interface SessionsRepo {
  listActive(): Promise<ActiveSession[]>;
  /** All sessions (active + ended) started since local midnight today. */
  listToday(): Promise<ActiveSession[]>;
  /** All sessions started in the last `days` days, ordered newest first. */
  listSinceDays(days: number): Promise<ActiveSession[]>;
  registerAndStart(input: QuickRegisterInput): Promise<ActiveSession>;
  pause(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  end(sessionId: string): Promise<void>;
  /** Subscribe to changes; returns an unsubscribe fn. */
  subscribe(onChange: () => void): () => void;
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ============================================================================
// Mock implementation — used while Supabase migration is not applied.
// ============================================================================

let mockSeed = 0;
const nextId = () => `mock-${++mockSeed}-${Date.now().toString(36)}`;

const initialMock: ActiveSession[] = [
  {
    id: nextId(),
    child: {
      id: nextId(),
      full_name: "Helena Souza",
      birth_date: "2019-03-12",
      photo_url: null,
      notes: null,
    },
    guardian: { id: nextId(), full_name: "Mariana Souza", phone: "(11) 99876-5432" },
    contracted_minutes: 60,
    started_at: new Date(Date.now() - 25 * 60_000).toISOString(),
    paused_at: null,
    paused_total_seconds: 0,
    ended_at: null,
    status: "active",
    amount_paid_cents: 4500,
    payment_method: "pix",
    partner_id: null,
    partner_name: null,
  },
  {
    id: nextId(),
    child: {
      id: nextId(),
      full_name: "Davi Almeida",
      birth_date: "2020-08-04",
      photo_url: null,
      notes: null,
    },
    guardian: { id: nextId(), full_name: "Carla Almeida", phone: "(11) 99123-4567" },
    contracted_minutes: 30,
    started_at: new Date(Date.now() - 27 * 60_000).toISOString(),
    paused_at: null,
    paused_total_seconds: 0,
    ended_at: null,
    status: "active",
    amount_paid_cents: 3000,
    payment_method: "cartao",
    partner_id: null,
    partner_name: null,
  },
  {
    id: nextId(),
    child: {
      id: nextId(),
      full_name: "Sofia Reis",
      birth_date: "2018-11-22",
      photo_url: null,
      notes: null,
    },
    guardian: { id: nextId(), full_name: "Renato Reis", phone: "(11) 98765-1122" },
    contracted_minutes: 30,
    started_at: new Date(Date.now() - 31 * 60_000).toISOString(),
    paused_at: null,
    paused_total_seconds: 0,
    ended_at: null,
    status: "active",
    amount_paid_cents: 3000,
    payment_method: "dinheiro",
    partner_id: null,
    partner_name: null,
  },
];

let mockSessions: ActiveSession[] = [...initialMock];
const mockSubscribers = new Set<() => void>();
const notify = () => mockSubscribers.forEach((fn) => fn());

// Deterministic LCG so mock historical data is stable across reloads.
function makeRng(seed: number) {
  let s = seed % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const childNamesPool = [
  "Helena Souza",
  "Davi Almeida",
  "Sofia Reis",
  "Lara Pinto",
  "Pedro Lima",
  "Alice Costa",
  "Heitor Mendes",
  "Manuela Dias",
  "Bernardo Castro",
  "Valentina Nunes",
  "Theo Carvalho",
  "Cecilia Oliveira",
  "Gael Ferreira",
  "Isabela Moraes",
  "Arthur Ramos",
  "Maria Eduarda Vieira",
  "Bryan Pereira",
  "Antonella Souto",
];

const guardianNamesPool = [
  "Mariana Souza",
  "Carla Almeida",
  "Renato Reis",
  "Bruno Pinto",
  "Joana Lima",
  "Tiago Costa",
  "Patricia Mendes",
  "Felipe Dias",
  "Andre Castro",
  "Luiza Nunes",
  "Roberta Carvalho",
  "Marcelo Oliveira",
  "Paula Ferreira",
  "Gustavo Moraes",
  "Camila Ramos",
  "Vinicius Vieira",
  "Daniela Pereira",
  "Eduardo Souto",
];

const durationsMin = [30, 45, 60, 60, 60, 90, 120];
const methodsRotation: Array<"pix" | "dinheiro" | "cartao"> = ["pix", "dinheiro", "cartao"];

/**
 * Generate sessions for a specific local day with realistic peak-hour clustering.
 * Daysago=0 means today's earlier-day sessions; we already have today's active
 * sessions seeded separately, so this only adds ended ones in the past.
 */
function seedSessionsForDay(daysAgo: number, count: number, rngSeed: number): ActiveSession[] {
  const rng = makeRng(rngSeed);
  const dayStart = new Date();
  dayStart.setDate(dayStart.getDate() - daysAgo);
  dayStart.setHours(0, 0, 0, 0);

  const out: ActiveSession[] = [];
  for (let i = 0; i < count; i++) {
    // Peak distribution: ~60% afternoon (14h-19h), ~25% morning (10h-12h), 15% other.
    const r = rng();
    let startHour: number;
    let startMin: number;
    if (r < 0.6) startHour = 14 + Math.floor(rng() * 5);
    else if (r < 0.85) startHour = 10 + Math.floor(rng() * 2);
    else startHour = 9 + Math.floor(rng() * 12);
    startMin = Math.floor(rng() * 60);

    const startedAt = new Date(dayStart);
    startedAt.setHours(startHour, startMin, 0, 0);

    // Skip future timestamps if generating today's earlier sessions
    if (daysAgo === 0 && startedAt.getTime() >= Date.now()) continue;

    const minutes = durationsMin[Math.floor(rng() * durationsMin.length)];
    const endedAt = new Date(startedAt.getTime() + minutes * 60_000);
    const method = methodsRotation[Math.floor(rng() * methodsRotation.length)];
    const cents = minutes * 80 + Math.floor(rng() * 800); // ~R$24-100 range

    const childIdx = Math.floor(rng() * childNamesPool.length);
    out.push({
      id: nextId(),
      child: {
        id: nextId(),
        full_name: childNamesPool[childIdx],
        birth_date: null,
        photo_url: null,
        notes: null,
      },
      guardian: {
        id: nextId(),
        full_name: guardianNamesPool[childIdx],
        phone: null,
      },
      contracted_minutes: minutes,
      started_at: startedAt.toISOString(),
      paused_at: null,
      paused_total_seconds: 0,
      ended_at: endedAt.toISOString(),
      status: "ended",
      amount_paid_cents: cents,
      payment_method: method,
      partner_id: null,
      partner_name: null,
    });
  }
  return out;
}

// Seed last 6 days (1..6 days ago) so dashboard has a full week curve.
// We use a different prime seed per day so days don't all look identical.
const HISTORICAL_DAYS = 6;
for (let d = 1; d <= HISTORICAL_DAYS; d++) {
  const isWeekend = (() => {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    const dow = dt.getDay();
    return dow === 0 || dow === 6;
  })();
  const count = isWeekend ? 14 + ((d * 7) % 4) : 8 + ((d * 5) % 3);
  mockSessions.push(...seedSessionsForDay(d, count, 13_576_201 * d));
}

// Seed a few ended sessions earlier today so the Caixa page has data on load.
const earlierEnded: ActiveSession[] = [
  {
    id: nextId(),
    child: { id: nextId(), full_name: "Lara Pinto", birth_date: null, photo_url: null, notes: null },
    guardian: { id: nextId(), full_name: "Bruno Pinto", phone: "(11) 99100-2233" },
    contracted_minutes: 60,
    started_at: new Date(Date.now() - 4 * 3600_000).toISOString(),
    paused_at: null,
    paused_total_seconds: 0,
    ended_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    status: "ended",
    amount_paid_cents: 4500,
    payment_method: "pix",
    partner_id: null,
    partner_name: null,
  },
  {
    id: nextId(),
    child: { id: nextId(), full_name: "Pedro Lima", birth_date: null, photo_url: null, notes: null },
    guardian: { id: nextId(), full_name: "Joana Lima", phone: "(11) 99211-3344" },
    contracted_minutes: 30,
    started_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
    paused_at: null,
    paused_total_seconds: 0,
    ended_at: new Date(Date.now() - 4.5 * 3600_000).toISOString(),
    status: "ended",
    amount_paid_cents: 3000,
    payment_method: "dinheiro",
    partner_id: null,
    partner_name: null,
  },
  {
    id: nextId(),
    child: { id: nextId(), full_name: "Alice Costa", birth_date: null, photo_url: null, notes: null },
    guardian: { id: nextId(), full_name: "Tiago Costa", phone: "(11) 98123-7788" },
    contracted_minutes: 90,
    started_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
    paused_at: null,
    paused_total_seconds: 0,
    ended_at: new Date(Date.now() - 4.5 * 3600_000).toISOString(),
    status: "ended",
    amount_paid_cents: 6500,
    payment_method: "cartao",
    partner_id: null,
    partner_name: null,
  },
];
mockSessions = [...mockSessions, ...earlierEnded];

export const mockSessionsRepo: SessionsRepo = {
  async listActive() {
    return mockSessions.filter((s) => s.status !== "ended");
  },
  async listToday() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const sinceMs = since.getTime();
    return mockSessions
      .filter((s) => new Date(s.started_at).getTime() >= sinceMs)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  },
  async listSinceDays(days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    const sinceMs = since.getTime();
    return mockSessions
      .filter((s) => new Date(s.started_at).getTime() >= sinceMs)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  },
  async registerAndStart(input) {
    const child_id = nextId();
    const guardian_id = nextId();
    const partner = input.partner_id
      ? mockPartners.find((p) => p.id === input.partner_id) ?? null
      : null;
    const session: ActiveSession = {
      id: nextId(),
      child: {
        id: child_id,
        full_name: input.child_full_name,
        birth_date: null,
        photo_url: input.photo_url ?? null,
        notes: null,
      },
      guardian: {
        id: guardian_id,
        full_name: input.guardian_full_name,
        phone: input.guardian_phone ?? null,
      },
      contracted_minutes: input.contracted_minutes,
      started_at: new Date().toISOString(),
      paused_at: null,
      paused_total_seconds: 0,
      ended_at: null,
      status: "active",
      amount_paid_cents: input.amount_paid_cents ?? null,
      payment_method: input.payment_method ?? null,
      partner_id: partner?.id ?? null,
      partner_name: partner?.name ?? null,
    };
    mockSessions = [session, ...mockSessions];
    notify();
    return session;
  },
  async pause(sessionId) {
    mockSessions = mockSessions.map((s) =>
      s.id === sessionId && s.status === "active"
        ? { ...s, status: "paused", paused_at: new Date().toISOString() }
        : s
    );
    notify();
  },
  async resume(sessionId) {
    mockSessions = mockSessions.map((s) => {
      if (s.id !== sessionId || s.status !== "paused" || !s.paused_at) return s;
      const additionalPaused = Math.floor((Date.now() - new Date(s.paused_at).getTime()) / 1000);
      return {
        ...s,
        status: "active",
        paused_at: null,
        paused_total_seconds: s.paused_total_seconds + additionalPaused,
      };
    });
    notify();
  },
  async end(sessionId) {
    mockSessions = mockSessions.map((s) =>
      s.id === sessionId ? { ...s, status: "ended", ended_at: new Date().toISOString() } : s
    );
    notify();
  },
  subscribe(onChange) {
    mockSubscribers.add(onChange);
    return () => mockSubscribers.delete(onChange);
  },
};

// ============================================================================
// Supabase implementation — wired up but only used after migration is applied.
// ============================================================================

interface SessionRow {
  id: string;
  child_id: string;
  guardian_id: string | null;
  partner_id: string | null;
  contracted_minutes: number;
  started_at: string;
  paused_at: string | null;
  paused_total_seconds: number;
  ended_at: string | null;
  status: "active" | "paused" | "ended";
  amount_paid_cents: number | null;
  payment_method: string | null;
  children: {
    id: string;
    full_name: string;
    birth_date: string | null;
    photo_url: string | null;
    notes: string | null;
  } | null;
  guardians: {
    id: string;
    full_name: string;
    phone: string | null;
  } | null;
  partners: {
    id: string;
    name: string;
  } | null;
}

function rowToSession(row: SessionRow): ActiveSession {
  return {
    id: row.id,
    contracted_minutes: row.contracted_minutes,
    started_at: row.started_at,
    paused_at: row.paused_at,
    paused_total_seconds: row.paused_total_seconds,
    ended_at: row.ended_at,
    status: row.status,
    amount_paid_cents: row.amount_paid_cents,
    payment_method: row.payment_method,
    partner_id: row.partner_id,
    partner_name: row.partners?.name ?? null,
    child: row.children ?? {
      id: row.child_id,
      full_name: "(criança removida)",
      birth_date: null,
      photo_url: null,
      notes: null,
    },
    guardian: row.guardians ?? null,
  };
}

const SESSION_SELECT =
  "id, child_id, guardian_id, partner_id, contracted_minutes, started_at, paused_at, paused_total_seconds, ended_at, status, amount_paid_cents, payment_method, children:children(id, full_name, birth_date, photo_url, notes), guardians:guardians(id, full_name, phone), partners:partners(id, name)";

export const supabaseSessionsRepo: SessionsRepo = {
  async listActive() {
    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .neq("status", "ended")
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as SessionRow[]).map(rowToSession);
  },
  async listToday() {
    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .gte("started_at", startOfTodayISO())
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as SessionRow[]).map(rowToSession);
  },
  async listSinceDays(days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as SessionRow[]).map(rowToSession);
  },
  async registerAndStart(input) {
    const { data: childRow, error: cErr } = await supabase
      .from("children")
      .insert({ full_name: input.child_full_name, photo_url: input.photo_url ?? null })
      .select("id, full_name, birth_date, photo_url, notes")
      .single();
    if (cErr) throw cErr;

    const { data: guardianRow, error: gErr } = await supabase
      .from("guardians")
      .insert({
        full_name: input.guardian_full_name,
        phone: input.guardian_phone ?? null,
      })
      .select("id, full_name, phone")
      .single();
    if (gErr) throw gErr;

    await supabase.from("child_guardians").insert({
      child_id: childRow.id,
      guardian_id: guardianRow.id,
      is_primary: true,
    });

    let partnerRow: { id: string; name: string } | null = null;
    if (input.partner_id) {
      const { data: p } = await supabase
        .from("partners")
        .select("id, name")
        .eq("id", input.partner_id)
        .maybeSingle();
      partnerRow = p ?? null;
    }

    const { data: sessionRow, error: sErr } = await supabase
      .from("sessions")
      .insert({
        child_id: childRow.id,
        guardian_id: guardianRow.id,
        partner_id: input.partner_id ?? null,
        contracted_minutes: input.contracted_minutes,
        amount_paid_cents: input.amount_paid_cents ?? null,
        payment_method: input.payment_method ?? null,
      })
      .select(
        "id, child_id, guardian_id, partner_id, contracted_minutes, started_at, paused_at, paused_total_seconds, ended_at, status, amount_paid_cents, payment_method"
      )
      .single();
    if (sErr) throw sErr;

    return rowToSession({
      ...(sessionRow as Omit<SessionRow, "children" | "guardians" | "partners">),
      children: childRow,
      guardians: guardianRow,
      partners: partnerRow,
    } as SessionRow);
  },
  async pause(sessionId) {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "paused", paused_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) throw error;
  },
  async resume(sessionId) {
    const { data, error } = await supabase
      .from("sessions")
      .select("paused_at, paused_total_seconds")
      .eq("id", sessionId)
      .single();
    if (error) throw error;
    const additionalPaused = data.paused_at
      ? Math.floor((Date.now() - new Date(data.paused_at).getTime()) / 1000)
      : 0;
    const { error: uErr } = await supabase
      .from("sessions")
      .update({
        status: "active",
        paused_at: null,
        paused_total_seconds: data.paused_total_seconds + additionalPaused,
      })
      .eq("id", sessionId);
    if (uErr) throw uErr;
  },
  async end(sessionId) {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) throw error;
  },
  subscribe(onChange) {
    const channel = supabase
      .channel("sessions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, onChange)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

// ============================================================================
// Active repo — selected at module load via env flag.
// ============================================================================

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const sessionsRepo: SessionsRepo = useMock ? mockSessionsRepo : supabaseSessionsRepo;
export const isUsingMockData = useMock;
