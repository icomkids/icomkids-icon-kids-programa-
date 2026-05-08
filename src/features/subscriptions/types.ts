export type SubscriptionStatus = "active" | "paused" | "canceled" | "expired";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_cents: number;
  included_minutes: number;
  discount_pct: number;
  active: boolean;
}

export interface SubscriptionPlanInput {
  name: string;
  description?: string;
  monthly_cents: number;
  included_minutes?: number;
  discount_pct?: number;
  active?: boolean;
}

export interface Subscription {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_monthly_cents: number;
  guardian_id: string;
  guardian_name: string;
  status: SubscriptionStatus;
  starts_on: string;
  next_billing_on: string;
  canceled_at: string | null;
  notes: string | null;
}

export interface SubscriptionInput {
  plan_id: string;
  guardian_id: string;
  starts_on?: string;
  next_billing_on?: string;
  notes?: string;
}

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  amount_cents: number;
  paid_at: string;
  payment_method: string | null;
  covers_period: string | null;
}
