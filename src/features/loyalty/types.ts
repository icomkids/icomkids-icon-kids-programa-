export interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  cost_points: number;
  active: boolean;
}

export interface LoyaltyRewardInput {
  name: string;
  description?: string;
  cost_points: number;
  active?: boolean;
}

export interface LoyaltyAccount {
  id: string;
  guardian_id: string;
  guardian_name: string;
  guardian_phone: string | null;
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  account_id: string;
  guardian_name: string;
  delta: number;
  reason: string;
  created_at: string;
}
