import { supabase } from "@/lib/supabase";
import type {
  NewSignatureRequest,
  PublicTermView,
  TermSignature,
  TermTemplate,
} from "../types";

export interface TermsRepo {
  getActiveTemplate(): Promise<TermTemplate | null>;
  saveTemplate(input: { title: string; body: string }): Promise<TermTemplate>;
  listSignatures(limit?: number): Promise<TermSignature[]>;
  createRequest(input: NewSignatureRequest): Promise<TermSignature>;
  /** Public — uses the security-definer RPC. */
  getByToken(token: string): Promise<PublicTermView | null>;
  /**
   * Public — uses the security-definer RPC.
   * O signatureDataUrl agora e opcional: o termo virou um checkbox
   * "li e aceito". O parametro continua aceitando data URL pra nao
   * quebrar fluxos antigos (assinatura manuscrita), mas o padrao do
   * sistema e null + marker textual.
   */
  submitSignature(
    token: string,
    signatureDataUrl: string | null,
    options?: { user_agent?: string; guardian_document?: string }
  ): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface TemplateRow {
  id: string;
  version: number;
  title: string;
  body: string;
  active: boolean;
}

interface SignatureRow {
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

const TEMPLATE_SELECT = "id, version, title, body, active";
const SIGNATURE_SELECT =
  "id, token, template_id, template_version, guardian_name, guardian_phone, guardian_document, child_name, signature_data_url, signed_at, ip, user_agent, notes, created_at";

export const supabaseTermsRepo: TermsRepo = {
  async getActiveTemplate() {
    const { data, error } = await supabase
      .from("term_templates")
      .select(TEMPLATE_SELECT)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as TemplateRow) ?? null;
  },
  async saveTemplate(input) {
    // Deactivate the current active row, then create a new versioned row.
    const { data: cur } = await supabase
      .from("term_templates")
      .select("version")
      .eq("active", true)
      .maybeSingle();
    const nextVersion = (cur?.version ?? 0) + 1;

    if (cur) {
      const { error: deErr } = await supabase
        .from("term_templates")
        .update({ active: false })
        .eq("active", true);
      if (deErr) throw deErr;
    }

    const { data, error } = await supabase
      .from("term_templates")
      .insert({
        version: nextVersion,
        title: input.title,
        body: input.body,
        active: true,
      })
      .select(TEMPLATE_SELECT)
      .single();
    if (error) throw error;
    return data as unknown as TemplateRow;
  },
  async listSignatures(limit = 50) {
    const { data, error } = await supabase
      .from("term_signatures")
      .select(SIGNATURE_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as unknown as SignatureRow[];
  },
  async createRequest(input) {
    const { data: tpl } = await supabase
      .from("term_templates")
      .select("id, version")
      .eq("active", true)
      .maybeSingle();
    const { data, error } = await supabase
      .from("term_signatures")
      .insert({
        template_id: tpl?.id ?? null,
        template_version: tpl?.version ?? null,
        guardian_name: input.guardian_name,
        guardian_phone: input.guardian_phone ?? null,
        child_name: input.child_name ?? null,
      })
      .select(SIGNATURE_SELECT)
      .single();
    if (error) throw error;
    return data as unknown as SignatureRow;
  },
  async getByToken(token) {
    const { data, error } = await supabase.rpc("get_term_signature_by_token", {
      p_token: token,
    });
    if (error) throw error;
    const row = (data as PublicTermView[] | null)?.[0];
    return row ?? null;
  },
  async submitSignature(token, signatureDataUrl, options) {
    const { error } = await supabase.rpc("submit_term_signature", {
      p_token: token,
      p_signature_data_url: signatureDataUrl,
      p_user_agent: options?.user_agent,
      p_guardian_document: options?.guardian_document,
    });
    if (error) throw error;
  },
  subscribe(onChange) {
    const ch = supabase
      .channel(`terms-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "term_signatures" },
        onChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "term_templates" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  },
};

export const termsRepo: TermsRepo = supabaseTermsRepo;
