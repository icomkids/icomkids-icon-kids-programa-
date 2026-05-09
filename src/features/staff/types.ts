export type ShiftStatus = "scheduled" | "completed" | "no_show" | "canceled";

export interface StaffMember {
  id: string;
  full_name: string;
  role_label: string | null;
  phone: string | null;
  email: string | null;
  commission_pct: number;
  active: boolean;
  profile_id: string | null;
  notes: string | null;
}

export interface StaffMemberInput {
  full_name: string;
  role_label?: string;
  phone?: string;
  email?: string;
  commission_pct?: number;
  active?: boolean;
  notes?: string;
}

export interface StaffShift {
  id: string;
  member_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  notes: string | null;
}

export interface StaffShiftInput {
  member_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface StaffCommissionRow {
  member_id: string;
  full_name: string;
  role_label: string | null;
  commission_pct: number;
  attributed_cents: number;
  commission_cents: number;
}
