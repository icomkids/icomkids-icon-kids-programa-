import { supabase } from "@/lib/supabase";
import type { NpsSurvey, PublicNpsView } from "../types";

export interface CreateSurveyInput {
  session_id?: string | null;
  guardian_name: string;
  guardian_phone: string;
  child_name?: string | null;
}

export interface NpsRepo {
  list(limit?: number): Promise<NpsSurvey[]>;
  create(input: CreateSurveyInput): Promise<NpsSurvey>;
  markSent(id: string): Promise<void>;
  /** Public — uses the security-definer RPC. */
  getByToken(token: string): Promise<PublicNpsView | null>;
  /** Public — uses the security-definer RPC. */
  submitResponse(token: string, score: number, comment?: string): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface SurveyRow {
  id: string;
  token: string;
  session_id: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  child_name: string | null;
  score: number | null;
  classification: NpsSurvey["classification"];
  comment: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

const SELECT =
  "id, token, session_id, guardian_name, guardian_phone, child_name, score, classification, comment, sent_at, responded_at, created_at";

function rowToSurvey(row: SurveyRow): NpsSurvey {
  return { ...row };
}

export const supabaseNpsRepo: NpsRepo = {
  async list(limit = 50) {
    const { data, error } = await supabase
      .from("nps_surveys")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as SurveyRow[]).map(rowToSurvey);
  },
  async create(input) {
    const { data, error } = await supabase
      .from("nps_surveys")
      .insert({
        session_id: input.session_id ?? null,
        guardian_name: input.guardian_name,
        guardian_phone: input.guardian_phone,
        child_name: input.child_name ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToSurvey(data as unknown as SurveyRow);
  },
  async markSent(id) {
    const { error } = await supabase
      .from("nps_surveys")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
  async getByToken(token) {
    const { data, error } = await supabase.rpc("get_nps_by_token", {
      p_token: token,
    });
    if (error) throw error;
    const row = (data as PublicNpsView[] | null)?.[0];
    return row ?? null;
  },
  async submitResponse(token, score, comment) {
    const { error } = await supabase.rpc("submit_nps_response", {
      p_token: token,
      p_score: score,
      p_comment: comment,
    });
    if (error) throw error;
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`nps-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nps_surveys" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

export const npsRepo: NpsRepo = supabaseNpsRepo;
