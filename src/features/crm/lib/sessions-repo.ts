import { supabase } from "@/lib/supabase";
import type { ActiveSession, QuickRegisterInput } from "../types";

export interface SessionsRepo {
  listActive(): Promise<ActiveSession[]>;
  registerAndStart(input: QuickRegisterInput): Promise<ActiveSession>;
  pause(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  end(sessionId: string): Promise<void>;
  /** Subscribe to changes; returns an unsubscribe fn. */
  subscribe(onChange: () => void): () => void;
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
  },
];

let mockSessions: ActiveSession[] = [...initialMock];
const mockSubscribers = new Set<() => void>();
const notify = () => mockSubscribers.forEach((fn) => fn());

export const mockSessionsRepo: SessionsRepo = {
  async listActive() {
    return mockSessions.filter((s) => s.status !== "ended");
  },
  async registerAndStart(input) {
    const child_id = nextId();
    const guardian_id = nextId();
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

export const supabaseSessionsRepo: SessionsRepo = {
  async listActive() {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        "id, child_id, guardian_id, contracted_minutes, started_at, paused_at, paused_total_seconds, ended_at, status, amount_paid_cents, payment_method, children:children(id, full_name, birth_date, photo_url, notes), guardians:guardians(id, full_name, phone)"
      )
      .neq("status", "ended")
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

    const { data: sessionRow, error: sErr } = await supabase
      .from("sessions")
      .insert({
        child_id: childRow.id,
        guardian_id: guardianRow.id,
        contracted_minutes: input.contracted_minutes,
        amount_paid_cents: input.amount_paid_cents ?? null,
        payment_method: input.payment_method ?? null,
      })
      .select(
        "id, child_id, guardian_id, contracted_minutes, started_at, paused_at, paused_total_seconds, ended_at, status, amount_paid_cents, payment_method"
      )
      .single();
    if (sErr) throw sErr;

    return rowToSession({
      ...(sessionRow as Omit<SessionRow, "children" | "guardians">),
      children: childRow,
      guardians: guardianRow,
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
