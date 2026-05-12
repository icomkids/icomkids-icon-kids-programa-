import { supabase as supabaseClient } from "@/lib/supabase";
import type {
  FeedbackResponseInput,
  NpsSurvey,
  PublicNpsView,
} from "../types";

// Cast em `any` ate o usuario rodar `db push` da migration
// 20260512100000_feedback_survey_v2.sql + `supabase gen types --linked`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseClient as any;

export interface CreateSurveyInput {
  session_id?: string | null;
  guardian_name: string;
  guardian_phone: string | null;
  guardian_email?: string | null;
  child_name?: string | null;
}

export interface PublicFeedbackInput extends FeedbackResponseInput {
  guardian_name: string;
  guardian_phone?: string;
  child_name?: string;
}

export interface NpsRepo {
  list(limit?: number): Promise<NpsSurvey[]>;
  create(input: CreateSurveyInput): Promise<NpsSurvey>;
  markSent(id: string): Promise<void>;
  /** Public — uses the security-definer RPC. */
  getByToken(token: string): Promise<PublicNpsView | null>;
  /**
   * Public — uses the security-definer RPC submit_feedback_response.
   * Substituiu o antigo submit_nps_response (stars 1-5 em vez de score 0-10
   * + capturas de qualificacao de lead iCOM Motos).
   */
  submitFeedback(
    token: string,
    input: FeedbackResponseInput
  ): Promise<void>;
  /**
   * Public — formulario aberto em /avaliacao (sem token). Cria e responde
   * de uma vez.
   */
  submitPublic(input: PublicFeedbackInput): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface SurveyRow {
  id: string;
  token: string;
  session_id: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  child_name: string | null;
  stars: number | null;
  score: number | null;
  classification: NpsSurvey["classification"];
  comment: string | null;
  q_last_car_purchase: NpsSurvey["q_last_car_purchase"];
  q_intends_trade: NpsSurvey["q_intends_trade"];
  q_offers_optin: NpsSurvey["q_offers_optin"];
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

const SELECT =
  "id, token, session_id, guardian_name, guardian_phone, guardian_email, child_name, stars, score, classification, comment, q_last_car_purchase, q_intends_trade, q_offers_optin, sent_at, responded_at, created_at";

function rowToSurvey(row: SurveyRow): NpsSurvey {
  return { ...row };
}

export const supabaseNpsRepo: NpsRepo = {
  async list(limit = 100) {
    const { data, error } = await sb
      .from("nps_surveys")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as SurveyRow[]).map(rowToSurvey);
  },
  async create(input) {
    const { data, error } = await sb
      .from("nps_surveys")
      .insert({
        session_id: input.session_id ?? null,
        guardian_name: input.guardian_name,
        guardian_phone: input.guardian_phone ?? null,
        guardian_email: input.guardian_email ?? null,
        child_name: input.child_name ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToSurvey(data as SurveyRow);
  },
  async markSent(id) {
    const { error } = await sb
      .from("nps_surveys")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
  async getByToken(token) {
    const { data, error } = await sb.rpc("get_nps_by_token", {
      p_token: token,
    });
    if (error) throw error;
    const row = (data as PublicNpsView[] | null)?.[0];
    return row ?? null;
  },
  async submitFeedback(token, input) {
    const { error } = await sb.rpc("submit_feedback_response", {
      p_token: token,
      p_stars: input.stars,
      p_comment: input.comment ?? null,
      p_guardian_email: input.guardian_email ?? null,
      p_q_last_car_purchase: input.q_last_car_purchase ?? null,
      p_q_intends_trade: input.q_intends_trade ?? null,
      p_q_offers_optin: input.q_offers_optin ?? null,
    });
    if (error) throw error;
  },
  async submitPublic(input) {
    const { error } = await sb.rpc("submit_public_feedback", {
      p_guardian_name: input.guardian_name,
      p_guardian_phone: input.guardian_phone ?? null,
      p_guardian_email: input.guardian_email ?? null,
      p_child_name: input.child_name ?? null,
      p_stars: input.stars,
      p_comment: input.comment ?? null,
      p_q_last_car_purchase: input.q_last_car_purchase ?? null,
      p_q_intends_trade: input.q_intends_trade ?? null,
      p_q_offers_optin: input.q_offers_optin ?? null,
    });
    if (error) throw error;
  },
  subscribe(onChange) {
    const channel = sb
      .channel(`nps-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nps_surveys" },
        onChange
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  },
};

export const npsRepo: NpsRepo = supabaseNpsRepo;
