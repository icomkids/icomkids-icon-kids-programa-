import { SECTORS, TICKETS, GOALS, CONNECTIONS, validateExpansion, formatPhone } from './expansion-schema.js';
import { expansionConfig } from './expansion-config.js';
import { withTimeout, friendlyAuthError } from './portal-auth.js?v=2';

const form = document.querySelector('#expansion-form');
const button = document.querySelector('#submit-expansion');
const feedback = document.querySelector('#form-feedback');
const success = document.querySelector('#expansion-success');
const draftKey = 'adh-expansion-draft-v1';
let busy = false; let started = false; let lastMailAt = 0; let clientPromise;
const client = () => clientPromise ||= withTimeout(import('./supabase-client.js?v=2').then(module => module.supabase), 15000, 'Não foi possível carregar o acesso. Recarregue a página para tentar novamente.').catch(error => { clientPromise = null; throw error; });
// Only reuse analytics if installed by the host; never introduce a tracker or send PII.
function track(event) { if (typeof window.gtag === 'function') window.gtag('event', event); }
function message(text, kind = 'info') { feedback.textContent = text; feedback.dataset.kind = kind; feedback.hidden = !text; }
function setBusy(value) { busy = value; button.disabled = value; button.textContent = value ? 'Enviando...' : 'Enviar respostas →'; form.setAttribute('aria-busy', String(value)); }
function choice(target, name, type, value, text) {
  const label = document.createElement('label'); label.className = 'choice';
  const input = document.createElement('input'); input.type = type; input.name = name; input.value = value;
  input.setAttribute('aria-describedby', `${name}-error`); if (type === 'radio') input.required = true;
  label.append(input, document.createTextNode(text)); document.querySelector(target).append(label);
}
for (const sector of SECTORS) { const option = document.createElement('option'); option.textContent = sector; option.value = sector; form.elements.business_sector.append(option); }
Object.entries(TICKETS).forEach(([value, text]) => choice('#ticket-options', 'average_ticket', 'radio', value, text));
GOALS.forEach(text => choice('#goal-options', 'networking_goals', 'checkbox', text, text));
CONNECTIONS.forEach(text => choice('#connection-options', 'desired_connections', 'checkbox', text, text));
function toggleOther() { const other = form.elements.business_sector.value === 'Outro'; document.querySelector('#other-sector').hidden = !other; form.elements.business_sector_other.required = other; }
form.elements.business_sector.addEventListener('change', toggleOther);
form.elements.whatsapp.addEventListener('input', event => { event.target.value = formatPhone(event.target.value); });
form.elements.business_description.addEventListener('input', () => { document.querySelector('#description-count').textContent = `${form.elements.business_description.value.length} / 1500 caracteres`; });
form.addEventListener('input', () => { if (!started) { started = true; track('expansion_form_started'); } });
function readForm() {
  const fields = new FormData(form); const input = Object.fromEntries(fields);
  input.networking_goals = fields.getAll('networking_goals'); input.desired_connections = fields.getAll('desired_connections');
  input.marketing_opt_in = fields.has('marketing_opt_in') ? fields.get('marketing_opt_in') === 'true' : null;
  return input;
}
function fillForm(data) {
  for (const field of form.elements) {
    if (!field.name || !(field.name in data)) continue;
    if (field.type === 'checkbox') field.checked = (data[field.name] || []).includes(field.value);
    else if (field.type === 'radio') field.checked = String(data[field.name]) === field.value;
    else field.value = data[field.name] ?? '';
  }
  toggleOther(); form.elements.business_description.dispatchEvent(new Event('input'));
}
function showErrors(errors) {
  form.querySelectorAll('.field-error').forEach(item => { item.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach(item => item.removeAttribute('aria-invalid'));
  for (const [name, text] of Object.entries(errors)) {
    const hint = document.getElementById(`${name}-error`); if (hint) hint.textContent = text;
    form.querySelectorAll(`[name="${name}"]`).forEach(item => item.setAttribute('aria-invalid', 'true'));
  }
  const first = form.querySelector('[aria-invalid=true]'); if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
function saveDraft(data) {
  try { localStorage.setItem(draftKey, JSON.stringify({ expires: Date.now() + 3600000, data })); }
  catch { throw new Error('O navegador não permitiu guardar suas respostas durante a confirmação. Permita o armazenamento deste site e tente novamente.'); }
}
function loadDraft() {
  try { const draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (draft?.expires > Date.now() && draft.data) return draft.data; localStorage.removeItem(draftKey); } catch { /* storage unavailable */ }
  return null;
}
function removeDraft() { try { localStorage.removeItem(draftKey); } catch { /* private mode */ } }
async function persist(supabase, data) {
  const { data: result, error } = await withTimeout(supabase.functions.invoke('register-adhonep-expansion', { body: data }), 18000, 'O servidor demorou para confirmar. Seus dados continuam no formulário; tente novamente.');
  if (error || !result?.ok) {
    let detail = result;
    try { detail ||= await error?.context?.clone().json(); } catch { /* gateway response */ }
    if (detail?.fields) showErrors(detail.fields);
    throw new Error(detail?.error || 'Não foi possível confirmar o cadastro. Tente novamente; não será criado um cadastro duplicado.');
  }
  removeDraft(); form.hidden = true; success.hidden = false; success.focus(); track('expansion_form_success');
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const { data, errors } = validateExpansion(readForm()); showErrors(errors);
  if (Object.keys(errors).length) { message('Confira os campos destacados antes de continuar.', 'error'); return; }
  setBusy(true); message('Validando seu acesso…'); track('expansion_form_submitted');
  try {
    const supabase = await client();
    const { data: sessionData, error } = await withTimeout(supabase.auth.getSession()); if (error) throw error;
    const session = sessionData?.session;
    if (session && session.user.email?.toLowerCase() !== data.email) throw new Error('Você está conectado com outro e-mail. Use o e-mail da sua conta ou saia pela área de membros antes de cadastrar outra pessoa.');
    if (session) { message('Salvando seu cadastro…'); await persist(supabase, data); }
    else {
      if (Date.now() - lastMailAt < 60000) throw new Error('O link já foi solicitado. Aguarde um minuto antes de solicitar novamente.');
      saveDraft(data);
      const { error: mailError } = await withTimeout(supabase.auth.signInWithOtp({ email: data.email, options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/expansao.html?confirmar=1`, data: { full_name: data.full_name } } }));
      if (mailError) throw mailError;
      lastMailAt = Date.now();
      message('Confira seu e-mail e abra o link neste mesmo navegador para confirmar sua identidade. Suas respostas ficam guardadas neste dispositivo por até 1 hora e serão salvas após a confirmação. Confira também o spam.'); feedback.focus();
    }
  } catch (error) { message(friendlyAuthError(error), 'error'); feedback.focus(); track('expansion_form_error'); }
  finally { setBusy(false); }
});
document.querySelector('#edit-registration').addEventListener('click', () => { form.hidden = false; success.hidden = true; message('Revise e envie para atualizar o mesmo cadastro.'); form.elements.full_name.focus(); });
function safeGroup(url) { try { const parsed = new URL(url); return parsed.protocol === 'https:' && parsed.hostname === 'chat.whatsapp.com' && parsed.pathname.length > 5; } catch { return false; } }
if (safeGroup(expansionConfig.whatsappGroupUrl)) {
  const link = document.querySelector('#whatsapp-group'); link.href = expansionConfig.whatsappGroupUrl; link.hidden = false;
  document.querySelector('#connection-title').textContent = 'Acesse pelo link do grupo'; document.querySelector('.connection-member').hidden = true;
  if (/^(?:assets\/)[\w/.-]+\.(?:png|webp|jpg|svg)$/.test(expansionConfig.whatsappQrImage)) {
    document.querySelector('#group-qr-image').src = expansionConfig.whatsappQrImage; document.querySelector('#group-qr').hidden = false;
  }
}
if (expansionConfig.privacyPolicyUrl) {
  const url = new URL(expansionConfig.privacyPolicyUrl, location.origin);
  if (url.protocol === 'https:' || url.origin === location.origin) { const link = document.querySelector('#privacy-link'); link.href = url.href; link.hidden = false; }
}
track('expansion_form_view'); button.disabled = false;
const draft = loadDraft(); if (draft) fillForm(draft);
// No background polling or automatic refresh of form data.
if (new URLSearchParams(location.search).has('confirmar')) {
  setBusy(true); message('Confirmando o link recebido por e-mail…');
  try {
    const supabase = await client(); const { data, error } = await withTimeout(supabase.auth.getSession());
    if (error || !data?.session) throw new Error('O link expirou ou já foi utilizado. Envie o formulário novamente para receber outro link.');
    history.replaceState(null, '', location.pathname);
    if (draft && data.session.user.email?.toLowerCase() === draft.email) {
      const validated = validateExpansion(draft);
      if (Object.keys(validated.errors).length) throw new Error('Revise os campos para concluir seu cadastro.');
      await persist(supabase, validated.data);
    } else { form.elements.email.value = data.session.user.email || ''; message('E-mail confirmado. Preencha os dados e envie o formulário para concluir. Se preencheu em outro dispositivo, volte a ele para recuperar suas respostas.'); }
  } catch (error) { message(friendlyAuthError(error), 'error'); track('expansion_form_error'); }
  finally { setBusy(false); }
} else {
  // One bounded read when an existing member revisits. Never poll the database.
  try {
    const supabase = await client(); const { data, error } = await withTimeout(supabase.auth.getSession());
    if (error) throw error;
    if (data?.session) {
      const notice = document.querySelector('#session-notice'); notice.hidden = false; notice.textContent = 'Você já está conectado. Ao enviar, seu perfil de networking será criado ou atualizado na mesma conta.';
      const { data: saved, error: loadError } = await supabase.from('adh_leads').select('name,company,job_title,city,email,whatsapp,instagram,business_sector,business_sector_other,main_product_service,average_ticket,networking_goals,desired_connections,marketing_opt_in,business_description').eq('user_id', data.session.user.id).eq('source_page', 'adhonep_expansao_form').maybeSingle();
      if (loadError) { notice.textContent = 'Sua conta está conectada, mas não foi possível carregar seu cadastro anterior. Recarregue para tentar novamente antes de editar.'; }
      else if (!started && saved && (!draft || draft.email !== data.session.user.email?.toLowerCase())) fillForm({ ...saved, full_name: saved.name, company_name: saved.company });
      form.elements.email.value = data.session.user.email || '';
    }
  } catch { message('O acesso não pôde ser carregado agora. Você pode preencher o formulário e tentar o envio novamente.', 'error'); }
}
