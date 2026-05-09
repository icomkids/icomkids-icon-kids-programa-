export interface TermTemplate {
  id: string;
  version: number;
  title: string;
  body: string;
  active: boolean;
}

export interface TermSignature {
  id: string;
  token: string;
  template_id: string | null;
  template_version: number | null;
  guardian_name: string;
  guardian_phone: string | null;
  guardian_document: string | null;
  child_name: string | null;
  signature_data_url: string | null;
  signed_at: string | null;
  ip: string | null;
  user_agent: string | null;
  notes: string | null;
  created_at: string;
}

export interface NewSignatureRequest {
  guardian_name: string;
  guardian_phone?: string;
  child_name?: string;
}

export interface PublicTermView {
  id: string;
  guardian_name: string;
  guardian_phone: string | null;
  child_name: string | null;
  signed_at: string | null;
  template_title: string;
  template_body: string;
  template_version: number;
}
