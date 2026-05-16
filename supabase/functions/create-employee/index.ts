// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — create employee with login + staff member record
// + permissions in a single transaction.
//
// Required env vars (set automatically by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: supabase functions deploy create-employee

import { createClient } from "jsr:@supabase/supabase-js@2";

interface CreateEmployeeInput {
  email: string;
  password: string;
  full_name: string;
  role_label?: string;
  phone?: string;
  commission_pct?: number;
  permission_keys?: string[];
}

interface UpdateEmployeeInput {
  /** ID do staff_members ou profile (precisa de pelo menos 1). */
  member_id?: string;
  profile_id?: string;
  full_name?: string;
  role_label?: string;
  phone?: string;
  commission_pct?: number;
  permission_keys?: string[];
  /** Senha nova (opcional — so passa se quer trocar). */
  new_password?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      500
    );
  }

  // Pega o JWT do caller pra validar que eh owner.
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerJwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerJwt) {
    return jsonResponse({ error: "missing authorization" }, 401);
  }

  // Cliente com o JWT do caller (pra checar role).
  const callerClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } },
  });

  const { data: callerUser } = await callerClient.auth.getUser(callerJwt);
  const callerId = callerUser?.user?.id;
  if (!callerId) {
    return jsonResponse({ error: "invalid token" }, 401);
  }

  // Verifica role
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();
  if (!callerProfile || (callerProfile as any).role !== "owner") {
    return jsonResponse({ error: "permission denied: only owner" }, 403);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "create";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  if (action === "create") {
    return await handleCreate(adminClient, callerId, body as CreateEmployeeInput);
  }
  if (action === "update") {
    return await handleUpdate(adminClient, callerId, body as UpdateEmployeeInput);
  }
  if (action === "delete") {
    return await handleDelete(adminClient, body as { member_id?: string; profile_id?: string });
  }

  return jsonResponse({ error: "unknown action" }, 400);
});

async function handleCreate(
  admin: any,
  callerId: string,
  input: CreateEmployeeInput
) {
  if (!input.email || !input.password || !input.full_name) {
    return jsonResponse(
      { error: "email, password and full_name are required" },
      400
    );
  }
  if (input.password.length < 6) {
    return jsonResponse({ error: "password must be >= 6 chars" }, 400);
  }

  // 1) Cria auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // owner ja confirma, nao pede confirmacao por email
    user_metadata: { full_name: input.full_name },
  });

  if (createErr || !created?.user) {
    return jsonResponse(
      { error: createErr?.message ?? "failed to create auth user" },
      400
    );
  }

  const newUserId = created.user.id;

  // 2) Garante profile com role=staff
  // (a trigger handle_new_user ja cria com role=customer por padrao;
  //  aqui forcamos staff. Note: profiles nao tem coluna email — o email
  //  fica em auth.users e e replicado em staff_members.email)
  const { error: profErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        full_name: input.full_name,
        role: "staff",
      },
      { onConflict: "id" }
    );

  if (profErr) {
    // Rollback: deleta auth user pra nao deixar lixo
    await admin.auth.admin.deleteUser(newUserId).catch(() => undefined);
    return jsonResponse({ error: `profile insert failed: ${profErr.message}` }, 500);
  }

  // 3) Cria staff_member (registro HR pra escala/comissao)
  const { data: member, error: memberErr } = await admin
    .from("staff_members")
    .insert({
      full_name: input.full_name,
      role_label: input.role_label ?? null,
      phone: input.phone ?? null,
      email: input.email,
      commission_pct: input.commission_pct ?? 0,
      active: true,
      profile_id: newUserId,
    })
    .select("id")
    .single();

  if (memberErr) {
    await admin.auth.admin.deleteUser(newUserId).catch(() => undefined);
    return jsonResponse({ error: `staff_member insert failed: ${memberErr.message}` }, 500);
  }

  // 4) Aplica permissoes
  const keys = input.permission_keys ?? [];
  if (keys.length > 0) {
    // Filtra so chaves validas (FK valida)
    const { data: validPerms } = await admin
      .from("permissions")
      .select("key")
      .in("key", keys);
    const validKeys = (validPerms ?? []).map((p: any) => p.key);
    if (validKeys.length > 0) {
      const rows = validKeys.map((k: string) => ({
        user_id: newUserId,
        permission_key: k,
        granted_by: callerId,
      }));
      await admin.from("user_permissions").insert(rows);

      // Log
      await admin.from("permission_audit_log").insert({
        user_id: newUserId,
        changed_by: callerId,
        action: "bulk_set",
        snapshot: validKeys,
        context: { source: "create-employee" },
      });
    }
  }

  return jsonResponse({
    ok: true,
    user_id: newUserId,
    member_id: (member as any).id,
  });
}

async function handleUpdate(
  admin: any,
  callerId: string,
  input: UpdateEmployeeInput
) {
  if (!input.member_id && !input.profile_id) {
    return jsonResponse({ error: "member_id or profile_id required" }, 400);
  }

  // Resolve profile_id pelo member_id se necessario
  let profileId = input.profile_id;
  let memberId = input.member_id;
  if (memberId && !profileId) {
    const { data: m } = await admin
      .from("staff_members")
      .select("profile_id")
      .eq("id", memberId)
      .maybeSingle();
    profileId = (m as any)?.profile_id ?? undefined;
  }
  if (profileId && !memberId) {
    const { data: m } = await admin
      .from("staff_members")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    memberId = (m as any)?.id ?? undefined;
  }

  // Self-edit bloqueado pra evitar lockout
  if (profileId === callerId) {
    return jsonResponse({ error: "cannot edit yourself" }, 400);
  }

  // 1) Atualiza staff_member
  if (memberId) {
    const patch: Record<string, unknown> = {};
    if (input.full_name != null) patch.full_name = input.full_name;
    if (input.role_label != null) patch.role_label = input.role_label;
    if (input.phone != null) patch.phone = input.phone;
    if (input.commission_pct != null) patch.commission_pct = input.commission_pct;
    if (Object.keys(patch).length > 0) {
      await admin.from("staff_members").update(patch).eq("id", memberId);
    }
  }

  // 2) Atualiza profile (full_name) se mudou
  if (profileId && input.full_name != null) {
    await admin.from("profiles").update({ full_name: input.full_name }).eq("id", profileId);
  }

  // 3) Troca senha se solicitado
  if (profileId && input.new_password) {
    if (input.new_password.length < 6) {
      return jsonResponse({ error: "password must be >= 6 chars" }, 400);
    }
    await admin.auth.admin.updateUserById(profileId, {
      password: input.new_password,
    });
  }

  // 4) Aplica permissoes (sobrescreve)
  if (profileId && input.permission_keys != null) {
    const { data: validPerms } = await admin
      .from("permissions")
      .select("key")
      .in("key", input.permission_keys);
    const validKeys = (validPerms ?? []).map((p: any) => p.key);
    await admin.from("user_permissions").delete().eq("user_id", profileId);
    if (validKeys.length > 0) {
      const rows = validKeys.map((k: string) => ({
        user_id: profileId,
        permission_key: k,
        granted_by: callerId,
      }));
      await admin.from("user_permissions").insert(rows);
    }
    await admin.from("permission_audit_log").insert({
      user_id: profileId,
      changed_by: callerId,
      action: "bulk_set",
      snapshot: validKeys,
      context: { source: "update-employee" },
    });
  }

  return jsonResponse({ ok: true });
}

async function handleDelete(
  admin: any,
  input: { member_id?: string; profile_id?: string }
) {
  if (!input.member_id && !input.profile_id) {
    return jsonResponse({ error: "member_id or profile_id required" }, 400);
  }

  let profileId = input.profile_id;
  if (input.member_id && !profileId) {
    const { data: m } = await admin
      .from("staff_members")
      .select("profile_id")
      .eq("id", input.member_id)
      .maybeSingle();
    profileId = (m as any)?.profile_id ?? undefined;
  }

  // Desativa staff_member em vez de deletar (preserva escalas/comissoes)
  if (input.member_id) {
    await admin.from("staff_members").update({ active: false }).eq("id", input.member_id);
  }
  // Remove permissoes
  if (profileId) {
    await admin.from("user_permissions").delete().eq("user_id", profileId);
    // Nao deletamos o profile/auth — preserva foreign keys e historico
  }

  return jsonResponse({ ok: true });
}
