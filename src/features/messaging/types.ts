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

export interface EmailLogEntry {
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

export interface SendEmailInput {
  to: string;
  to_name?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  reply_to?: string;
  template_key?: string;
  variables?: Record<string, string>;
  event_type?: string;
  context?: Record<string, unknown>;
}

export interface SendEmailResult {
  ok: boolean;
  log_id?: string;
  error?: string;
  provider_status?: number;
}
