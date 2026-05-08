export type WaitlistStatus =
  | "waiting"
  | "called"
  | "arrived"
  | "no_show"
  | "canceled";

export interface WaitlistEntry {
  id: string;
  guardian_full_name: string;
  guardian_phone: string;
  child_full_name: string | null;
  party_size: number;
  notes: string | null;
  status: WaitlistStatus;
  called_at: string | null;
  arrived_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface WaitlistInput {
  guardian_full_name: string;
  guardian_phone: string;
  child_full_name?: string;
  party_size?: number;
  notes?: string;
}
