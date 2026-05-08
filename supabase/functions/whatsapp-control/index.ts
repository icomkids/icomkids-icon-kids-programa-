// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — manage the iCOM Kids uazapi instance from the
// app: get status, fetch QR code to connect, disconnect.
// Reads UAZAPI_BASE_URL and UAZAPI_TOKEN from secrets.
// Deploy:
//   supabase functions deploy whatsapp-control

interface ControlInput {
  action: "status" | "connect" | "disconnect";
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

async function callUazapi(
  baseUrl: string,
  token: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token,
    },
    body: body == null ? "{}" : JSON.stringify(body),
  });
  let data: any;
  try {
    data = await resp.json();
  } catch {
    data = { raw: await resp.text() };
  }
  return { status: resp.status, data };
}

/**
 * Normalize uazapi's status response into a small shape the frontend can use.
 * Different uazapi builds return different shapes — try to unify them.
 */
function summarize(raw: any) {
  // Some builds nest under instance, others under data, others flat.
  const inst = raw?.instance ?? raw?.data ?? raw ?? {};
  const stateRaw =
    inst.status ?? inst.state ?? inst.connection ?? raw?.status ?? null;
  const state = String(stateRaw ?? "unknown").toLowerCase();
  let connected = false;
  if (
    state === "open" ||
    state === "connected" ||
    state === "online" ||
    state === "ready"
  )
    connected = true;
  const qr =
    inst.qr ??
    inst.qrcode ??
    inst.qrCode ??
    raw?.qr ??
    raw?.qrcode ??
    raw?.qrCode ??
    null;
  const phone =
    inst.phone ??
    inst.number ??
    inst.wid ??
    inst.owner ??
    raw?.phone ??
    raw?.number ??
    null;
  const profileName =
    inst.profileName ?? inst.name ?? raw?.profileName ?? raw?.name ?? null;
  return {
    state,
    connected,
    qr,
    phone,
    profile_name: profileName,
    raw,
  };
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

  let input: ControlInput;
  try {
    input = (await req.json()) as ControlInput;
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  if (input.action === "status") {
    const { status, data } = await callUazapi(baseUrl, token, "/instance/status");
    if (status >= 400) {
      return jsonResponse(
        {
          error: data?.message ?? "uazapi error",
          provider_status: status,
          provider_response: data,
        },
        502
      );
    }
    return jsonResponse(summarize(data));
  }

  if (input.action === "connect") {
    // /instance/connect returns the QR (and may also indicate connected
    // state if the instance is already authenticated).
    const { status, data } = await callUazapi(baseUrl, token, "/instance/connect");
    if (status >= 400) {
      return jsonResponse(
        {
          error: data?.message ?? "uazapi error",
          provider_status: status,
          provider_response: data,
        },
        502
      );
    }
    return jsonResponse(summarize(data));
  }

  if (input.action === "disconnect") {
    const { status, data } = await callUazapi(baseUrl, token, "/instance/logout");
    if (status >= 400) {
      return jsonResponse(
        {
          error: data?.message ?? "uazapi error",
          provider_status: status,
          provider_response: data,
        },
        502
      );
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "unknown action" }, 400);
});
