export type UserRole = "owner" | "staff" | "partner" | "customer";
export type SessionStatus = "active" | "paused" | "ended";
export type DerivedSessionStatus = "active" | "ending_soon" | "expired" | "paused" | "ended";

export type ChildGender = "boy" | "girl";

export interface Child {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: ChildGender | null;
  photo_url: string | null;
  notes: string | null;
}

export interface Guardian {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

export interface ActiveSession {
  id: string;
  child: Child;
  guardian: Guardian | null;
  contracted_minutes: number;
  started_at: string;
  paused_at: string | null;
  paused_total_seconds: number;
  ended_at: string | null;
  status: SessionStatus;
  amount_paid_cents: number | null;
  payment_method: string | null;
  partner_id: string | null;
  partner_name: string | null;
  qr_code_token: string | null;
}

export interface QuickRegisterInput {
  child_full_name: string;
  child_birth_date?: string;
  child_gender?: ChildGender;
  guardian_full_name: string;
  guardian_phone?: string;
  guardian_email?: string;
  contracted_minutes: number;
  photo_url?: string;
  amount_paid_cents?: number;
  payment_method?: "pix" | "dinheiro" | "cartao";
  partner_id?: string | null;
}
