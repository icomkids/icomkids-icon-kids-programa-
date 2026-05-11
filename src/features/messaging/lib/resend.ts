import { supabase } from "@/lib/supabase";
import type {
  EmailLogEntry,
  MessageStatus,
  SendEmailInput,
  SendEmailResult,
} from "../types";

// Cast em `any` ate o usuario rodar `db push` da migration
// 20260509175754_add_email.sql + `supabase gen types --linked` para
// regenerar database.types.ts contendo a tabela email_log.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Sends a transactional email via the `send-email` Supabase Edge Function.
 * The function holds the Resend API key in its server-side secrets.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    log_id?: string;
    error?: string;
    provider_status?: number;
  }>("send-email", {
    body: input,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data?.ok) {
    return {
      ok: false,
      error: data?.error ?? "Falha desconhecida ao enviar email.",
      provider_status: data?.provider_status,
    };
  }

  return {
    ok: true,
    log_id: data.log_id,
    provider_status: data.provider_status,
  };
}

interface EmailLogRow {
  id: string;
  event_type: string | null;
  template_key: string | null;
  to_email: string;
  to_name: string | null;
  reply_to: string | null;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  status: MessageStatus;
  context: Record<string, unknown> | null;
  provider_response: Record<string, unknown> | null;
  sent_at: string | null;
  failed_at: string | null;
  triggered_by: string | null;
  created_at: string;
}

const EMAIL_LOG_SELECT =
  "id, event_type, template_key, to_email, to_name, reply_to, subject, body_html, body_text, status, context, provider_response, sent_at, failed_at, triggered_by, created_at";

export async function listRecentEmails(limit = 30): Promise<EmailLogEntry[]> {
  const { data, error } = await sb
    .from("email_log")
    .select(EMAIL_LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as EmailLogRow[]).map((row) => ({ ...row }));
}

export function subscribeToEmails(onChange: () => void): () => void {
  const channel = supabase
    .channel(`email-log-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "email_log" },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
