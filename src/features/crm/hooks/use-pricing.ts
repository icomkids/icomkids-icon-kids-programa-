import { useSetting } from "@/features/settings/hooks/use-setting";

export interface PricingTier {
  minutes: number;
  price_cents: number;
}

export interface PricingConfig {
  tiers: PricingTier[];
  /** Fallback (centavos/min) usado quando session.amount_paid_cents = 0. */
  overage_per_minute_cents: number;
  /** Tolerancia em minutos antes de comecar a cobrar excedente. */
  grace_minutes: number;
  overage_note: string;
}

export const PRICING_CONFIG_KEY = "pricing_config";

/** Fallback usado quando a setting nao existe no banco. */
export const DEFAULT_PRICING: PricingConfig = {
  tiers: [
    { minutes: 20, price_cents: 3500 },
    { minutes: 30, price_cents: 4000 },
    { minutes: 60, price_cents: 5000 },
  ],
  overage_per_minute_cents: 100,
  grace_minutes: 2,
  overage_note:
    "Apos o tempo contratado, 2 min de tolerancia. Depois, cobranca proporcional ao valor pago (por minuto excedente).",
};

export function usePricing() {
  return useSetting<PricingConfig>(PRICING_CONFIG_KEY, DEFAULT_PRICING);
}
