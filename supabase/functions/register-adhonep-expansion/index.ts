import { admin, currentUser } from '../_shared/clients.ts';
import { validateExpansion } from '../../../adhonep/expansion-schema.js';

const allowed = new Set([
  Deno.env.get('ADHONEP_SITE_URL') || 'https://xn--adhonepexpanso-2hb.com.br',
  'https://icom-adhonepage.pqaykh.easypanel.host',
  ...(Deno.env.get('ADHONEP_PREVIEW_ORIGINS') || '').split(',').filter(Boolean),
]);
Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'Access-Control-Allow-Origin': allowed.has(origin) ? origin : [...allowed][0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowed.has(origin)) return reply({ error: 'Origem não autorizada.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
  try {
    const user = await currentUser(request);
    if (!user?.email || !user.email_confirmed_at || user.is_anonymous) return reply({ error: 'Confirme seu e-mail para concluir o cadastro.' }, 401);
    if (Number(request.headers.get('content-length') || 0) > 16000) return reply({ error: 'Formulário muito grande.' }, 413);
    const raw = await request.text();
    if (raw.length > 16000) return reply({ error: 'Formulário muito grande.' }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return reply({ error: 'Dados inválidos.' }, 400); }
    const { data, errors } = validateExpansion(input);
    if (Object.keys(errors).length) return reply({ error: 'Confira os campos destacados.', fields: errors }, 422);
    if (data.email !== user.email.toLowerCase()) return reply({ error: 'Use o mesmo e-mail da sua conta confirmada.' }, 403);
    // Identity comes ONLY from verified Auth, never from the submitted form.
    const { data: result, error } = await admin.rpc('adh_save_expansion_registration', { actor_id: user.id, verified_email: user.email.toLowerCase(), payload: data });
    if (error) {
      if (error.code === '23505') return reply({ error: 'Não foi possível vincular estes dados. Confira seu e-mail de acesso ou peça ajuda ao capítulo; não criaremos outro cadastro.' }, 409);
      if (error.code === 'P0001') return reply({ error: 'Aguarde um minuto antes de reenviar este cadastro.' }, 429);
      console.error('expansion_save_failed', { code: error.code });
      return reply({ error: 'Não foi possível salvar agora. Tente novamente em alguns instantes.' }, 503);
    }
    return reply({ ok: true, id: result });
  } catch {
    return reply({ error: 'Não foi possível concluir o cadastro. Tente novamente.' }, 503);
  }
});
