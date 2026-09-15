import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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

  let userId: string | undefined;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    userId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
    if (data.users.length < 100) break;
  }
  let invited = false;
  if (!userId) {
    const redirectTo = `${req.headers.get("origin") || "https://adhonepexpansão.com.br"}/membros.html`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName } });
    if (error || !data.user) return reply({ error: error?.message || "Não foi possível enviar o convite" }, 400);
    userId = data.user.id; invited = true;
  }

  const { data: existingProfile } = await admin.from("adh_profiles").select("role").eq("id", userId).maybeSingle();
  let targetRole = role;
  if (existingProfile?.role === "super_admin" || (role === "business" && existingProfile?.role === "chapter_admin")) targetRole = existingProfile.role;
  const { error: profileError } = await admin.from("adh_profiles").upsert({ id: userId, full_name: fullName, role: targetRole }, { onConflict: "id" });
  if (profileError) return reply({ error: profileError.message }, 400);
  if (role === "chapter_admin") {
    const { error } = await admin.from("adh_chapter_admins").upsert({ chapter_id: chapterId, user_id: userId });
    if (error) return reply({ error: error.message }, 400);
  }
  return reply({ ok: true, user_id: userId, invited });
});
