export type AssetCondition = "good" | "attention" | "broken";
export type MaintenanceType = "preventive" | "corrective";
export type MaintenanceStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "overdue"
  | "canceled";

export interface Asset {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  condition: AssetCondition;
  active: boolean;
  notes: string | null;
  next_maintenance_date: string | null;
}

export interface AssetInput {
  name: string;
  category?: string;
  location?: string;
  serial_number?: string;
  purchase_date?: string;
  condition?: AssetCondition;
  notes?: string;
}

export interface Maintenance {
  id: string;
  asset_id: string;
  asset_name: string;
  type: MaintenanceType;
  scheduled_date: string;
  status: MaintenanceStatus;
  completed_at: string | null;
  cost_cents: number;
  performed_by: string | null;
  notes: string | null;
}

export interface MaintenanceInput {
  asset_id: string;
  type: MaintenanceType;
  scheduled_date: string;
  notes?: string;
}
