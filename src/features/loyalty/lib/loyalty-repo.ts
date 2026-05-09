import { supabase } from "@/lib/supabase";
import type {
  LoyaltyAccount,
  LoyaltyReward,
  LoyaltyRewardInput,
  LoyaltyTransaction,
} from "../types";

export interface LoyaltyRepo {
  listRewards(): Promise<LoyaltyReward[]>;
  createReward(input: LoyaltyRewardInput): Promise<LoyaltyReward>;
  setRewardActive(id: string, active: boolean): Promise<void>;
  listAccounts(): Promise<LoyaltyAccount[]>;
  listRecentTransactions(limit?: number): Promise<LoyaltyTransaction[]>;
  /** Award points (server-side RPC). */
  awardPoints(
    guardianId: string,
    points: number,
    reason: string,
    options?: { session_id?: string; product_sale_id?: string }
  ): Promise<void>;
  redeemReward(accountId: string, rewardId: string): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  cost_points: number;
  active: boolean;
}

interface AccountRow {
  id: string;
  guardian_id: string;
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
  updated_at: string;
  guardians: {
    full_name: string;
    phone: string | null;
  } | null;
}

interface TransactionRow {
  id: string;
  account_id: string;
  delta: number;
  reason: string;
  created_at: string;
  loyalty_accounts: {
    guardians: { full_name: string } | null;
  } | null;
}

const REWARD_SELECT = "id, name, description, cost_points, active";
const ACCOUNT_SELECT =
  "id, guardian_id, points_balance, total_earned, total_redeemed, updated_at, guardians:guardians(full_name, phone)";
const TX_SELECT =
  "id, account_id, delta, reason, created_at, loyalty_accounts:loyalty_accounts(guardians:guardians(full_name))";

export const supabaseLoyaltyRepo: LoyaltyRepo = {
  async listRewards() {
    const { data, error } = await supabase
      .from("loyalty_rewards")
      .select(REWARD_SELECT)
      .order("cost_points");
    if (error) throw error;
    return data as unknown as RewardRow[];
  },
  async createReward(input) {
    const { data, error } = await supabase
      .from("loyalty_rewards")
      .insert({
        name: input.name,
        description: input.description ?? null,
        cost_points: input.cost_points,
        active: input.active ?? true,
      })
      .select(REWARD_SELECT)
      .single();
    if (error) throw error;
    return data as unknown as RewardRow;
  },
  async setRewardActive(id, active) {
    const { error } = await supabase
      .from("loyalty_rewards")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  },
  async listAccounts() {
    const { data, error } = await supabase
      .from("loyalty_accounts")
      .select(ACCOUNT_SELECT)
      .order("points_balance", { ascending: false });
    if (error) throw error;
    return (data as unknown as AccountRow[]).map((r) => ({
      id: r.id,
      guardian_id: r.guardian_id,
      guardian_name: r.guardians?.full_name ?? "(removido)",
      guardian_phone: r.guardians?.phone ?? null,
      points_balance: r.points_balance,
      total_earned: r.total_earned,
      total_redeemed: r.total_redeemed,
      updated_at: r.updated_at,
    }));
  },
  async listRecentTransactions(limit = 20) {
    const { data, error } = await supabase
      .from("loyalty_transactions")
      .select(TX_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as TransactionRow[]).map((r) => ({
      id: r.id,
      account_id: r.account_id,
      guardian_name: r.loyalty_accounts?.guardians?.full_name ?? "(?)",
      delta: r.delta,
      reason: r.reason,
      created_at: r.created_at,
    }));
  },
  async awardPoints(guardianId, points, reason, options) {
    const { error } = await supabase.rpc("award_loyalty_points", {
      p_guardian_id: guardianId,
      p_points: points,
      p_reason: reason,
      p_session_id: options?.session_id ?? undefined,
      p_product_sale_id: options?.product_sale_id ?? undefined,
    });
    if (error) throw error;
  },
  async redeemReward(accountId, rewardId) {
    const { error } = await supabase.rpc("redeem_loyalty_reward", {
      p_account_id: accountId,
      p_reward_id: rewardId,
    });
    if (error) throw error;
  },
  subscribe(onChange) {
    const ch1 = supabase
      .channel(`loyalty-accounts-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loyalty_accounts" },
        onChange
      )
      .subscribe();
    const ch2 = supabase
      .channel(`loyalty-transactions-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loyalty_transactions" },
        onChange
      )
      .subscribe();
    const ch3 = supabase
      .channel(`loyalty-rewards-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loyalty_rewards" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  },
};

export const loyaltyRepo: LoyaltyRepo = supabaseLoyaltyRepo;
