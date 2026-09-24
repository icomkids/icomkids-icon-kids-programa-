// Authentication is independent of dashboard data and never revokes other devices.
import { incomingAuthLink, isRecoverySession } from './auth-link.js';
export function withTimeout(promise, milliseconds = 15000, message = 'O servidor demorou para responder. Tente novamente.') {
  let timer;
  return Promise.race([Promise.resolve(promise), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}

export function friendlyAuthError(error) {
  const detail = String(error?.message || error || '');
  if (/invalid login credentials/i.test(detail)) return 'E-mail ou senha incorretos. Confira os dados ou use “Esqueci minha senha”.';
  if (/email not confirmed/i.test(detail)) return 'Confirme seu e-mail pelo convite recebido antes de entrar.';
  if (/permission denied|row-level security|schema/i.test(detail)) return 'Sua conta foi reconhecida, mas o banco de dados recusou a consulta de acesso. Isso precisa ser corrigido na configuração do sistema; não é erro de senha.';
  if (/failed to fetch|network|load failed|abort|timeout/i.test(detail)) return 'A conexão com o servidor falhou ou demorou demais. Confira sua internet e tente novamente.';
  if (/refresh token|jwt expired/i.test(detail)) return 'A sessão anterior expirou. Entre novamente com seu e-mail e senha.';
  if (/rate limit|too many requests|429/i.test(detail)) return 'Foram feitas muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  return detail || 'Não foi possível concluir o acesso. Tente novamente.';
}

export function createAccessFlow({ auth, open, onState, timeout = 15000 }) {
  let busy = false;
  async function run(action) {
    if (busy) return false;
    busy = true;
    onState({ busy: true, message: 'Conectando com segurança…' });
    try {
      const user = await withTimeout(action(), timeout);
      if (user) {
        onState({ busy: true, message: 'Conta confirmada. Verificando seu acesso…' });
        await open(user);
      }
      onState({ busy: true, message: '' });
      return true;
    } catch (error) {
      onState({ busy: true, message: friendlyAuthError(error), kind: 'error' });
      return false;
    } finally { busy = false; onState({ busy: false }); }
  }
  return {
    signIn: (email, password) => run(async () => {
      const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data?.user) throw new Error('O servidor não confirmou o usuário. Tente novamente.');
      return data.user;
    }),
    restore: () => run(async () => {
      const { data, error } = await auth.getSession();
      if (error) throw error;
      return data?.session?.user;
    }),
  };
}

export function mountAccess({ supabase, form, message, email, password, open, exit, close }) {
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = submit.textContent;
  const reset = form.querySelector('[data-reset-password]');
  const retry = form.querySelector('[data-retry-access]');
  function show(text, kind = 'info') { message.textContent = text; message.dataset.kind = kind; message.hidden = !text; }
  const flow = createAccessFlow({ auth: supabase.auth, open, onState(state) {
    submit.disabled = state.busy;
    if (reset) reset.disabled = state.busy;
    if (retry) retry.disabled = state.busy;
    form.setAttribute('aria-busy', String(state.busy));
    submit.textContent = state.busy ? 'Aguarde…' : submitLabel;
    if ('message' in state) show(state.message, state.kind);
    if (state.kind === 'error') { message.tabIndex = -1; message.focus(); if (retry) retry.hidden = false; }
  } });
  form.addEventListener('submit', (event) => { event.preventDefault(); flow.signIn(email.value, password.value); });
  retry?.addEventListener('click', () => flow.restore());
  form.querySelector('[data-toggle-password]')?.addEventListener('click', (event) => {
    const visible = password.type === 'password'; password.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar'; event.currentTarget.setAttribute('aria-pressed', String(visible));
  });
  reset?.addEventListener('click', async () => {
    if (!email.value.trim() || !email.checkValidity()) { show('Preencha um e-mail válido acima para receber o link de recuperação.', 'error'); email.focus(); return; }
    reset.disabled = true; show('Solicitando o link de recuperação…');
    try {
      const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: `${location.origin}/membros.html` }));
      if (error) throw error;
      show('Se houver uma conta com esse e-mail, você receberá o link para definir a senha. Confira também o spam.', 'success');
    } catch (error) { show(friendlyAuthError(error), 'error'); } finally { reset.disabled = false; }
  });
  exit?.addEventListener('click', async () => {
    exit.disabled = true;
    try {
      const { error } = await withTimeout(supabase.auth.signOut({ scope: 'local' }));
      if (error) throw error;
      password.value = ''; close(); show('Você saiu com segurança.');
    } catch (error) { close(); show(friendlyAuthError(error), 'error'); } finally { exit.disabled = false; }
  });
  // portal-entry captures this before the SDK consumes the URL fragment.
  if (['invite', 'recovery'].includes(incomingAuthLink.type)) {
    const recovery = document.createElement('form'); recovery.className = 'password-recovery';
    recovery.innerHTML = '<h2>Defina sua senha</h2><p>Use pelo menos 8 caracteres para proteger seu acesso.</p><label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirme a senha<input name="confirmation" type="password" autocomplete="new-password" minlength="8" required></label><button type="submit">Salvar senha e entrar</button><p role="status" class="auth-message" hidden></p>';
    form.hidden = true; form.after(recovery);
    recovery.addEventListener('submit', async (event) => {
      event.preventDefault(); const button = recovery.querySelector('button'); const feedback = recovery.querySelector('[role="status"]'); const pass = recovery.elements.password.value;
      feedback.hidden = false;
      if (pass !== recovery.elements.confirmation.value) { feedback.textContent = 'As senhas precisam ser iguais.'; return; }
      button.disabled = true; feedback.textContent = 'Salvando sua senha…';
      try {
        const { data, error: sessionError } = await withTimeout(supabase.auth.getSession());
        if (sessionError || !isRecoverySession(data?.session)) throw new Error('Este link expirou. Solicite um novo link em “Esqueci minha senha”.');
        const { error } = await withTimeout(supabase.auth.updateUser({ password: pass }));
        if (error) throw error;
        recovery.remove(); form.hidden = false; await flow.restore();
      } catch (error) { feedback.textContent = friendlyAuthError(error); } finally { button.disabled = false; }
    });
    const back = document.createElement('button'); back.type = 'button'; back.textContent = 'Voltar ao login'; back.className = 'access-text-button';
    back.addEventListener('click', () => { recovery.remove(); form.hidden = false; submit.disabled = false; }); recovery.append(back);
    return flow;
  }
  flow.restore();
  return flow;
}
