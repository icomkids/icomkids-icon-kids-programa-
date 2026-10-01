import { config, errorResponse } from '@/lib/server';
import { appPath } from '@/lib/paths';

export async function POST(req: Request) {
  try {
    const { email } = await req.json() as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }
    const { url, key } = config();
    // Fixed configured destination prevents recovery links being sent to an arbitrary host.
    const origin = process.env.APP_URL || 'https://sistema.icomkids.com.br';
    const redirect = `${origin}${appPath('/recuperar-senha')}`;
    const result = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!result.ok) {
      return Response.json({ error: 'Não foi possível enviar agora. Aguarde alguns minutos e tente novamente.' }, { status: result.status === 429 ? 429 : 400 });
    }
    return Response.json({ ok: true, message: 'Se este e-mail estiver cadastrado, você receberá um link para recuperar sua senha.' });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(req: Request) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return Response.json({ error: 'Abra o link enviado por e-mail.' }, { status: 401 });
    const { password } = await req.json() as { password?: string };
    if (!password || password.length < 8 || password.length > 128) return Response.json({ error: 'Use uma senha entre 8 e 128 caracteres.' }, { status: 400 });
    const { url, key } = config();
    const user = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization }, cache: 'no-store' });
    if (!user.ok) return Response.json({ error: 'O link expirou. Solicite outro e-mail de recuperação.' }, { status: 401 });
    const result = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT', headers: { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!result.ok) return Response.json({ error: 'Não foi possível alterar a senha. Use uma senha diferente ou solicite um novo link.' }, { status: 400 });
    await fetch(`${url}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: key, Authorization: authorization } });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
