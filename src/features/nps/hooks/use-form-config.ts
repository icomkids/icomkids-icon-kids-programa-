import { useSetting } from "@/features/settings/hooks/use-setting";

export interface FeedbackFormConfig {
  q_last_car_label: string;
  q_intends_label: string;
  q_offers_label: string;
}

export const FORM_CONFIG_KEY = "feedback_form_config";

export const DEFAULT_FORM_CONFIG: FeedbackFormConfig = {
  q_last_car_label: "Ha quanto tempo voce comprou seu carro atual?",
  q_intends_label: "Pretende trocar de carro nos proximos 12 meses?",
  q_offers_label:
    "Posso te mandar ofertas exclusivas da iCOM Motos sobre carros pra familia?",
};

export function useFeedbackFormConfig() {
  return useSetting<FeedbackFormConfig>(FORM_CONFIG_KEY, DEFAULT_FORM_CONFIG);
}
