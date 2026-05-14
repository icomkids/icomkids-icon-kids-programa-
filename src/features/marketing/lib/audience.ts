import { supabase as supabaseClient } from "@/lib/supabase";

// Cast em any: marketing usa colunas de tabelas que ainda nao foram
// regeradas no database.types.ts. Quando o usuario tiver permissao
// de owner no CLI pra rodar `gen types`, podemos remover.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseClient as any;

export type AudienceKey =
  | "all_with_phone"
  | "all_with_email"
  | "hot_leads"
  | "wa_optin"
  | "email_optin";

export const AUDIENCE_LABELS: Record<AudienceKey, string> = {
  all_with_phone: "Todos os clientes com WhatsApp",
  all_with_email: "Todos os clientes com Email",
  hot_leads: "Leads quentes (quer trocar carro + aceita contato)",
  wa_optin: "Opt-in WhatsApp (aceita ofertas iCOM Motos por WA)",
  email_optin: "Opt-in Email (aceita ofertas iCOM Motos por Email)",
};

export interface AudienceContact {
  name: string;
  phone: string | null;
  email: string | null;
}

interface GuardianRow {
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface SurveyRow {
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
}

function dedupe(rows: AudienceContact[]): AudienceContact[] {
  const seen = new Set<string>();
  const out: AudienceContact[] = [];
  for (const r of rows) {
    const key = `${(r.phone ?? "").trim()}|${(r.email ?? "").trim().toLowerCase()}`;
    if (key === "|") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Busca a audiencia bruta no banco. Faz dedup por (phone, email). */
export async function fetchAudience(
  audience: AudienceKey
): Promise<AudienceContact[]> {
  if (audience === "all_with_phone") {
    const { data, error } = await sb
      .from("guardians")
      .select("full_name, phone, email")
      .not("phone", "is", null)
      .neq("phone", "");
    if (error) throw error;
    return dedupe(
      (data as GuardianRow[]).map((r) => ({
        name: r.full_name,
        phone: r.phone,
        email: r.email,
      }))
    );
  }
  if (audience === "all_with_email") {
    const { data, error } = await sb
      .from("guardians")
      .select("full_name, phone, email")
      .not("email", "is", null)
      .neq("email", "");
    if (error) throw error;
    return dedupe(
      (data as GuardianRow[]).map((r) => ({
        name: r.full_name,
        phone: r.phone,
        email: r.email,
      }))
    );
  }

  // As 3 segmentacoes abaixo vem de nps_surveys (snapshot dos
  // contatos no momento da pesquisa).
  let q = sb
    .from("nps_surveys")
    .select("guardian_name, guardian_phone, guardian_email")
    .not("responded_at", "is", null);

  if (audience === "hot_leads") {
    q = q.eq("q_intends_trade", "yes").neq("q_offers_optin", "no");
  } else if (audience === "wa_optin") {
    q = q.eq("q_offers_optin", "whatsapp");
  } else if (audience === "email_optin") {
    q = q.eq("q_offers_optin", "email");
  }

  const { data, error } = await q;
  if (error) throw error;
  return dedupe(
    (data as SurveyRow[]).map((r) => ({
      name: r.guardian_name ?? "Cliente",
      phone: r.guardian_phone,
      email: r.guardian_email,
    }))
  );
}

/**
 * Cria N entradas em scheduled_messages pra disparar a campanha.
 * Cada contato vira 1 mensagem agendada. O cron dispatch-scheduled
 * cuida do envio em background.
 */
export async function bulkSchedule(args: {
  contacts: AudienceContact[];
  channel: "whatsapp" | "email";
  template_key: string;
  subject?: string;
  scheduled_for: string; // ISO
}): Promise<{ inserted: number; skipped: number }> {
  const { contacts, channel, template_key, subject, scheduled_for } = args;
  const rows = contacts
    .map((c) => {
      const recipient = channel === "whatsapp" ? c.phone : c.email;
      if (!recipient) return null;
      return {
        channel,
        recipient,
        recipient_name: c.name,
        template_key,
        subject_override: channel === "email" ? subject || null : null,
        variables: { nome: c.name },
        scheduled_for,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return { inserted: 0, skipped: contacts.length };

  // Insert em chunks de 100 pra nao estourar o payload do PostgREST.
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await sb.from("scheduled_messages").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  return { inserted, skipped: contacts.length - inserted };
}
