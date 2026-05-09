// Module 5 (Vendas online) — adiado para o final do projeto.
// Enquanto a migration ticket_offers/ticket_orders nao for aplicada,
// database.types.ts nao conhece estas tabelas e o supabase tipado da
// erro. Usamos um client `any` aqui temporariamente. Quando ativar
// o modulo: aplicar a migration, rodar `supabase gen types --linked`,
// e remover o cast abaixo voltando a usar o supabase tipado.
import { supabase as supabaseClient } from "@/lib/supabase";
import type {
  CheckoutInput,
  PublicOrderView,
  TicketOffer,
  TicketOfferInput,
  TicketOrder,
} from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;

export interface SalesRepo {
  /** Active offers, ordered by display_order — used by /loja. */
  listActiveOffers(): Promise<TicketOffer[]>;
  /** All offers, owner view. */
  listOffers(): Promise<TicketOffer[]>;
  createOffer(input: TicketOfferInput): Promise<TicketOffer>;
  updateOffer(
    id: string,
    patch: Partial<TicketOfferInput>
  ): Promise<TicketOffer>;
  setOfferActive(id: string, active: boolean): Promise<void>;
  listRecentOrders(limit?: number): Promise<TicketOrder[]>;
  /** Public — uses the security-definer RPC. */
  getOrderByToken(token: string): Promise<PublicOrderView | null>;
  /** Calls the edge function which creates a Stripe Checkout session. */
  createCheckout(input: CheckoutInput): Promise<{
    ok: boolean;
    checkout_url?: string;
    qr_code_token?: string;
    error?: string;
  }>;
  subscribe(onChange: () => void): () => void;
}

interface OfferRow {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price_cents: number;
  external_id: string | null;
  active: boolean;
  display_order: number;
  notes: string | null;
}

interface OrderRow {
  id: string;
  offer_id: string | null;
  offer_name: string;
  offer_duration_minutes: number | null;
  guardian_name: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_document: string | null;
  child_name: string | null;
  amount_cents: number;
  status: TicketOrder["status"];
  asaas_checkout_id: string | null;
  asaas_payment_id: string | null;
  checkout_url: string | null;
  paid_at: string | null;
  redeemed_session_id: string | null;
  qr_code_token: string;
  notes: string | null;
  created_at: string;
}

const OFFER_SELECT =
  "id, name, description, duration_minutes, price_cents, external_id, active, display_order, notes";
const ORDER_SELECT =
  "id, offer_id, offer_name, offer_duration_minutes, guardian_name, guardian_phone, guardian_email, guardian_document, child_name, amount_cents, status, asaas_checkout_id, asaas_payment_id, checkout_url, paid_at, redeemed_session_id, qr_code_token, notes, created_at";

export const supabaseSalesRepo: SalesRepo = {
  async listActiveOffers() {
    const { data, error } = await supabase
      .from("ticket_offers")
      .select(OFFER_SELECT)
      .eq("active", true)
      .order("display_order")
      .order("price_cents");
    if (error) throw error;
    return data as unknown as OfferRow[];
  },
  async listOffers() {
    const { data, error } = await supabase
      .from("ticket_offers")
      .select(OFFER_SELECT)
      .order("display_order")
      .order("price_cents");
    if (error) throw error;
    return data as unknown as OfferRow[];
  },
  async createOffer(input) {
    const { data, error } = await supabase
      .from("ticket_offers")
      .insert({
        name: input.name,
        description: input.description ?? null,
        duration_minutes: input.duration_minutes ?? null,
        price_cents: input.price_cents,
        external_id: input.external_id ?? null,
        active: input.active ?? true,
        display_order: input.display_order ?? 0,
      })
      .select(OFFER_SELECT)
      .single();
    if (error) throw error;
    return data as unknown as OfferRow;
  },
  async updateOffer(id, patch) {
    const { data, error } = await supabase
      .from("ticket_offers")
      .update(patch)
      .eq("id", id)
      .select(OFFER_SELECT)
      .single();
    if (error) throw error;
    return data as unknown as OfferRow;
  },
  async setOfferActive(id, active) {
    const { error } = await supabase
      .from("ticket_offers")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  },
  async listRecentOrders(limit = 50) {
    const { data, error } = await supabase
      .from("ticket_orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as unknown as OrderRow[];
  },
  async getOrderByToken(token) {
    const { data, error } = await supabase.rpc("get_ticket_order_by_token", {
      p_token: token,
    });
    if (error) throw error;
    const row = (data as PublicOrderView[] | null)?.[0];
    return row ?? null;
  },
  async createCheckout(input) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { data, error } = await supabase.functions.invoke("create-asaas-checkout", {
      body: {
        ...input,
        success_url: origin ? `${origin}/loja/sucesso` : undefined,
        cancel_url: origin ? `${origin}/loja?canceled=1` : undefined,
      },
    });
    if (error) return { ok: false, error: error.message };
    if (!data?.ok)
      return { ok: false, error: data?.error ?? "falha desconhecida" };
    return {
      ok: true,
      checkout_url: data.checkout_url,
      qr_code_token: data.qr_code_token,
    };
  },
  subscribe(onChange) {
    const ch1 = supabase
      .channel(`ticket-offers-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_offers" },
        onChange
      )
      .subscribe();
    const ch2 = supabase
      .channel(`ticket-orders-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_orders" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  },
};

export const salesRepo: SalesRepo = supabaseSalesRepo;
