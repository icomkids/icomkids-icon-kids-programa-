// deno-lint-ignore-file no-explicit-any
// Edge Function — recebe eventos do Asaas e atualiza o ticket_order.
// Asaas envia o header 'asaas-access-token' com o valor que voce
// configurou no painel (Settings → Integrations → Webhook).
// Secret necessario:
//   ASAAS_WEBHOOK_TOKEN — o mesmo valor que voce colocou no campo
//                          'asaas-access-token' no painel Asaas
// Deploy:
//   supabase functions deploy asaas-webhook --no-verify-jwt
//   (--no-verify-jwt e essencial: o Asaas nao envia JWT do Supabase)

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "asaas-access-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expected || !supabaseUrl || !serviceKey) {
    return jsonResponse(
      { error: "missing ASAAS_WEBHOOK_TOKEN or supabase env" },
      500
    );
  }

  const provided = req.headers.get("asaas-access-token") ?? "";
  if (!constantTimeEq(provided, expected)) {
    return jsonResponse({ error: "invalid token" }, 401);
  }

  let event: any;
  try {
    event = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const eventType: string = event.event ?? "";
  const payment = event.payment ?? null;
  const checkout = event.checkout ?? null;
  // Each event ties back to our order via externalReference (we send it on
  // checkout creation; Asaas propagates it to the underlying payment).
  const orderId: string | null =
    payment?.externalReference ??
    checkout?.externalReference ??
    null;

  const handle = async () => {
    if (!orderId) return;

    if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
      await admin
        .from("ticket_orders")
        .update({
          status: "paid",
          asaas_payment_id: payment?.id ?? null,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      return;
    }

    if (
      eventType === "CHECKOUT_PAID" ||
      eventType === "CHECKOUT_PAYMENT_RECEIVED"
    ) {
      await admin
        .from("ticket_orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      return;
    }

    if (eventType === "PAYMENT_OVERDUE" || eventType === "CHECKOUT_EXPIRED") {
      await admin
        .from("ticket_orders")
        .update({ status: "expired" })
        .eq("id", orderId);
      return;
    }

    if (
      eventType === "PAYMENT_DELETED" ||
      eventType === "PAYMENT_CHARGEBACK_REQUESTED" ||
      eventType === "CHECKOUT_CANCELED"
    ) {
      await admin
        .from("ticket_orders")
        .update({ status: "canceled" })
        .eq("id", orderId);
      return;
    }

    if (eventType === "PAYMENT_REFUNDED") {
      await admin
        .from("ticket_orders")
        .update({ status: "refunded" })
        .eq("id", orderId);
      return;
    }

    // Other events (PAYMENT_CREATED, PAYMENT_UPDATED, etc.) are ignored.
  };

  try {
    await handle();
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "error" },
      500
    );
  }

  return jsonResponse({ received: true });
});
