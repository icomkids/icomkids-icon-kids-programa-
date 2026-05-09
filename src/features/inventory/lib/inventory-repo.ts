import { supabase } from "@/lib/supabase";
import type {
  Asset,
  AssetInput,
  Maintenance,
  MaintenanceInput,
  MaintenanceStatus,
} from "../types";

export interface InventoryRepo {
  listAssets(): Promise<Asset[]>;
  createAsset(input: AssetInput): Promise<Asset>;
  setAssetActive(id: string, active: boolean): Promise<void>;
  /** Lists pending (scheduled/in_progress/overdue) and recent done. */
  listMaintenance(): Promise<{
    pending: Maintenance[];
    recent: Maintenance[];
  }>;
  scheduleMaintenance(input: MaintenanceInput): Promise<Maintenance>;
  setMaintenanceStatus(
    id: string,
    status: MaintenanceStatus,
    options?: { cost_cents?: number; performed_by?: string }
  ): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface AssetRow {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  condition: Asset["condition"];
  active: boolean;
  notes: string | null;
}

interface MaintenanceRow {
  id: string;
  asset_id: string;
  type: Maintenance["type"];
  scheduled_date: string;
  status: MaintenanceStatus;
  completed_at: string | null;
  cost_cents: number;
  performed_by: string | null;
  notes: string | null;
  assets: { id: string; name: string } | null;
}

const ASSET_SELECT =
  "id, name, category, location, serial_number, purchase_date, condition, active, notes";

const MAINT_SELECT =
  "id, asset_id, type, scheduled_date, status, completed_at, cost_cents, performed_by, notes, assets:assets(id, name)";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function rowToMaintenance(row: MaintenanceRow): Maintenance {
  return {
    id: row.id,
    asset_id: row.asset_id,
    asset_name: row.assets?.name ?? "(removido)",
    type: row.type,
    scheduled_date: row.scheduled_date,
    status: row.status,
    completed_at: row.completed_at,
    cost_cents: row.cost_cents,
    performed_by: row.performed_by,
    notes: row.notes,
  };
}

export const supabaseInventoryRepo: InventoryRepo = {
  async listAssets() {
    const { data: assets, error } = await supabase
      .from("assets")
      .select(ASSET_SELECT)
      .order("name");
    if (error) throw error;
    const list = assets as unknown as AssetRow[];

    if (list.length === 0) return [];

    const { data: maintRows, error: mErr } = await supabase
      .from("asset_maintenance")
      .select("asset_id, scheduled_date, status")
      .in(
        "asset_id",
        list.map((a) => a.id)
      )
      .in("status", ["scheduled", "in_progress", "overdue"])
      .order("scheduled_date");
    if (mErr) throw mErr;

    const earliestByAsset = new Map<string, string>();
    for (const m of maintRows ?? []) {
      if (!earliestByAsset.has(m.asset_id)) {
        earliestByAsset.set(m.asset_id, m.scheduled_date);
      }
    }

    return list.map((a) => ({
      ...a,
      next_maintenance_date: earliestByAsset.get(a.id) ?? null,
    }));
  },
  async createAsset(input) {
    const { data, error } = await supabase
      .from("assets")
      .insert({
        name: input.name,
        category: input.category ?? null,
        location: input.location ?? null,
        serial_number: input.serial_number ?? null,
        purchase_date: input.purchase_date ?? null,
        condition: input.condition ?? "good",
        notes: input.notes ?? null,
      })
      .select(ASSET_SELECT)
      .single();
    if (error) throw error;
    return { ...(data as unknown as AssetRow), next_maintenance_date: null };
  },
  async setAssetActive(id, active) {
    const { error } = await supabase
      .from("assets")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  },
  async listMaintenance() {
    const today = todayIso();

    // Auto-mark overdue: any 'scheduled' row with scheduled_date < today.
    await supabase
      .from("asset_maintenance")
      .update({ status: "overdue" })
      .lt("scheduled_date", today)
      .eq("status", "scheduled");

    const [{ data: pending, error: pErr }, { data: recent, error: rErr }] =
      await Promise.all([
        supabase
          .from("asset_maintenance")
          .select(MAINT_SELECT)
          .in("status", ["scheduled", "in_progress", "overdue"])
          .order("scheduled_date"),
        supabase
          .from("asset_maintenance")
          .select(MAINT_SELECT)
          .in("status", ["completed", "canceled"])
          .order("completed_at", { ascending: false, nullsFirst: false })
          .limit(20),
      ]);
    if (pErr) throw pErr;
    if (rErr) throw rErr;
    return {
      pending: (pending as unknown as MaintenanceRow[]).map(rowToMaintenance),
      recent: (recent as unknown as MaintenanceRow[]).map(rowToMaintenance),
    };
  },
  async scheduleMaintenance(input) {
    const { data, error } = await supabase
      .from("asset_maintenance")
      .insert({
        asset_id: input.asset_id,
        type: input.type,
        scheduled_date: input.scheduled_date,
        notes: input.notes ?? null,
      })
      .select(MAINT_SELECT)
      .single();
    if (error) throw error;
    return rowToMaintenance(data as unknown as MaintenanceRow);
  },
  async setMaintenanceStatus(id, status, options) {
    const patch: {
      status: MaintenanceStatus;
      completed_at?: string;
      cost_cents?: number;
      performed_by?: string;
    } = { status };
    if (status === "completed") {
      patch.completed_at = new Date().toISOString();
      if (options?.cost_cents != null) patch.cost_cents = options.cost_cents;
      if (options?.performed_by) patch.performed_by = options.performed_by;
    }
    const { error } = await supabase
      .from("asset_maintenance")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  },
  subscribe(onChange) {
    const ch1 = supabase
      .channel(`assets-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assets" },
        onChange
      )
      .subscribe();
    const ch2 = supabase
      .channel(`asset-maintenance-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asset_maintenance" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  },
};

export const inventoryRepo: InventoryRepo = supabaseInventoryRepo;
