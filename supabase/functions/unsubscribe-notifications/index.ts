import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.0";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
Deno.serve(async (request) => {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return new Response("Link inválido.", { status: 400 });
  const { error } = await db.from("adh_notification_subscriptions").update({ active: false, unsubscribed_at: new Date().toISOString() }).eq("unsubscribe_token", token);
  return new Response(error ? "Não foi possível cancelar agora." : "Você não receberá mais avisos da ADHONEP Expansão.", { status: error ? 500 : 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
});
