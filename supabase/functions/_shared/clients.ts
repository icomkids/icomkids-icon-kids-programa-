import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.0";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("ADHONEP_SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("Supabase server secrets are missing");

export const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
export const authAdmin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

export const currentUser = async (request: Request) => {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await authAdmin.auth.getUser(token);
  return error ? null : data.user;
};
