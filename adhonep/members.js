import { supabase, showMessage } from './supabase-client.js';

const login = document.querySelector('#member-login');
const dashboard = document.querySelector('#member-dashboard');
const form = document.querySelector('#member-access');
const message = document.querySelector('#member-message');
const businessList = document.querySelector('#business-list');
let businesses = [];
let currentProfile;

async function ensureProfile(user) {
  let { data, error } = await supabase.from('adh_profiles').select('*').eq('id', user.id).maybeSingle();
  if (!data && !error) {
    const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
    const result = await supabase.from('adh_profiles').insert({ id: user.id, full_name: fullName }).select().single();
    data = result.data; error = result.error;
  }
  if (error) throw error;
  return data;
}

function renderBusinesses(items) {
  businessList.innerHTML = '';
  items.forEach((business) => {
    const row = document.createElement('div');
    row.className = 'business-result';
    const city = business.adh_chapters?.city || 'Vale do Paraíba';
    row.innerHTML = '<b></b><span></span><a target="_blank" rel="noreferrer">Conhecer empresa →</a>';
    row.querySelector('b').textContent = business.name;
    row.querySelector('span').textContent = `${business.segment} • ${city}`;
    const link = row.querySelector('a');
    link.href = business.website_url || business.instagram_url || `https://wa.me/${(business.whatsapp || '').replace(/\D/g, '')}`;
    businessList.append(row);
  });
}

async function loadDashboard(user) {
  currentProfile = await ensureProfile(user);
  const [{ data: referralRows }, { data: businessRows, error }] = await Promise.all([
    supabase.from('adh_referrals').select('status').eq('referrer_id', user.id),
    supabase.from('adh_businesses').select('id,name,segment,website_url,instagram_url,whatsapp,adh_chapters(city)').eq('status', 'active').order('name'),
  ]);
  if (error) throw error;
  businesses = businessRows || [];
  renderBusinesses(businesses);
  const referrals = referralRows || [];
  document.querySelector('#metric-clicks').textContent = referrals.length;
  document.querySelector('#metric-registrations').textContent = referrals.filter((x) => x.status !== 'clicked').length;
  document.querySelector('#metric-conversions').textContent = referrals.filter((x) => x.status === 'converted').length;
  document.querySelector('#metric-points').textContent = currentProfile.points;
  document.querySelector('.referral-card strong').textContent = `${location.origin}/membros.html?ref=${currentProfile.referral_code}`;
  document.querySelector('#member-title').textContent = `Olá, ${currentProfile.full_name.split(' ')[0] || 'membro'}.`;
  document.querySelector('.member-avatar b').textContent = currentProfile.full_name;
  document.querySelector('.member-avatar > span').textContent = currentProfile.full_name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  document.querySelectorAll('.business-only').forEach((item) => { item.hidden = currentProfile.role !== 'business'; });
  document.querySelector('#feedback-business').innerHTML = businesses.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
  login.hidden = true; dashboard.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage(message, 'Entrando...');
  const { data, error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#member-email').value.trim(), password: document.querySelector('#member-password').value });
  if (error) return showMessage(message, error.message, 'error');
  try { await loadDashboard(data.user); } catch (loadError) { showMessage(message, loadError.message, 'error'); }
});

document.querySelector('#member-signup').addEventListener('click', async () => {
  const email = document.querySelector('#member-email').value.trim();
  const password = document.querySelector('#member-password').value;
  const fullName = document.querySelector('#member-name').value.trim();
  if (!fullName || !email || password.length < 8) return showMessage(message, 'Informe nome, e-mail e uma senha com pelo menos 8 caracteres.', 'error');
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${location.origin}/membros.html` } });
  if (error) return showMessage(message, error.message, 'error');
  if (data.session) await loadDashboard(data.user); else showMessage(message, 'Conta criada. Confira seu e-mail para confirmar o acesso.', 'success');
});

document.querySelector('#member-reset').addEventListener('click', async () => {
  const email = document.querySelector('#member-email').value.trim();
  if (!email) return showMessage(message, 'Informe seu e-mail primeiro.', 'error');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/membros.html` });
  showMessage(message, error ? error.message : 'Enviamos as instruções para seu e-mail.', error ? 'error' : 'success');
});

document.querySelector('#member-exit').addEventListener('click', async () => { await supabase.auth.signOut(); dashboard.hidden = true; login.hidden = false; });
document.querySelector('[data-copy]').addEventListener('click', async (event) => { await navigator.clipboard.writeText(document.querySelector('.referral-card strong').textContent); event.currentTarget.textContent = 'Link copiado ✓'; });
document.querySelector('#business-search').addEventListener('input', (event) => { const term = event.target.value.toLocaleLowerCase('pt-BR'); renderBusinesses(businesses.filter((x) => `${x.name} ${x.segment} ${x.adh_chapters?.city || ''}`.toLocaleLowerCase('pt-BR').includes(term))); });
document.querySelector('#feedback-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const status = document.querySelector('#feedback-status');
  const payload = { business_id: document.querySelector('#feedback-business').value, author_id: currentProfile.id, rating: Number(document.querySelector('#feedback-rating').value), message: document.querySelector('#feedback-message').value.trim() || null };
  const { error } = await supabase.from('adh_feedback').upsert(payload, { onConflict: 'business_id,author_id' });
  showMessage(status, error ? error.message : 'Avaliação registrada de forma privada.', error ? 'error' : 'success');
});

const { data: { session } } = await supabase.auth.getSession();
if (session) { try { await loadDashboard(session.user); } catch (error) { showMessage(message, error.message, 'error'); } }
