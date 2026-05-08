export type AppointmentKind = "visit" | "event";
export type Gender = "boy" | "girl";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "canceled"
  | "no_show";

export interface AppointmentChild {
  id?: string;
  full_name: string;
  age: number | null;
  gender: Gender | null;
  notes: string | null;
}

export interface Appointment {
  id: string;
  kind: AppointmentKind;
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
  children: AppointmentChild[];
}

export interface AppointmentInput {
  kind: AppointmentKind;
  title?: string;
  guardian_name: string;
  guardian_phone: string;
  child_name?: string;
  party_size?: number;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time?: string;
  total_cents?: number;
  deposit_cents?: number;
  notes?: string;
  children?: AppointmentChild[];
}
