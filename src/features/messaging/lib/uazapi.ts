import { supabase } from "@/lib/supabase";
import type {
  MessageLogEntry,
  MessageStatus,
  SendWhatsAppInput,
  SendWhatsAppResult,
} from "../types";

/**
 * Sends a WhatsApp message via the `send-whatsapp` Supabase Edge Function.
 * The function holds the uazapi token in its server-side secrets, so this
 * never touches the browser.
 */
export async function sendWhatsApp(
  input: SendWhatsAppInput
): Promise<SendWhatsAppResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    log_id?: string;
    error?: string;
    provider_status?: number;
  }>("send-whatsapp", {
    body: input,
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  if (!data?.ok) {
    return {
      ok: false,
      error: data?.error ?? "Falha desconhecida ao enviar.",
      provider_status: data?.provider_status,
    };
  }

  return {
    ok: true,
    log_id: data.log_id,
    provider_status: data.provider_status,
  };
}

interface MessageLogRow {
  id: string;
  event_type: string | null;
  template_key: string | null;
  phone: string;
  body: string;
  status: MessageStatus;
  context: Record<string, unknown> | null;
  provider_response: Record<string, unknown> | null;
  sent_at: string | null;
  failed_at: string | null;
  triggered_by: string | null;
  created_at: string;
}

/** List the last `limit` messages, newest first. */
export async function listRecentMessages(
  limit = 30
): Promise<MessageLogEntry[]> {
  const { data, error } = await supabase
    .from("messages_log")
    .select(
      "id, event_type, template_key, phone, body, status, context, provider_response, sent_at, failed_at, triggered_by, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as MessageLogRow[]).map((row) => ({
    id: row.id,
    event_type: row.event_type,
    template_key: row.template_key,
    phone: row.phone,
    body: row.body,
    status: row.status,
    context: row.context,
    provider_response: row.provider_response,
    sent_at: row.sent_at,
    failed_at: row.failed_at,
    triggered_by: row.triggered_by,
    created_at: row.created_at,
  }));
}

export function subscribeToMessages(onChange: () => void): () => void {
  const channel = supabase
    .channel(`messages-log-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages_log" },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
