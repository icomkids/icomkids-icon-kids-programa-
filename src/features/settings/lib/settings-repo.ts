import { supabase as supabaseClient } from "@/lib/supabase";

// Cast em `any` ate o usuario rodar `db push` da migration system_settings
// e regenerar database.types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseClient as any;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await sb
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;
  return (data.value as T) ?? fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const { error } = await sb
    .from("system_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

export function subscribeSettings(onChange: () => void): () => void {
  const ch = sb
    .channel(`system-settings-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "system_settings" },
      onChange
    )
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}
