import { supabase } from "@/lib/supabase";
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Gender,
} from "../types";

export interface AppointmentsRepo {
  /** Upcoming appointments (today onward) ordered by date+time. */
  listUpcoming(): Promise<Appointment[]>;
  /** Recently closed (completed | canceled | no_show) ordered desc. */
  listRecentClosed(limit?: number): Promise<Appointment[]>;
  create(input: AppointmentInput): Promise<Appointment>;
  setStatus(id: string, status: AppointmentStatus): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface AppointmentChildRow {
  id: string;
  full_name: string;
  age: number | null;
  gender: Gender | null;
  notes: string | null;
}

interface AppointmentRow {
  id: string;
  kind: "visit" | "event";
  title: string | null;
  guardian_name: string;
  guardian_phone: string;
  child_name: string | null;
  party_size: number;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  total_cents: number;
  deposit_cents: number;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  appointment_children: AppointmentChildRow[];
}

const SELECT =
  "id, kind, title, guardian_name, guardian_phone, child_name, party_size, scheduled_date, scheduled_start_time, scheduled_end_time, total_cents, deposit_cents, status, notes, created_at, appointment_children:appointment_children(id, full_name, age, gender, notes)";

function rowToAppointment(row: AppointmentRow): Appointment {
  const { appointment_children, ...rest } = row;
  return {
    ...rest,
    children: (appointment_children ?? []).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      age: c.age,
      gender: c.gender,
      notes: c.notes,
    })),
  };
}

function todayIsoDate(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export const supabaseAppointmentsRepo: AppointmentsRepo = {
  async listUpcoming() {
    const { data, error } = await supabase
      .from("appointments")
      .select(SELECT)
      .in("status", ["requested", "confirmed", "in_progress"])
      .gte("scheduled_date", todayIsoDate())
      .order("scheduled_date")
      .order("scheduled_start_time");
    if (error) throw error;
    return (data as unknown as AppointmentRow[]).map(rowToAppointment);
  },
  async listRecentClosed(limit = 30) {
    const { data, error } = await supabase
      .from("appointments")
      .select(SELECT)
      .in("status", ["completed", "canceled", "no_show"])
      .order("scheduled_date", { ascending: false })
      .order("scheduled_start_time", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as AppointmentRow[]).map(rowToAppointment);
  },
  async create(input) {
    const partySize =
      input.children && input.children.length > 0
        ? input.children.length
        : input.party_size ?? 1;

    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        kind: input.kind,
        title: input.title ?? null,
        guardian_name: input.guardian_name,
        guardian_phone: input.guardian_phone,
        child_name: input.child_name ?? null,
        party_size: partySize,
        scheduled_date: input.scheduled_date,
        scheduled_start_time: input.scheduled_start_time,
        scheduled_end_time: input.scheduled_end_time ?? null,
        total_cents: input.total_cents ?? 0,
        deposit_cents: input.deposit_cents ?? 0,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (input.children && input.children.length > 0) {
      const rows = input.children.map((c) => ({
        appointment_id: appt.id,
        full_name: c.full_name,
        age: c.age,
        gender: c.gender,
        notes: c.notes,
      }));
      const { error: cErr } = await supabase
        .from("appointment_children")
        .insert(rows);
      if (cErr) throw cErr;
    }

    const { data: full, error: fErr } = await supabase
      .from("appointments")
      .select(SELECT)
      .eq("id", appt.id)
      .single();
    if (fErr) throw fErr;
    return rowToAppointment(full as unknown as AppointmentRow);
  },
  async setStatus(id, status) {
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`appointments-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

export const appointmentsRepo: AppointmentsRepo = supabaseAppointmentsRepo;
