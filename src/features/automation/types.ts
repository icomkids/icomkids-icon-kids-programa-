export type AutomationChannel = "whatsapp" | "email";
export type AutomationTrigger = "session_ended" | "child_birthday";
export type ScheduledStatus = "pending" | "sent" | "failed" | "canceled";

export interface AutomationRule {
  id: string;
  name: string;
  trigger_type: AutomationTrigger;
  trigger_config: Record<string, unknown>;
  channel: AutomationChannel;
  template_key: string;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleInput {
  name: string;
  trigger_type: AutomationTrigger;
  trigger_config?: Record<string, unknown>;
  channel: AutomationChannel;
  template_key: string;
  active?: boolean;
  notes?: string | null;
}

export interface ScheduledMessage {
  id: string;
  channel: AutomationChannel;
  recipient: string;
  recipient_name: string | null;
  template_key: string | null;
  body_override: string | null;
  subject_override: string | null;
  variables: Record<string, string>;
  scheduled_for: string;
  status: ScheduledStatus;
  rule_id: string | null;
  context: Record<string, unknown> | null;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  failed_at: string | null;
  canceled_at: string | null;
  created_at: string;
}

export interface ScheduledMessageInput {
  channel: AutomationChannel;
  recipient: string;
  recipient_name?: string;
  template_key?: string;
  body_override?: string;
  subject_override?: string;
  variables?: Record<string, string>;
  scheduled_for: string;
}
