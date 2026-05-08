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
    return { error: error.message } as InstanceStatus;
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
