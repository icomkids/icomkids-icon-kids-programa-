import { useCallback, useEffect, useState } from "react";
import { staffRepo } from "../lib/staff-repo";
import type {
  ShiftStatus,
  StaffCommissionRow,
  StaffMember,
  StaffMemberInput,
  StaffShift,
  StaffShiftInput,
} from "../types";

function startOfMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function nextMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useStaff() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [commissions, setCommissions] = useState<StaffCommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([
        staffRepo.listMembers(),
        staffRepo.commissionsFor(startOfMonthISO(), nextMonthISO()),
      ]);
      setMembers(m);
      setCommissions(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar equipe");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return staffRepo.subscribe(refresh);
  }, [refresh]);

  const create = useCallback(
    async (input: StaffMemberInput) => {
      const m = await staffRepo.createMember(input);
      await refresh();
      return m;
    },
    [refresh]
  );

  const setActive = useCallback(
    async (id: string, active: boolean) => {
      await staffRepo.setMemberActive(id, active);
      await refresh();
    },
    [refresh]
  );

  return { members, commissions, loading, error, create, setActive, refresh };
}

export function useShifts(fromDate: string, toDate: string) {
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await staffRepo.listShiftsBetween(fromDate, toDate);
      setShifts(s);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    refresh();
    return staffRepo.subscribe(refresh);
  }, [refresh]);

  const createShift = useCallback(
    async (input: StaffShiftInput) => {
      const s = await staffRepo.createShift(input);
      await refresh();
      return s;
    },
    [refresh]
  );

  const setShiftStatus = useCallback(
    async (id: string, status: ShiftStatus) => {
      await staffRepo.setShiftStatus(id, status);
      await refresh();
    },
    [refresh]
  );

  const deleteShift = useCallback(
    async (id: string) => {
      await staffRepo.deleteShift(id);
      await refresh();
    },
    [refresh]
  );

  return {
    shifts,
    loading,
    createShift,
    setShiftStatus,
    deleteShift,
    refresh,
  };
}
