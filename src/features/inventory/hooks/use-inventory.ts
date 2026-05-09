import { useCallback, useEffect, useState } from "react";
import { inventoryRepo } from "../lib/inventory-repo";
import type {
  Asset,
  AssetInput,
  Maintenance,
  MaintenanceInput,
  MaintenanceStatus,
} from "../types";

export function useInventory() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pending, setPending] = useState<Maintenance[]>([]);
  const [recent, setRecent] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([
        inventoryRepo.listAssets(),
        inventoryRepo.listMaintenance(),
      ]);
      setAssets(a);
      setPending(m.pending);
      setRecent(m.recent);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return inventoryRepo.subscribe(refresh);
  }, [refresh]);

  const createAsset = useCallback(
    async (input: AssetInput) => {
      const a = await inventoryRepo.createAsset(input);
      await refresh();
      return a;
    },
    [refresh]
  );

  const setAssetActive = useCallback(
    async (id: string, active: boolean) => {
      await inventoryRepo.setAssetActive(id, active);
      await refresh();
    },
    [refresh]
  );

  const scheduleMaintenance = useCallback(
    async (input: MaintenanceInput) => {
      const m = await inventoryRepo.scheduleMaintenance(input);
      await refresh();
      return m;
    },
    [refresh]
  );

  const completeMaintenance = useCallback(
    async (id: string, options?: { cost_cents?: number; performed_by?: string }) => {
      await inventoryRepo.setMaintenanceStatus(id, "completed", options);
      await refresh();
    },
    [refresh]
  );

  const setMaintenanceStatus = useCallback(
    async (id: string, status: MaintenanceStatus) => {
      await inventoryRepo.setMaintenanceStatus(id, status);
      await refresh();
    },
    [refresh]
  );

  return {
    assets,
    pending,
    recent,
    loading,
    error,
    createAsset,
    setAssetActive,
    scheduleMaintenance,
    completeMaintenance,
    setMaintenanceStatus,
    refresh,
  };
}
