import { useCallback, useEffect, useState } from "react";
import { appointmentsRepo } from "../lib/appointments-repo";
import type { Appointment, AppointmentInput, AppointmentStatus } from "../types";

export function useAppointments() {
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [closed, setClosed] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([
        appointmentsRepo.listUpcoming(),
        appointmentsRepo.listRecentClosed(30),
      ]);
      setUpcoming(u);
      setClosed(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return appointmentsRepo.subscribe(refresh);
  }, [refresh]);

  const create = useCallback(
    async (input: AppointmentInput) => {
      const created = await appointmentsRepo.create(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const setStatus = useCallback(
    async (id: string, status: AppointmentStatus) => {
      await appointmentsRepo.setStatus(id, status);
      await refresh();
    },
    [refresh]
  );

  return { upcoming, closed, loading, error, create, setStatus, refresh };
}
