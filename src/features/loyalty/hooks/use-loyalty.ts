import { useCallback, useEffect, useState } from "react";
import { loyaltyRepo } from "../lib/loyalty-repo";
import type {
  LoyaltyAccount,
  LoyaltyReward,
  LoyaltyRewardInput,
  LoyaltyTransaction,
} from "../types";

export function useLoyalty() {
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r, a, t] = await Promise.all([
        loyaltyRepo.listRewards(),
        loyaltyRepo.listAccounts(),
        loyaltyRepo.listRecentTransactions(20),
      ]);
      setRewards(r);
      setAccounts(a);
      setTransactions(t);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar fidelidade");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return loyaltyRepo.subscribe(refresh);
  }, [refresh]);

  const createReward = useCallback(
    async (input: LoyaltyRewardInput) => {
      const r = await loyaltyRepo.createReward(input);
      await refresh();
      return r;
    },
    [refresh]
  );

  const setRewardActive = useCallback(
    async (id: string, active: boolean) => {
      await loyaltyRepo.setRewardActive(id, active);
      await refresh();
    },
    [refresh]
  );

  const redeemReward = useCallback(
    async (accountId: string, rewardId: string) => {
      await loyaltyRepo.redeemReward(accountId, rewardId);
      await refresh();
    },
    [refresh]
  );

  return {
    rewards,
    accounts,
    transactions,
    loading,
    error,
    createReward,
    setRewardActive,
    redeemReward,
    refresh,
  };
}
