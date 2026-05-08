import { supabase } from "@/lib/supabase";
import type { WaitlistEntry, WaitlistInput, WaitlistStatus } from "../types";

export interface WaitlistRepo {
  /** Active entries (waiting + called), ordered by entry time. */
  listActive(): Promise<WaitlistEntry[]>;
  /** Recently closed entries (arrived/no_show/canceled). */
  listRecentClosed(limit?: number): Promise<WaitlistEntry[]>;
  add(input: WaitlistInput): Promise<WaitlistEntry>;
  setStatus(id: string, status: WaitlistStatus): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface WaitlistRow {
  id: string;
  guardian_full_name: string;
  guardian_phone: string;
  child_full_name: string | null;
  child_age: number | null;
  child_gender: "boy" | "girl" | null;
  party_size: number;
  notes: string | null;
  status: WaitlistStatus;
  called_at: string | null;
  arrived_at: string | null;
  closed_at: string | null;
  created_at: string;
}

const SELECT =
  "id, guardian_full_name, guardian_phone, child_full_name, child_age, child_gender, party_size, notes, status, called_at, arrived_at, closed_at, created_at";

function rowToEntry(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    guardian_full_name: row.guardian_full_name,
    guardian_phone: row.guardian_phone,
    child_full_name: row.child_full_name,
    child_age: row.child_age,
    child_gender: row.child_gender,
    party_size: row.party_size,
    notes: row.notes,
    status: row.status,
    called_at: row.called_at,
    arrived_at: row.arrived_at,
    closed_at: row.closed_at,
    created_at: row.created_at,
  };
}

// ============================================================================
// Mock
// ============================================================================

let seed = 0;
const nextId = () => `mock-wait-${++seed}`;
let mockEntries: WaitlistEntry[] = [];
const subs = new Set<() => void>();
const notify = () => subs.forEach((fn) => fn());

function patchStatusFields(
  entry: WaitlistEntry,
  next: WaitlistStatus
): WaitlistEntry {
  const now = new Date().toISOString();
  switch (next) {
    case "called":
      return { ...entry, status: next, called_at: now };
    case "arrived":
      return {
        ...entry,
        status: next,
        arrived_at: entry.arrived_at ?? now,
        closed_at: now,
      };
    case "no_show":
    case "canceled":
      return { ...entry, status: next, closed_at: now };
    default:
      return { ...entry, status: next };
  }
}

export const mockWaitlistRepo: WaitlistRepo = {
  async listActive() {
    return mockEntries
      .filter((e) => e.status === "waiting" || e.status === "called")
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  },
  async listRecentClosed(limit = 20) {
    return mockEntries
      .filter((e) =>
        e.status === "arrived" || e.status === "no_show" || e.status === "canceled"
      )
      .sort(
        (a, b) =>
          new Date(b.closed_at ?? b.created_at).getTime() -
          new Date(a.closed_at ?? a.created_at).getTime()
      )
      .slice(0, limit);
  },
  async add(input) {
    const entry: WaitlistEntry = {
      id: nextId(),
      guardian_full_name: input.guardian_full_name,
      guardian_phone: input.guardian_phone,
      child_full_name: input.child_full_name ?? null,
      child_age: input.child_age ?? null,
      child_gender: input.child_gender ?? null,
      party_size: input.party_size ?? 1,
      notes: input.notes ?? null,
      status: "waiting",
      called_at: null,
      arrived_at: null,
      closed_at: null,
      created_at: new Date().toISOString(),
    };
    mockEntries = [...mockEntries, entry];
    notify();
    return entry;
  },
  async setStatus(id, status) {
    mockEntries = mockEntries.map((e) =>
      e.id === id ? patchStatusFields(e, status) : e
    );
    notify();
  },
  subscribe(onChange) {
    subs.add(onChange);
    return () => subs.delete(onChange);
  },
};

// ============================================================================
// Supabase
// ============================================================================

export const supabaseWaitlistRepo: WaitlistRepo = {
  async listActive() {
    const { data, error } = await supabase
      .from("waitlist_entries")
      .select(SELECT)
      .in("status", ["waiting", "called"])
      .order("created_at");
    if (error) throw error;
    return (data as unknown as WaitlistRow[]).map(rowToEntry);
  },
  async listRecentClosed(limit = 20) {
    const { data, error } = await supabase
      .from("waitlist_entries")
      .select(SELECT)
      .in("status", ["arrived", "no_show", "canceled"])
      .order("closed_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as WaitlistRow[]).map(rowToEntry);
  },
  async add(input) {
    const { data, error } = await supabase
      .from("waitlist_entries")
      .insert({
        guardian_full_name: input.guardian_full_name,
        guardian_phone: input.guardian_phone,
        child_full_name: input.child_full_name ?? null,
        child_age: input.child_age ?? null,
        child_gender: input.child_gender ?? null,
        party_size: input.party_size ?? 1,
        notes: input.notes ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToEntry(data as unknown as WaitlistRow);
  },
  async setStatus(id, status) {
    const now = new Date().toISOString();
    const patch: Partial<WaitlistRow> = { status };
    if (status === "called") patch.called_at = now;
    if (status === "arrived") {
      patch.arrived_at = now;
      patch.closed_at = now;
    }
    if (status === "no_show" || status === "canceled") patch.closed_at = now;
    const { error } = await supabase
      .from("waitlist_entries")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`waitlist-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist_entries" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const waitlistRepo: WaitlistRepo = useMock
  ? mockWaitlistRepo
  : supabaseWaitlistRepo;
