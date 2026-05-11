// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — send transactional email via Resend.
// Reads RESEND_API_KEY and RESEND_FROM_EMAIL from secrets:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set RESEND_FROM_EMAIL="iCOM Kids <noreply@seudominio.com>"
// Then deploy:
//   supabase functions deploy send-email

import { createClient } from "jsr:@supabase/supabase-js@2";

interface SendInput {
  to: string;
  to_name?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  reply_to?: string;
  /** Use a template by key + variables instead of providing body/subject directly. */
  template_key?: string;
  variables?: Record<string, string>;
  event_type?: string;
  context?: Record<string, unknown>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function renderTemplate(body: string, vars: Record<string, string> = {}): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_, key) => vars[key] ?? "");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) {
    return jsonResponse(
      {
        error:
          "missing resend config — set RESEND_API_KEY and RESEND_FROM_EMAIL via supabase secrets set",
      },
      500
    );
  }

  let input: SendInput;
  try {
    input = (await req.json()) as SendInput;
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  if (!input.to || !isValidEmail(input.to)) {
    return jsonResponse({ error: "to email is required and must be valid" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "supabase env missing inside function" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // Resolve subject + body (literal or template).
  let subject = input.subject ?? "";
  let bodyHtml = input.body_html ?? "";
  let bodyText = input.body_text ?? "";

  if (input.template_key) {
    const { data: tpl, error } = await admin
      .from("message_templates")
      .select("name, body, active")
      .eq("key", input.template_key)
      .maybeSingle();
    if (error || !tpl) {
      return jsonResponse(
        { error: `template '${input.template_key}' not found` },
        404
      );
    }
    if (!tpl.active) {
      return jsonResponse(
        { error: `template '${input.template_key}' is not active` },
        400
      );
    }
    if (!subject) {
      subject = renderTemplate(tpl.name ?? "", input.variables).replace(
        /^\[Email\]\s*/,
        ""
      );
    }
    if (!bodyHtml) {
      bodyHtml = renderTemplate(tpl.body ?? "", input.variables);
    }
  } else {
    if (input.variables) {
      if (bodyHtml) bodyHtml = renderTemplate(bodyHtml, input.variables);
      if (bodyText) bodyText = renderTemplate(bodyText, input.variables);
      if (subject) subject = renderTemplate(subject, input.variables);
    }
  }

  if (!subject.trim()) {
    return jsonResponse({ error: "subject is empty" }, 400);
  }
  if (!bodyHtml.trim() && !bodyText.trim()) {
    return jsonResponse({ error: "body is empty" }, 400);
  }
  if (!bodyText.trim() && bodyHtml.trim()) {
    bodyText = htmlToText(bodyHtml);
  }

  // Identify user for audit (optional).
  const auth = req.headers.get("authorization");
  let triggeredBy: string | null = null;
  if (auth?.startsWith("Bearer ")) {
    try {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: auth } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      triggeredBy = user?.id ?? null;
    } catch {
      // ignore
    }
  }

  const toName = input.to_name?.trim() || null;
  const recipient = toName ? `${toName} <${input.to}>` : input.to;

  // Pre-send queued log.
  const { data: logRow } = await admin
    .from("email_log")
    .insert({
      event_type: input.event_type ?? "manual",
      template_key: input.template_key ?? null,
      to_email: input.to,
      to_name: toName,
      reply_to: input.reply_to ?? null,
      subject,
      body_html: bodyHtml || null,
      body_text: bodyText || null,
      context: input.context ?? null,
      status: "queued",
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();

  // Call Resend.
  let providerResponse: any = null;
  let providerStatus = 0;
  let providerOk = false;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        html: bodyHtml || undefined,
        text: bodyText || undefined,
        reply_to: input.reply_to || undefined,
      }),
    });
    providerStatus = resp.status;
    try {
      providerResponse = await resp.json();
    } catch {
      providerResponse = { raw: await resp.text() };
    }
    providerOk = resp.ok;
  } catch (e) {
    providerResponse = { error: e instanceof Error ? e.message : String(e) };
  }

  if (logRow?.id) {
    await admin
      .from("email_log")
      .update({
        status: providerOk ? "sent" : "failed",
        sent_at: providerOk ? new Date().toISOString() : null,
        failed_at: providerOk ? null : new Date().toISOString(),
        provider_response: providerResponse,
      })
      .eq("id", logRow.id);
  }

  if (!providerOk) {
    return jsonResponse(
      {
        error: "resend rejected the message",
        provider_status: providerStatus,
        provider_response: providerResponse,
      },
      502
    );
  }

  return jsonResponse({
    ok: true,
    log_id: logRow?.id,
    provider_status: providerStatus,
    provider_response: providerResponse,
  });
});
