export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ADHONEP_SITE_URL") || "https://xn--adhonepexpanso-2hb.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
