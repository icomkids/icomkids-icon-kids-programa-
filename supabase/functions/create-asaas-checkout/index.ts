// deno-lint-ignore-file no-explicit-any
// Edge Function — cria um Asaas Checkout (POST /v3/checkouts) e
// retorna a URL hospedada para o cliente concluir o pagamento.
// Secrets:
//   ASAAS_API_KEY        — token do painel Asaas (Settings → Integrations)
//   ASAAS_BASE_URL       — https://api-sandbox.asaas.com/v3 (sandbox)
//                          ou https://api.asaas.com/v3 (producao)
// Deploy:
//   supabase functions deploy create-asaas-checkout

import { createClient } from "jsr:@supabase/supabase-js@2";

interface CreateInput {
  offer_id: string;
  guardian_name: string;
  guardian_email: string;          // obrigatorio na Asaas
  guardian_phone?: string;
  guardian_document: string;       // CPF/CNPJ obrigatorio
  child_name?: string;
  success_url?: string;
  cancel_url?: string;
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

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  const baseUrl = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return jsonResponse(
      {
        error:
          "missing config — set ASAAS_API_KEY (and optionally ASAAS_BASE_URL) via supabase secrets set",
      },
      500
    );
  }

  let input: CreateInput;
  try {
    input = (await req.json()) as CreateInput;
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  if (
    !input.offer_id ||
    !input.guardian_name ||
    !input.guardian_email ||
    !input.guardian_document
  ) {
    return jsonResponse(
      {
        error:
          "offer_id, guardian_name, guardian_email and guardian_document (CPF/CNPJ) are required",
      },
      400
    );
  }

  const document = onlyDigits(input.guardian_document);
  if (document.length !== 11 && document.length !== 14) {
    return jsonResponse(
      { error: "guardian_document must be a valid CPF (11 digits) or CNPJ (14)" },
      400
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: offer, error: oErr } = await admin
    .from("ticket_offers")
    .select("id, name, description, duration_minutes, price_cents, active")
    .eq("id", input.offer_id)
    .maybeSingle();
  if (oErr || !offer) {
    return jsonResponse({ error: "offer not found" }, 404);
  }
  if (!offer.active) {
    return jsonResponse({ error: "offer is not active" }, 400);
  }

  const { data: order, error: insErr } = await admin
    .from("ticket_orders")
    .insert({
      offer_id: offer.id,
      offer_name: offer.name,
      offer_duration_minutes: offer.duration_minutes,
      guardian_name: input.guardian_name,
      guardian_phone: input.guardian_phone ?? null,
      guardian_email: input.guardian_email,
      guardian_document: document,
      child_name: input.child_name ?? null,
      amount_cents: offer.price_cents,
      status: "pending",
    })
    .select("id, qr_code_token")
    .single();
  if (insErr || !order) {
    return jsonResponse(
      { error: insErr?.message ?? "failed to create order" },
      500
    );
  }

  const successUrl =
    input.success_url ??
    `${req.headers.get("origin") ?? ""}/loja/sucesso?token=${order.qr_code_token}`;
  const cancelUrl =
    input.cancel_url ??
    `${req.headers.get("origin") ?? ""}/loja?canceled=1`;

  const checkoutBody = {
    billingTypes: ["PIX", "CREDIT_CARD", "BOLETO"],
    chargeTypes: ["DETACHED"],
    minutesToExpire: 60,
    callback: {
      successUrl,
      cancelUrl,
    },
    items: [
      {
        description: offer.name,
        name: offer.name,
        quantity: 1,
        value: offer.price_cents / 100,
      },
    ],
    customerData: {
      name: input.guardian_name,
      email: input.guardian_email,
      cpfCnpj: document,
      phone: input.guardian_phone ? onlyDigits(input.guardian_phone) : undefined,
    },
    externalReference: order.id,
  };

  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify(checkoutBody),
  });
  let asaasData: any;
  try {
    asaasData = await resp.json();
  } catch {
    asaasData = { raw: await resp.text() };
  }

  if (!resp.ok) {
    await admin
      .from("ticket_orders")
      .update({ status: "canceled" })
      .eq("id", order.id);
    return jsonResponse(
      {
        error:
          asaasData?.errors?.[0]?.description ??
          "asaas rejected the request",
        provider_status: resp.status,
        provider_response: asaasData,
      },
      502
    );
  }

  // Asaas Checkout response: { id, link, ... }
  const checkoutId: string | null = asaasData?.id ?? null;
  const checkoutUrl: string | null =
    asaasData?.link ?? asaasData?.invoiceUrl ?? null;

  await admin
    .from("ticket_orders")
    .update({
      asaas_checkout_id: checkoutId,
      checkout_url: checkoutUrl,
    })
    .eq("id", order.id);

  if (!checkoutUrl) {
    return jsonResponse(
      { error: "asaas did not return a checkout URL", provider_response: asaasData },
      502
    );
  }

  return jsonResponse({
    ok: true,
    order_id: order.id,
    qr_code_token: order.qr_code_token,
    checkout_url: checkoutUrl,
  });
});
