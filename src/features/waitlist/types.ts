export type WaitlistStatus =
  | "waiting"
  | "called"
  | "arrived"
  | "no_show"
  | "canceled";

export type WaitlistGender = "boy" | "girl";

export interface WaitlistEntry {
  id: string;
  guardian_full_name: string;
  guardian_phone: string;
  child_full_name: string | null;
  child_age: number | null;
  child_gender: WaitlistGender | null;
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
  child_age?: number;
  child_gender?: WaitlistGender;
  party_size?: number;
  notes?: string;
}
