export type MessageStatus = "queued" | "sent" | "failed";

export interface MessageLogEntry {
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

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  active: boolean;
  notes: string | null;
}

export interface SendWhatsAppInput {
  phone: string;
  body?: string;
  template_key?: string;
  variables?: Record<string, string>;
  event_type?: string;
  context?: Record<string, unknown>;
}

export interface SendWhatsAppResult {
  ok: boolean;
  log_id?: string;
  error?: string;
  provider_status?: number;
}
