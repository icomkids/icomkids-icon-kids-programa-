import { corsHeaders, json } from "../_shared/cors.ts";
import { admin } from "../_shared/clients.ts";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await request.json();
    if (body.website) return json({ ok: true });
    const name = clean(body.name, 120);
    const email = clean(body.email, 254)?.toLowerCase();
    const whatsapp = clean(body.whatsapp, 40);
    if (!name || !email || !whatsapp || body.consent !== true || !email.includes("@")) return json({ error: "invalid_payload" }, 400);
    const { data: chapter } = await admin.from("adh_chapters").select("id").eq("city", "Taubaté").eq("active", true).maybeSingle();
    const { data: inserted, error } = await admin.from("adh_leads").insert({
      chapter_id: chapter?.id || null,
      name, email, whatsapp,
      company: clean(body.company, 160), city: clean(body.city, 120), interest: clean(body.interest, 120),
      source_page: clean(body.source_page, 300), utm_source: clean(body.utm_source, 120), utm_medium: clean(body.utm_medium, 120), utm_campaign: clean(body.utm_campaign, 120),
      consent_at: new Date().toISOString(),
    }).select("id,chapter_id").single();
    if (error) throw error;
    if (body.notifications === true && inserted) {
      const { error: subscriptionError } = await admin.from("adh_notification_subscriptions").upsert({ email, name, lead_id: inserted.id, chapter_id: inserted.chapter_id, active: true, events_enabled: true, businesses_enabled: true, confirmed_at: new Date().toISOString(), unsubscribed_at: null }, { onConflict: "email" });
      if (subscriptionError) throw subscriptionError;
    }
    return json({ ok: true }, 201);
  } catch (error) {
    console.error("submit-lead", error);
    return json({ error: "internal_error" }, 500);
  }
});
