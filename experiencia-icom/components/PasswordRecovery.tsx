'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Brand } from './Survey';
import { appPath } from '@/lib/paths';

export default function PasswordRecovery() {
  const [token, setToken] = useState(''), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [changed, setChanged] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const access = hash.get('access_token');
    const recovery = hash.get('type') === 'recovery';
    history.replaceState(null, '', location.pathname);
    Promise.resolve().then(() => {
      if (access && recovery) setToken(access);
      if (hash.has('error')) setError('Este link expirou ou já foi usado. Solicite outro abaixo.');
      setReady(true);
    });
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    const data = new FormData(e.currentTarget);
    if (token && data.get('password') !== data.get('confirm')) { setError('As senhas precisam ser iguais.'); setBusy(false); return; }
    try {
      const response = await fetch(appPath('/api/auth/recovery'), {
        method: token ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(token ? { password: data.get('password') } : { email: data.get('email') }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error);
      if (token) { setChanged(true); setToken(''); sessionStorage.removeItem('icom-session'); }
      else setMessage(result.message || 'Verifique sua caixa de entrada.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <main className="login"><Brand/><div className="login-card"><p className="eyebrow">ACESSO ICOM</p><h1>{changed ? 'Senha atualizada.' : token ? 'Crie sua nova senha.' : 'Recuperar senha.'}</h1>
    {changed ? <p>Sua senha do IcomKids foi atualizada. Entre novamente com a nova senha.</p> : <><p>{token ? 'Esta senha será usada na sua conta IcomKids.' : 'Informe o e-mail da sua conta para receber o link de recuperação.'}</p>
    <form onSubmit={submit}>{token ? <><label>Nova senha<input name="password" type="password" minLength={8} maxLength={128} required autoComplete="new-password"/></label><label>Confirmar nova senha<input name="confirm" type="password" minLength={8} required autoComplete="new-password"/></label></> : <label>E-mail<input name="email" type="email" required autoComplete="email"/></label>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}<button className="primary" disabled={!ready || busy}>{busy ? 'Aguarde…' : token ? 'SALVAR NOVA SENHA' : 'ENVIAR LINK DE RECUPERAÇÃO'}</button></form></>}
    <p style={{marginTop:20}}><Link href="/admin/experiencia">Voltar para o login</Link></p></div></main>;
}
