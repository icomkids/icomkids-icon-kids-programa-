export type NpsClassification = "detractor" | "passive" | "promoter";

export interface NpsSurvey {
  id: string;
  token: string;
  session_id: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  child_name: string | null;
  score: number | null;
  classification: NpsClassification | null;
  comment: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface PublicNpsView {
  id: string;
  child_name: string | null;
  guardian_name: string | null;
  score: number | null;
  comment: string | null;
  responded_at: string | null;
}
