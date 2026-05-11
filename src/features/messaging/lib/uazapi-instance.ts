import { supabase } from "@/lib/supabase";

export interface InstanceStatus {
  state: string;
  connected: boolean;
  qr: string | null;
  phone: string | null;
  profile_name: string | null;
  /** Raw response from uazapi, useful for debugging. */
  raw?: unknown;
  error?: string;
}

async function invoke(action: "status" | "connect" | "disconnect") {
  const { data, error } = await supabase.functions.invoke<{
    state?: string;
    connected?: boolean;
    qr?: string | null;
    phone?: string | null;
    profile_name?: string | null;
    raw?: unknown;
    error?: string;
    ok?: boolean;
  }>("whatsapp-control", { body: { action } });

  if (error) {
    // supabase.functions.invoke nao expoe o body do erro por padrao —
    // a Response esta em error.context. Tenta extrair o JSON pra
    // mostrar o erro real (e nao o generico "non-2xx").
    let detail = error.message;
    let raw: unknown = undefined;
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const txt = await ctx.text();
        try {
          const parsed = JSON.parse(txt) as {
            error?: string;
            raw?: unknown;
          };
          if (parsed?.error) detail = parsed.error;
          raw = parsed?.raw ?? parsed;
        } catch {
          if (txt) detail = txt;
        }
      } catch {
        // ignora — fica com error.message
      }
    }
    return { error: detail, raw } as InstanceStatus;
  }
  if (data?.error) {
    return { error: data.error, raw: data.raw } as InstanceStatus;
  }
  return {
    state: data?.state ?? "unknown",
    connected: Boolean(data?.connected),
    qr: data?.qr ?? null,
    phone: data?.phone ?? null,
    profile_name: data?.profile_name ?? null,
    raw: data?.raw,
  };
}

export async function getInstanceStatus(): Promise<InstanceStatus> {
  return invoke("status");
}

export async function connectInstance(): Promise<InstanceStatus> {
  return invoke("connect");
}

export async function disconnectInstance(): Promise<InstanceStatus> {
  return invoke("disconnect");
}
