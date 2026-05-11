import { supabase as supabaseClient } from "@/lib/supabase";
import type {
  AutomationRule,
  AutomationRuleInput,
  ScheduledMessage,
  ScheduledMessageInput,
} from "../types";

// Cast em `any` ate o usuario rodar `db push` da migration
// 20260509200000_add_automation.sql + `supabase gen types --linked`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseClient as any;

const RULE_SELECT =
  "id, name, trigger_type, trigger_config, channel, template_key, active, notes, created_at, updated_at";

const SCHED_SELECT =
  "id, channel, recipient, recipient_name, template_key, body_override, subject_override, variables, scheduled_for, status, rule_id, context, attempts, last_error, sent_at, failed_at, canceled_at, created_at";

export async function listRules(): Promise<AutomationRule[]> {
  const { data, error } = await sb
    .from("automation_rules")
    .select(RULE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AutomationRule[];
}

export async function createRule(
  input: AutomationRuleInput
): Promise<AutomationRule> {
  const { data, error } = await sb
    .from("automation_rules")
    .insert({
      name: input.name,
      trigger_type: input.trigger_type,
      trigger_config: input.trigger_config ?? {},
      channel: input.channel,
      template_key: input.template_key,
      active: input.active ?? true,
      notes: input.notes ?? null,
    })
    .select(RULE_SELECT)
    .single();
  if (error) throw error;
  return data as AutomationRule;
}

export async function updateRule(
  id: string,
  patch: Partial<AutomationRuleInput>
): Promise<AutomationRule> {
  const { data, error } = await sb
    .from("automation_rules")
    .update(patch)
    .eq("id", id)
    .select(RULE_SELECT)
    .single();
  if (error) throw error;
  return data as AutomationRule;
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await sb.from("automation_rules").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeRules(onChange: () => void): () => void {
  const ch = sb
    .channel(`automation-rules-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "automation_rules" },
      onChange
    )
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}

export async function listScheduled(
  limit = 50
): Promise<ScheduledMessage[]> {
  const { data, error } = await sb
    .from("scheduled_messages")
    .select(SCHED_SELECT)
    .order("scheduled_for", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ScheduledMessage[];
}

export async function createScheduled(
  input: ScheduledMessageInput
): Promise<ScheduledMessage> {
  const { data, error } = await sb
    .from("scheduled_messages")
    .insert({
      channel: input.channel,
      recipient: input.recipient,
      recipient_name: input.recipient_name ?? null,
      template_key: input.template_key ?? null,
      body_override: input.body_override ?? null,
      subject_override: input.subject_override ?? null,
      variables: input.variables ?? {},
      scheduled_for: input.scheduled_for,
    })
    .select(SCHED_SELECT)
    .single();
  if (error) throw error;
  return data as ScheduledMessage;
}

export async function cancelScheduled(id: string): Promise<void> {
  const { error } = await sb
    .from("scheduled_messages")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;
}

export function subscribeScheduled(onChange: () => void): () => void {
  const ch = sb
    .channel(`scheduled-messages-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "scheduled_messages" },
      onChange
    )
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}
