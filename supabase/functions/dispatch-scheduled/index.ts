// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — dispatcher das mensagens agendadas.
// Chamada a cada minuto pelo pg_cron via pg_net (header x-cron-secret).
// Lê scheduled_messages com status=pending e scheduled_for <= now() e
// despacha via send-whatsapp / send-email. Atualiza status pra sent/failed.
//
// Secrets necessarios:
//   CRON_SECRET — string que valida que a chamada veio do nosso pg_cron
//
// Deploy:
//   supabase functions deploy dispatch-scheduled --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "x-cron-secret, content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_PER_TICK = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!expected || provided !== expected) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "supabase env missing" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // Pega ate MAX_PER_TICK mensagens devidas
  const { data: rows, error } = await admin
    .from("scheduled_messages")
    .select(
      "id, channel, recipient, recipient_name, template_key, body_override, subject_override, variables, context"
    )
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(MAX_PER_TICK);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  if (!rows || rows.length === 0) {
    return jsonResponse({ ok: true, processed: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows as any[]) {
    try {
      let invokeName: string;
      let body: Record<string, unknown>;
      if (row.channel === "whatsapp") {
        invokeName = "send-whatsapp";
        body = {
          phone: row.recipient,
          body: row.body_override ?? undefined,
          template_key: row.template_key ?? undefined,
          variables: row.variables ?? undefined,
          event_type: "automation",
          context: row.context ?? undefined,
        };
      } else if (row.channel === "email") {
        invokeName = "send-email";
        body = {
          to: row.recipient,
          to_name: row.recipient_name ?? undefined,
          subject: row.subject_override ?? undefined,
          body_html: row.body_override ?? undefined,
          template_key: row.template_key ?? undefined,
          variables: row.variables ?? undefined,
          event_type: "automation",
          context: row.context ?? undefined,
        };
      } else {
        await admin
          .from("scheduled_messages")
          .update({
            status: "failed",
            attempts: (row.attempts ?? 0) + 1,
            last_error: `unknown channel: ${row.channel}`,
            failed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        continue;
      }

      const resp = await admin.functions.invoke(invokeName, { body });
      if (resp.error) throw new Error(resp.error.message);
      const data = resp.data as { ok?: boolean; error?: string } | null;
      if (!data?.ok) throw new Error(data?.error ?? "no ok flag in response");

      await admin
        .from("scheduled_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (row.attempts ?? 0) + 1,
          last_error: null,
        })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      await admin
        .from("scheduled_messages")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          attempts: (row.attempts ?? 0) + 1,
          last_error: e instanceof Error ? e.message : String(e),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return jsonResponse({ ok: true, processed: rows.length, sent, failed });
});
