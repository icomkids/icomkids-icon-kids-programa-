import { supabase } from "@/lib/supabase";
import type {
  StaffCommissionRow,
  StaffMember,
  StaffMemberInput,
  StaffShift,
  StaffShiftInput,
  ShiftStatus,
} from "../types";

export interface StaffRepo {
  listMembers(): Promise<StaffMember[]>;
  createMember(input: StaffMemberInput): Promise<StaffMember>;
  setMemberActive(id: string, active: boolean): Promise<void>;
  listShiftsBetween(fromDate: string, toDate: string): Promise<StaffShift[]>;
  createShift(input: StaffShiftInput): Promise<StaffShift>;
  setShiftStatus(id: string, status: ShiftStatus): Promise<void>;
  deleteShift(id: string): Promise<void>;
  /** Server-side commission calculation across [from, to). */
  commissionsFor(from: string, to: string): Promise<StaffCommissionRow[]>;
  subscribe(onChange: () => void): () => void;
}

interface MemberRow {
  id: string;
  full_name: string;
  role_label: string | null;
  phone: string | null;
  email: string | null;
  commission_pct: number | string;
  active: boolean;
  profile_id: string | null;
  notes: string | null;
}

interface ShiftRow {
  id: string;
  member_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  notes: string | null;
}

const MEMBER_SELECT =
  "id, full_name, role_label, phone, email, commission_pct, active, profile_id, notes";
const SHIFT_SELECT =
  "id, member_id, scheduled_date, start_time, end_time, status, notes";

function rowToMember(r: MemberRow): StaffMember {
  return {
    id: r.id,
    full_name: r.full_name,
    role_label: r.role_label,
    phone: r.phone,
    email: r.email,
    commission_pct:
      typeof r.commission_pct === "string"
        ? parseFloat(r.commission_pct)
        : r.commission_pct,
    active: r.active,
    profile_id: r.profile_id,
    notes: r.notes,
  };
}

function rowToShift(r: ShiftRow): StaffShift {
  return { ...r };
}

export const supabaseStaffRepo: StaffRepo = {
  async listMembers() {
    const { data, error } = await supabase
      .from("staff_members")
      .select(MEMBER_SELECT)
      .order("full_name");
    if (error) throw error;
    return (data as unknown as MemberRow[]).map(rowToMember);
  },
  async createMember(input) {
    const { data, error } = await supabase
      .from("staff_members")
      .insert({
        full_name: input.full_name,
        role_label: input.role_label ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        commission_pct: input.commission_pct ?? 0,
        active: input.active ?? true,
        notes: input.notes ?? null,
      })
      .select(MEMBER_SELECT)
      .single();
    if (error) throw error;
    return rowToMember(data as unknown as MemberRow);
  },
  async setMemberActive(id, active) {
    const { error } = await supabase
      .from("staff_members")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  },
  async listShiftsBetween(fromDate, toDate) {
    const { data, error } = await supabase
      .from("staff_shifts")
      .select(SHIFT_SELECT)
      .gte("scheduled_date", fromDate)
      .lte("scheduled_date", toDate)
      .order("scheduled_date")
      .order("start_time");
    if (error) throw error;
    return (data as unknown as ShiftRow[]).map(rowToShift);
  },
  async createShift(input) {
    const { data, error } = await supabase
      .from("staff_shifts")
      .insert({
        member_id: input.member_id,
        scheduled_date: input.scheduled_date,
        start_time: input.start_time,
        end_time: input.end_time,
        notes: input.notes ?? null,
      })
      .select(SHIFT_SELECT)
      .single();
    if (error) throw error;
    return rowToShift(data as unknown as ShiftRow);
  },
  async setShiftStatus(id, status) {
    const { error } = await supabase
      .from("staff_shifts")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },
  async deleteShift(id) {
    const { error } = await supabase.from("staff_shifts").delete().eq("id", id);
    if (error) throw error;
  },
  async commissionsFor(from, to) {
    const { data, error } = await supabase.rpc(
      "staff_commissions_for_period",
      { p_from: from, p_to: to }
    );
    if (error) throw error;
    interface CommissionRow {
      member_id: string;
      full_name: string;
      role_label: string;
      commission_pct: number | string;
      attributed_cents: number | string;
      commission_cents: number | string;
    }
    return ((data ?? []) as CommissionRow[]).map((r) => ({
      member_id: r.member_id,
      full_name: r.full_name,
      role_label: r.role_label,
      commission_pct:
        typeof r.commission_pct === "string"
          ? parseFloat(r.commission_pct)
          : (r.commission_pct as number),
      attributed_cents: Number(r.attributed_cents) || 0,
      commission_cents: Number(r.commission_cents) || 0,
    }));
  },
  subscribe(onChange) {
    const ch1 = supabase
      .channel(`staff-members-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_members" },
        onChange
      )
      .subscribe();
    const ch2 = supabase
      .channel(`staff-shifts-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_shifts" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  },
};

export const staffRepo: StaffRepo = supabaseStaffRepo;
