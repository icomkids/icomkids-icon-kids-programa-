import { supabase } from "@/lib/supabase";
import { mockPlans } from "./plans-repo";
import type {
  Subscription,
  SubscriptionInput,
  SubscriptionPayment,
} from "../types";

export interface SubscriptionsRepo {
  list(): Promise<Subscription[]>;
  create(input: SubscriptionInput): Promise<Subscription>;
  cancel(id: string): Promise<void>;
  recordPayment(
    subscriptionId: string,
    amountCents: number,
    paymentMethod?: string
  ): Promise<SubscriptionPayment>;
  listPaymentsForSubscription(subscriptionId: string): Promise<SubscriptionPayment[]>;
  subscribe(onChange: () => void): () => void;
}

interface SubscriptionRow {
  id: string;
  plan_id: string;
  guardian_id: string;
  status: "active" | "paused" | "canceled" | "expired";
  starts_on: string;
  next_billing_on: string;
  canceled_at: string | null;
  notes: string | null;
  subscription_plans: {
    id: string;
    name: string;
    monthly_cents: number;
  } | null;
  guardians: {
    id: string;
    full_name: string;
  } | null;
}

const SUB_SELECT =
  "id, plan_id, guardian_id, status, starts_on, next_billing_on, canceled_at, notes, subscription_plans:subscription_plans(id, name, monthly_cents), guardians:guardians(id, full_name)";

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    plan_id: row.plan_id,
    plan_name: row.subscription_plans?.name ?? "(plano removido)",
    plan_monthly_cents: row.subscription_plans?.monthly_cents ?? 0,
    guardian_id: row.guardian_id,
    guardian_name: row.guardians?.full_name ?? "(responsavel removido)",
    status: row.status,
    starts_on: row.starts_on,
    next_billing_on: row.next_billing_on,
    canceled_at: row.canceled_at,
    notes: row.notes,
  };
}

function addOneMonth(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ============================================================================
// Mock
// ============================================================================

let mockSeed = 0;
const nextId = () => `mock-sub-${++mockSeed}`;

let mockSubscriptions: Subscription[] = [];
let mockPayments: SubscriptionPayment[] = [];
const mockSubscribers = new Set<() => void>();
const notify = () => mockSubscribers.forEach((fn) => fn());

export const mockSubscriptionsRepo: SubscriptionsRepo = {
  async list() {
    return [...mockSubscriptions].sort((a, b) =>
      a.guardian_name.localeCompare(b.guardian_name)
    );
  },
  async create(input) {
    const plan = mockPlans.find((p) => p.id === input.plan_id);
    const startsOn = input.starts_on ?? new Date().toISOString().slice(0, 10);
    const sub: Subscription = {
      id: nextId(),
      plan_id: input.plan_id,
      plan_name: plan?.name ?? "(plano)",
      plan_monthly_cents: plan?.monthly_cents ?? 0,
      guardian_id: input.guardian_id,
      guardian_name: "(responsavel)",
      status: "active",
      starts_on: startsOn,
      next_billing_on: input.next_billing_on ?? addOneMonth(startsOn),
      canceled_at: null,
      notes: input.notes ?? null,
    };
    mockSubscriptions = [...mockSubscriptions, sub];
    notify();
    return sub;
  },
  async cancel(id) {
    mockSubscriptions = mockSubscriptions.map((s) =>
      s.id === id
        ? { ...s, status: "canceled" as const, canceled_at: new Date().toISOString() }
        : s
    );
    notify();
  },
  async recordPayment(subscriptionId, amountCents, paymentMethod) {
    const payment: SubscriptionPayment = {
      id: `mock-pmt-${Math.random().toString(36).slice(2)}`,
      subscription_id: subscriptionId,
      amount_cents: amountCents,
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod ?? null,
      covers_period: null,
    };
    mockPayments = [payment, ...mockPayments];
    // Advance next_billing_on by one month
    mockSubscriptions = mockSubscriptions.map((s) =>
      s.id === subscriptionId
        ? { ...s, next_billing_on: addOneMonth(s.next_billing_on) }
        : s
    );
    notify();
    return payment;
  },
  async listPaymentsForSubscription(subscriptionId) {
    return mockPayments.filter((p) => p.subscription_id === subscriptionId);
  },
  subscribe(onChange) {
    mockSubscribers.add(onChange);
    return () => mockSubscribers.delete(onChange);
  },
};

// ============================================================================
// Supabase
// ============================================================================

export const supabaseSubscriptionsRepo: SubscriptionsRepo = {
  async list() {
    const { data, error } = await supabase
      .from("subscriptions")
      .select(SUB_SELECT)
      .order("status")
      .order("next_billing_on");
    if (error) throw error;
    return (data as unknown as SubscriptionRow[]).map(rowToSubscription);
  },
  async create(input) {
    const startsOn = input.starts_on ?? new Date().toISOString().slice(0, 10);
    const nextBilling = input.next_billing_on ?? addOneMonth(startsOn);
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        plan_id: input.plan_id,
        guardian_id: input.guardian_id,
        starts_on: startsOn,
        next_billing_on: nextBilling,
        notes: input.notes ?? null,
      })
      .select(SUB_SELECT)
      .single();
    if (error) throw error;
    return rowToSubscription(data as unknown as SubscriptionRow);
  },
  async cancel(id) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
  async recordPayment(subscriptionId, amountCents, paymentMethod) {
    const { data: payment, error } = await supabase
      .from("subscription_payments")
      .insert({
        subscription_id: subscriptionId,
        amount_cents: amountCents,
        payment_method: paymentMethod ?? null,
      })
      .select("id, subscription_id, amount_cents, paid_at, payment_method, covers_period")
      .single();
    if (error) throw error;

    // Advance next_billing_on by one month
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("next_billing_on")
      .eq("id", subscriptionId)
      .single();
    if (sub) {
      await supabase
        .from("subscriptions")
        .update({ next_billing_on: addOneMonth(sub.next_billing_on) })
        .eq("id", subscriptionId);
    }
    return payment as SubscriptionPayment;
  },
  async listPaymentsForSubscription(subscriptionId) {
    const { data, error } = await supabase
      .from("subscription_payments")
      .select("id, subscription_id, amount_cents, paid_at, payment_method, covers_period")
      .eq("subscription_id", subscriptionId)
      .order("paid_at", { ascending: false });
    if (error) throw error;
    return data as SubscriptionPayment[];
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`subscriptions-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const subscriptionsRepo: SubscriptionsRepo = useMock
  ? mockSubscriptionsRepo
  : supabaseSubscriptionsRepo;
