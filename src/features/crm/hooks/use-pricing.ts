import { useSetting } from "@/features/settings/hooks/use-setting";

export interface PricingTier {
  minutes: number;
  price_cents: number;
}

export interface PricingConfig {
  tiers: PricingTier[];
  overage_per_minute_cents: number;
  overage_note: string;
}

export const PRICING_CONFIG_KEY = "pricing_config";

/** Fallback usado quando a setting nao existe no banco. Mantem o sistema
 *  funcionando mesmo se o seed ainda nao tiver rodado. */
export const DEFAULT_PRICING: PricingConfig = {
  tiers: [
    { minutes: 20, price_cents: 3500 },
    { minutes: 30, price_cents: 4000 },
    { minutes: 60, price_cents: 6000 },
  ],
  overage_per_minute_cents: 100,
  overage_note:
    "Apos o termino sera cobrado R$ 1,00 por minuto excedente. Fique atento.",
};

export function usePricing() {
  return useSetting<PricingConfig>(PRICING_CONFIG_KEY, DEFAULT_PRICING);
}
