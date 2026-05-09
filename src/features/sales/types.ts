export type TicketOrderStatus =
  | "pending"
  | "paid"
  | "canceled"
  | "expired"
  | "refunded";

export interface TicketOffer {
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

export interface TicketOfferInput {
  name: string;
  description?: string;
  duration_minutes?: number;
  price_cents: number;
  external_id?: string;
  active?: boolean;
  display_order?: number;
}

export interface TicketOrder {
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
  status: TicketOrderStatus;
  asaas_checkout_id: string | null;
  asaas_payment_id: string | null;
  checkout_url: string | null;
  paid_at: string | null;
  redeemed_session_id: string | null;
  qr_code_token: string;
  notes: string | null;
  created_at: string;
}

export interface CheckoutInput {
  offer_id: string;
  guardian_name: string;
  guardian_email: string;
  guardian_document: string; // CPF/CNPJ
  guardian_phone?: string;
  child_name?: string;
}

export interface PublicOrderView {
  id: string;
  offer_name: string;
  offer_duration_minutes: number | null;
  guardian_name: string;
  child_name: string | null;
  amount_cents: number;
  status: TicketOrderStatus;
  paid_at: string | null;
  checkout_url: string | null;
}
