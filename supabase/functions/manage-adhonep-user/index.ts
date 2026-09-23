import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]!));

async function sendInvite(email: string, fullName: string, actionLink: string, chapterName: string) {
  const apiKey = Deno.env.get("ADHONEP_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ADHONEP_EMAIL_FROM") || "ADHONEP Expansão <suporte@xn--adhonepexpanso-2hb.com.br>";
  if (!apiKey || !from) throw new Error("O Resend ainda não está configurado para a função de convites.");
  const site = "https://xn--adhonepexpanso-2hb.com.br";
  const html = `<!doctype html><html><body style="margin:0;background:#eef2f5;font-family:Arial,sans-serif;color:#102a43"><table width="100%" role="presentation"><tr><td align="center" style="padding:32px 12px"><table width="600" role="presentation" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td align="center" style="background:#092b4c;padding:30px"><img src="${site}/assets/logo-adhonep-expansao-branca.png" width="190" alt="ADHONEP Expansão"></td></tr><tr><td style="padding:38px"><p style="color:#bd8d32;font-size:12px;font-weight:bold;letter-spacing:2px">CONVITE DE LIDERANÇA</p><h1 style="font:32px Georgia,serif;margin:12px 0">Bem-vindo à ADHONEP Expansão.</h1><p style="font-size:17px;line-height:1.7">Olá, <strong>${escapeHtml(fullName)}</strong>. Você foi convidado para administrar o <strong>${escapeHtml(chapterName)}</strong>.</p><p style="font-size:16px;line-height:1.7">Defina sua senha para acessar o painel, cadastrar empresários, publicar eventos e acompanhar indicações do capítulo.</p><p style="margin:32px 0"><a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#c79a42;color:#092b4c;text-decoration:none;font-weight:bold;padding:15px 24px;border-radius:7px">Criar minha senha</a></p><p style="font-size:13px;color:#6b7780;border-top:1px solid #e5e7eb;padding-top:20px">Se você não esperava este convite, ignore esta mensagem.</p></td></tr></table></td></tr></table></body></html>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, reply_to: "suporte@xn--adhonepexpanso-2hb.com.br", to: [email], subject: `Convite para liderar o ${chapterName} — ADHONEP`, html }) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Resend: ${result?.message || JSON.stringify(result)}`);
  return result.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Sessão obrigatória" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Sessão inválida" }, 401);

  const { data: caller } = await admin.from("adh_profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (!caller || !["super_admin", "chapter_admin"].includes(caller.role)) return reply({ error: "Sem permissão administrativa" }, 403);

  const input = await req.json();
  const email = String(input.email || "").trim().toLowerCase();
  const fullName = String(input.full_name || "").trim();
  const chapterId = String(input.chapter_id || "");
  const role = input.role === "chapter_admin" ? "chapter_admin" : "business";
  if (!email || !fullName || !chapterId) return reply({ error: "Nome, e-mail e capítulo são obrigatórios" }, 400);
  if (role === "chapter_admin" && caller.role !== "super_admin") return reply({ error: "Somente o administrador geral adiciona líderes" }, 403);

  if (caller.role === "chapter_admin") {
    const { data: link } = await admin.from("adh_chapter_admins").select("chapter_id").eq("chapter_id", chapterId).eq("user_id", authData.user.id).maybeSingle();
    if (!link) return reply({ error: "Você não administra este capítulo" }, 403);
  }

  const { data: chapter, error: chapterError } = await admin.from("adh_chapters").select("name").eq("id", chapterId).maybeSingle();
  if (chapterError || !chapter) return reply({ error: "Capítulo não encontrado" }, 404);

  let existingUser: { id: string; email_confirmed_at?: string | null } | undefined;
  for (let page = 1; page <= 10 && !existingUser; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    existingUser = data.users.find((user) => user.email?.toLowerCase() === email);
    if (data.users.length < 100) break;
  }
  let userId = existingUser?.id;
  let emailSent = false;
  let emailWarning: string | null = null;
  const redirectTo = `${req.headers.get("origin") || "https://xn--adhonepexpanso-2hb.com.br"}/membros.html`;
  let actionLink: string | undefined;

  if (!userId) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo, data: { full_name: fullName } } });
    if (error || !data.user || !data.properties?.action_link) return reply({ error: error?.message || "Não foi possível gerar o convite" }, 400);
    userId = data.user.id;
    actionLink = data.properties.action_link;
  } else if (!existingUser?.email_confirmed_at) {
    // A previous mail attempt may have failed after Auth created the user. A
    // recovery link lets the administrator safely resend password setup.
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    if (error || !data.properties?.action_link) emailWarning = error?.message || "Não foi possível gerar um novo link de acesso";
    else actionLink = data.properties.action_link;
  }

  if (actionLink) {
    try {
      await sendInvite(email, fullName, actionLink, chapter.name);
      emailSent = true;
    } catch (emailError) {
      // E-mail is delivery, not persistence. Keep the user and chapter link so
      // an invalid provider key never destroys a valid administrative record.
      emailWarning = emailError instanceof Error ? emailError.message : "Não foi possível enviar o e-mail de convite";
    }
  }

  const { data: existingProfile } = await admin.from("adh_profiles").select("role").eq("id", userId).maybeSingle();
  let targetRole = role;
  if (existingProfile?.role === "super_admin" || (role === "business" && existingProfile?.role === "chapter_admin")) targetRole = existingProfile.role;
  const { error: profileError } = await admin.from("adh_profiles").upsert({ id: userId, full_name: fullName, role: targetRole }, { onConflict: "id" });
  if (profileError) return reply({ error: profileError.message }, 400);
  if (role === "chapter_admin") {
    const { error } = await admin.from("adh_chapter_admins").upsert(
      { chapter_id: chapterId, user_id: userId },
      { onConflict: "chapter_id,user_id", ignoreDuplicates: true },
    );
    if (error) return reply({ error: error.message }, 400);
  }
  console.info(JSON.stringify({ event: "adhonep_invite_result", user_id: userId, chapter_id: chapterId, email_sent: emailSent, email_warning: Boolean(emailWarning) }));
  return reply({ ok: true, user_id: userId, invited: emailSent, email_sent: emailSent, email_warning: emailWarning });
});
