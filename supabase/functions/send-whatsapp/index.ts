// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — send WhatsApp via uazapi.
// Reads UAZAPI_BASE_URL and UAZAPI_TOKEN from secrets:
//   supabase secrets set UAZAPI_BASE_URL=https://logos-ia.uazapi.com
//   supabase secrets set UAZAPI_TOKEN=<your-instance-token>
// Then deploy:
//   supabase functions deploy send-whatsapp

import { createClient } from "jsr:@supabase/supabase-js@2";

interface SendInput {
  phone: string;
  body?: string;
  /** Use a template by key + variables instead of providing `body` directly. */
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

/** Strip everything but digits and prefix Brazilian country code 55 if missing. */
function normalizePhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

/** Render `{{var}}` placeholders against the given variables map. */
function renderTemplate(body: string, vars: Record<string, string> = {}): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_, key) => vars[key] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const baseUrl = Deno.env.get("UAZAPI_BASE_URL");
  const token = Deno.env.get("UAZAPI_TOKEN");
  if (!baseUrl || !token) {
    return jsonResponse(
      {
        error:
          "missing uazapi config — set UAZAPI_BASE_URL and UAZAPI_TOKEN via supabase secrets set",
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

  if (!input.phone) {
    return jsonResponse({ error: "phone is required" }, 400);
  }

  const phone = normalizePhoneBR(input.phone);
  if (!phone || phone.length < 12) {
    return jsonResponse({ error: "phone looks invalid" }, 400);
  }

  // Service-role client so we can read templates and write the audit log
  // bypassing RLS.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "supabase env missing inside function" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // Resolve the message body (literal or template).
  let body = input.body ?? "";
  if (!body && input.template_key) {
    const { data: tpl, error } = await admin
      .from("message_templates")
      .select("body, active")
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
    body = renderTemplate(tpl.body, input.variables);
  } else if (body && input.variables) {
    body = renderTemplate(body, input.variables);
  }
  if (!body.trim()) {
    return jsonResponse({ error: "body is empty" }, 400);
  }

  // Identify the user (for audit) — optional, only if a user JWT was passed.
  const auth = req.headers.get("authorization");
  let triggeredBy: string | null = null;
  if (auth?.startsWith("Bearer ")) {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    triggeredBy = user?.id ?? null;
  }

  // Insert pre-send queued log.
  const { data: logRow } = await admin
    .from("messages_log")
    .insert({
      event_type: input.event_type ?? "manual",
      template_key: input.template_key ?? null,
      phone,
      body,
      context: input.context ?? null,
      status: "queued",
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();

  // Call uazapi.
  const url = `${baseUrl.replace(/\/$/, "")}/send/text`;
  let providerResponse: any = null;
  let providerStatus = 0;
  let providerOk = false;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({ number: phone, text: body }),
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

  // Update audit log with result.
  if (logRow?.id) {
    await admin
      .from("messages_log")
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
        error: "uazapi rejected the message",
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
