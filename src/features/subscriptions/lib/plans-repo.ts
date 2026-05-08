import { supabase } from "@/lib/supabase";
import type { SubscriptionPlan, SubscriptionPlanInput } from "../types";

export interface PlansRepo {
  list(): Promise<SubscriptionPlan[]>;
  listActive(): Promise<SubscriptionPlan[]>;
  create(input: SubscriptionPlanInput): Promise<SubscriptionPlan>;
  setActive(id: string, active: boolean): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  monthly_cents: number;
  included_minutes: number;
  discount_pct: number | string;
  active: boolean;
}

const SELECT =
  "id, name, description, monthly_cents, included_minutes, discount_pct, active";

function rowToPlan(row: PlanRow): SubscriptionPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    monthly_cents: row.monthly_cents,
    included_minutes: row.included_minutes,
    discount_pct:
      typeof row.discount_pct === "string"
        ? parseFloat(row.discount_pct)
        : row.discount_pct,
    active: row.active,
  };
}

// ============================================================================
// Mock
// ============================================================================

let mockSeed = 0;
const nextId = () => `mock-plan-${++mockSeed}`;

export let mockPlans: SubscriptionPlan[] = [
  {
    id: nextId(),
    name: "Mensal Diversao",
    description: "10h/mes + 10% off em produtos da lanchonete",
    monthly_cents: 14900,
    included_minutes: 600,
    discount_pct: 10,
    active: true,
  },
  {
    id: nextId(),
    name: "Mensal Premium",
    description: "Ilimitado + acesso prioritario + 20% em produtos",
    monthly_cents: 29900,
    included_minutes: 0,
    discount_pct: 20,
    active: true,
  },
];

const mockSubscribers = new Set<() => void>();
const notify = () => mockSubscribers.forEach((fn) => fn());

export const mockPlansRepo: PlansRepo = {
  async list() {
    return [...mockPlans].sort((a, b) => a.monthly_cents - b.monthly_cents);
  },
  async listActive() {
    return mockPlans
      .filter((p) => p.active)
      .sort((a, b) => a.monthly_cents - b.monthly_cents);
  },
  async create(input) {
    const plan: SubscriptionPlan = {
      id: nextId(),
      name: input.name,
      description: input.description ?? null,
      monthly_cents: input.monthly_cents,
      included_minutes: input.included_minutes ?? 0,
      discount_pct: input.discount_pct ?? 0,
      active: input.active ?? true,
    };
    mockPlans = [...mockPlans, plan];
    notify();
    return plan;
  },
  async setActive(id, active) {
    mockPlans = mockPlans.map((p) => (p.id === id ? { ...p, active } : p));
    notify();
  },
  subscribe(onChange) {
    mockSubscribers.add(onChange);
    return () => mockSubscribers.delete(onChange);
  },
};

// ============================================================================
// Supabase
// ============================================================================

export const supabasePlansRepo: PlansRepo = {
  async list() {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select(SELECT)
      .order("monthly_cents");
    if (error) throw error;
    return (data as unknown as PlanRow[]).map(rowToPlan);
  },
  async listActive() {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select(SELECT)
      .eq("active", true)
      .order("monthly_cents");
    if (error) throw error;
    return (data as unknown as PlanRow[]).map(rowToPlan);
  },
  async create(input) {
    const { data, error } = await supabase
      .from("subscription_plans")
      .insert({
        name: input.name,
        description: input.description ?? null,
        monthly_cents: input.monthly_cents,
        included_minutes: input.included_minutes ?? 0,
        discount_pct: input.discount_pct ?? 0,
        active: input.active ?? true,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToPlan(data as unknown as PlanRow);
  },
  async setActive(id, active) {
    const { error } = await supabase
      .from("subscription_plans")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`subscription-plans-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscription_plans" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const plansRepo: PlansRepo = useMock ? mockPlansRepo : supabasePlansRepo;
