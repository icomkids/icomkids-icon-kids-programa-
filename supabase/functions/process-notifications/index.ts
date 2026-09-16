import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.0";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey = Deno.env.get("ADHONEP_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY");
const from = Deno.env.get("ADHONEP_EMAIL_FROM") || "ADHONEP Expansão <suporte@xn--adhonepexpanso-2hb.com.br>";
const site = "https://xn--adhonepexpanso-2hb.com.br";
const db = createClient(url, key, { auth: { persistSession: false } });

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]!));
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

function emailHtml(item: any) {
  const p = item.payload || {};
  const sub = item.notification_subscriptions;
  const isEvent = item.kind.startsWith("event_");
  const title = isEvent ? p.title : p.name;
  const intro = item.kind === "event_published" ? "Um novo encontro acaba de entrar na agenda." : item.kind === "event_reminder_7d" ? "Nosso encontro está chegando. Falta apenas uma semana." : item.kind === "event_reminder_1d" ? "É amanhã! Estamos preparando tudo para receber você." : item.kind === "company_published" ? "Uma nova empresa passou a fazer parte da nossa rede de negócios." : "Temos um novo patrocinador fortalecendo a nossa comunidade.";
  const detail = isEvent ? `<p style="font-size:17px;line-height:1.7"><strong>${escapeHtml(formatDate(p.starts_at))}</strong><br>${escapeHtml(p.venue_name)}${p.address ? `<br>${escapeHtml(p.address)}` : ""}</p>` : `<p style="font-size:17px;line-height:1.7">${escapeHtml(p.segment || p.description || "Conheça essa nova conexão da comunidade.")}</p>`;
  return `<!doctype html><html><body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#102a43"><table width="100%" role="presentation"><tr><td align="center" style="padding:32px 12px"><table width="600" role="presentation" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden"><tr><td align="center" style="background:#092b4c;padding:28px"><img src="${site}/assets/logo-adhonep-expansao-branca.png" width="190" alt="ADHONEP Expansão"></td></tr><tr><td style="padding:38px"><p style="color:#c5962f;font-weight:bold;letter-spacing:2px;font-size:12px">COMUNIDADE ADHONEP</p><h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.15;margin:12px 0">${escapeHtml(title)}</h1><p style="font-size:17px;line-height:1.7">Olá, ${escapeHtml(sub.name || "empreendedor")}. ${escapeHtml(intro)}</p>${detail}<p style="font-size:16px;line-height:1.7">${escapeHtml(p.description || "Conecte-se, conheça novas oportunidades e fortaleça relacionamentos com propósito.")}</p><p style="margin:30px 0"><a href="${site}#eventos" style="background:#c5962f;color:#092b4c;text-decoration:none;font-weight:bold;padding:15px 24px;border-radius:8px">Ver na ADHONEP Expansão</a></p><p style="font-size:13px;color:#687787;border-top:1px solid #e5e7eb;padding-top:22px">Você recebe este e-mail porque autorizou novidades da comunidade. <a style="color:#687787" href="${url}/functions/v1/unsubscribe-notifications?token=${sub.unsubscribe_token}">Cancelar avisos</a>.</p></td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!resendKey || !from) return Response.json({ error: "email_secrets_missing" }, { status: 503 });
  const { data: items, error } = await db.from("adh_email_outbox").select("*,adh_notification_subscriptions(email,name,unsubscribe_token,active)").eq("status", "pending").lte("send_after", new Date().toISOString()).order("id").limit(25);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const item of items || []) {
    const sub: any = item.adh_notification_subscriptions;
    if (!sub?.active) { await db.from("adh_email_outbox").update({ status: "cancelled" }).eq("id", item.id); continue; }
    await db.from("adh_email_outbox").update({ status: "processing", attempts: item.attempts + 1 }).eq("id", item.id).eq("status", "pending");
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, reply_to: "suporte@xn--adhonepexpanso-2hb.com.br", to: [sub.email], subject: item.subject, html: emailHtml(item) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      await db.from("adh_email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.id, last_error: null }).eq("id", item.id); sent++;
    } catch (err) {
      await db.from("adh_email_outbox").update({ status: item.attempts >= 2 ? "failed" : "pending", send_after: new Date(Date.now()+15*60_000).toISOString(), last_error: String(err).slice(0,1000) }).eq("id", item.id);
    }
  }
  return Response.json({ ok: true, processed: items?.length || 0, sent });
});
