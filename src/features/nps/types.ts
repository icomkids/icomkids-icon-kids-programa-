export type NpsClassification = "detractor" | "passive" | "promoter";

export type QLastCarPurchase = "lt_1y" | "1_3y" | "gt_3y" | "no_car";
export type QIntendsTrade = "yes" | "maybe" | "no";
export type QOffersOptin = "whatsapp" | "email" | "no";

export interface NpsSurvey {
  id: string;
  token: string;
  session_id: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  child_name: string | null;
  stars: number | null;
  score: number | null;
  classification: NpsClassification | null;
  comment: string | null;
  q_last_car_purchase: QLastCarPurchase | null;
  q_intends_trade: QIntendsTrade | null;
  q_offers_optin: QOffersOptin | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface PublicNpsView {
  id: string;
  child_name: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  stars: number | null;
  score: number | null;
  comment: string | null;
  q_last_car_purchase: QLastCarPurchase | null;
  q_intends_trade: QIntendsTrade | null;
  q_offers_optin: QOffersOptin | null;
  responded_at: string | null;
}

export interface FeedbackResponseInput {
  stars: number;
  comment?: string;
  guardian_email?: string;
  q_last_car_purchase?: QLastCarPurchase;
  q_intends_trade?: QIntendsTrade;
  q_offers_optin?: QOffersOptin;
}
