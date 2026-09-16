import { supabase, showMessage } from './supabase-client.js';

const login = document.querySelector('#member-login');
const dashboard = document.querySelector('#member-dashboard');
const memberHeader = document.querySelector('.members-top');
const form = document.querySelector('#member-access');
const message = document.querySelector('#member-message');
const businessList = document.querySelector('#business-list');
const roleNames = { member: 'Membro', business: 'Empresário', chapter_admin: 'Líder de capítulo', super_admin: 'Administrador geral' };
const statusNames = { clicked: 'Acesso registrado', registered: 'Cadastro realizado', contacted: 'Contato iniciado', converted: 'Negócio convertido', cancelled: 'Encerrado' };
let businesses = [];
let referrals = [];
let ownedBusinesses = [];
let currentProfile;
let currentUser;

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]); }
function emptyState(title, copy) { return `<div class="member-empty"><span>◇</span><b>${escapeHtml(title)}</b><p>${escapeHtml(copy)}</p></div>`; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Data não informada'; }

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

function showMemberView(view) {
  document.querySelectorAll('[data-member-panel]').forEach((panel) => {
    const active = panel.dataset.memberPanel === view;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
  document.querySelectorAll('[data-member-view]').forEach((button) => button.classList.toggle('active', button.dataset.memberView === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function businessProfileUrl(business) {
  const code = encodeURIComponent(currentProfile?.referral_code || '');
  return `empresas.html?empresa=${encodeURIComponent(business.slug || business.id)}&ref=${code}`;
}

function renderBusinesses(items) {
  if (!items.length) { businessList.innerHTML = emptyState('Nenhuma empresa encontrada', 'Tente buscar por outro nome, segmento ou cidade.'); return; }
  businessList.innerHTML = items.map((business) => {
    const city = business.adh_chapters?.city || 'Vale do Paraíba';
    const logo = business.logo_url || 'assets/logo-adhonep-fundo-branco.png';
    return `<article class="member-business-card"><div class="member-business-logo"><img src="${escapeHtml(logo)}" alt="Logo da ${escapeHtml(business.name)}"></div><small>${escapeHtml(business.segment)} • ${escapeHtml(city)}</small><h3>${escapeHtml(business.name)}</h3><p>${escapeHtml(business.short_description || business.description || 'Empresa integrante da comunidade ADHONEP.')}</p><div><a href="${escapeHtml(businessProfileUrl(business))}" data-refer-business="${business.id}">Conhecer e indicar →</a></div></article>`;
  }).join('');
}

function renderReferrals() {
  const target = document.querySelector('#member-referrals-list');
  if (!referrals.length) { target.innerHTML = emptyState('Nenhuma indicação registrada', 'Abra a área de empresas e use “Conhecer e indicar” para começar.'); return; }
  target.innerHTML = referrals.map((item) => `<article><span class="timeline-dot"></span><div><small>${escapeHtml(item.adh_businesses?.name || 'Empresa da comunidade')}</small><b>${escapeHtml(statusNames[item.status] || item.status)}</b><p>${formatDate(item.created_at)}${item.points_awarded ? ` • ${item.points_awarded} pontos` : ''}</p></div><em>${item.status === 'converted' ? '✓' : '→'}</em></article>`).join('');
}

function renderOwnedBusinesses() {
  const target = document.querySelector('#member-company-list');
  if (!ownedBusinesses.length) { target.innerHTML = emptyState('Nenhuma empresa vinculada', 'A ativação do perfil empresarial é feita pelo líder do capítulo após a confirmação da assinatura.'); return; }
  target.innerHTML = ownedBusinesses.map((business) => `<article><img src="${escapeHtml(business.logo_url || 'assets/logo-adhonep-fundo-branco.png')}" alt="Logo da ${escapeHtml(business.name)}"><div><small>${escapeHtml(business.segment)} • ${escapeHtml(business.adh_chapters?.city || '')}</small><h3>${escapeHtml(business.name)}</h3><p>${escapeHtml(business.short_description || business.description || '')}</p><span class="status-pill ${business.status}">${business.status === 'active' ? 'Publicado' : escapeHtml(business.status)}</span></div><a href="${escapeHtml(businessProfileUrl(business))}">Ver perfil público ↗</a></article>`).join('');
}

async function loadContacts() {
  const target = document.querySelector('#member-contacts-list');
  if (!ownedBusinesses.length) { target.innerHTML = emptyState('Nenhum perfil empresarial vinculado', 'Os contatos aparecem quando uma empresa está associada à sua conta.'); return; }
  const { data, error } = await supabase.from('adh_referrals').select('*,adh_businesses(name)').in('business_id', ownedBusinesses.map((business) => business.id)).order('created_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) { target.innerHTML = emptyState('Nenhum contato recebido', 'Assim que alguém indicar ou procurar sua empresa, a oportunidade aparecerá aqui.'); return; }
  target.innerHTML = data.map((item) => `<article><span class="timeline-dot"></span><div><small>${escapeHtml(item.adh_businesses?.name || 'Sua empresa')}</small><b>${escapeHtml(item.visitor_name || 'Visitante indicado')}</b><p>${escapeHtml(item.visitor_contact || 'Contato ainda não informado')} • ${formatDate(item.created_at)}</p></div><em>${escapeHtml(statusNames[item.status] || item.status)}</em></article>`).join('');
}

async function loadFeedbackHistory() {
  const target = document.querySelector('#member-feedback-list');
  const { data, error } = await supabase.from('adh_feedback').select('rating,message,requires_attention,created_at,adh_businesses(name)').eq('author_id', currentUser.id).order('created_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) { target.innerHTML = emptyState('Você ainda não avaliou', 'Depois de uma experiência com uma empresa, registre sua percepção de forma privada.'); return; }
  target.innerHTML = data.map((item) => `<article><span class="rating-stars">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</span><div><small>${escapeHtml(item.adh_businesses?.name || 'Empresa avaliada')}</small><b>${item.requires_attention ? 'Enviado com atenção ao líder' : 'Avaliação registrada'}</b><p>${escapeHtml(item.message || 'Sem comentário')} • ${formatDate(item.created_at)}</p></div></article>`).join('');
}

async function recordReferral(businessId) {
  const { error } = await supabase.from('adh_referrals').insert({ referrer_id: currentUser.id, business_id: businessId, status: 'clicked' });
  if (!error) {
    referrals.unshift({ business_id: businessId, status: 'clicked', created_at: new Date().toISOString(), points_awarded: 0, adh_businesses: { name: businesses.find((business) => business.id === businessId)?.name } });
    renderReferrals();
    document.querySelector('#metric-clicks').textContent = referrals.length;
  }
}

async function loadDashboard(user) {
  currentUser = user;
  currentProfile = await ensureProfile(user);
  const isBusiness = ['business', 'super_admin'].includes(currentProfile.role);
  const businessQuery = supabase.from('adh_businesses').select('id,name,slug,segment,description,short_description,logo_url,website_url,instagram_url,whatsapp,status,owner_id,adh_chapters(city)').eq('status', 'active').order('name');
  const referralQuery = supabase.from('adh_referrals').select('id,status,points_awarded,created_at,adh_businesses(name)').eq('referrer_id', user.id).order('created_at', { ascending: false });
  let ownedQuery = supabase.from('adh_businesses').select('id,name,slug,segment,description,short_description,logo_url,status,adh_chapters(city)').order('name');
  if (currentProfile.role !== 'super_admin') ownedQuery = ownedQuery.eq('owner_id', user.id);
  const [{ data: businessRows, error: businessError }, { data: referralRows, error: referralError }, { data: ownedRows, error: ownedError }] = await Promise.all([businessQuery, referralQuery, ownedQuery]);
  const loadError = businessError || referralError || ownedError;
  if (loadError) throw loadError;
  businesses = businessRows || [];
  referrals = referralRows || [];
  ownedBusinesses = ownedRows || [];
  renderBusinesses(businesses); renderReferrals(); renderOwnedBusinesses();
  await Promise.all([loadContacts(), loadFeedbackHistory()]);
  document.querySelector('#metric-clicks').textContent = referrals.length;
  document.querySelector('#metric-registrations').textContent = referrals.filter((item) => item.status !== 'clicked').length;
  document.querySelector('#metric-conversions').textContent = referrals.filter((item) => item.status === 'converted').length;
  document.querySelector('#metric-points').textContent = currentProfile.points || 0;
  document.querySelector('#member-referral-link').textContent = `${location.origin}/empresas.html?ref=${currentProfile.referral_code}`;
  const displayName = currentProfile.full_name || user.email.split('@')[0];
  document.querySelector('#member-title').textContent = `Olá, ${displayName.split(' ')[0] || 'membro'}.`;
  document.querySelector('.member-avatar b').textContent = displayName;
  document.querySelector('.member-avatar > span').textContent = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  document.querySelector('#member-role-label').textContent = `${roleNames[currentProfile.role] || 'Membro'} • ADHONEP`;
  document.querySelectorAll('.business-only').forEach((item) => { item.hidden = !isBusiness; });
  document.querySelector('#feedback-business').innerHTML = businesses.map((business) => `<option value="${business.id}">${escapeHtml(business.name)}</option>`).join('');
  login.hidden = true; dashboard.hidden = false; memberHeader.hidden = true; showMemberView('overview');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage(message, 'Entrando...');
  const { data, error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#member-email').value.trim(), password: document.querySelector('#member-password').value });
  if (error) return showMessage(message, 'E-mail ou senha inválidos.', 'error');
  try { await loadDashboard(data.user); } catch (loadError) { showMessage(message, `Não foi possível carregar o painel: ${loadError.message}`, 'error'); }
});

document.querySelectorAll('[data-member-view]').forEach((button) => button.addEventListener('click', () => showMemberView(button.dataset.memberView)));
document.querySelectorAll('[data-go-member-view]').forEach((button) => button.addEventListener('click', () => showMemberView(button.dataset.goMemberView)));
document.querySelector('#member-reset').addEventListener('click', async () => {
  const email = document.querySelector('#member-email').value.trim();
  if (!email) return showMessage(message, 'Informe seu e-mail primeiro.', 'error');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/membros.html` });
  showMessage(message, error ? error.message : 'Enviamos as instruções para seu e-mail.', error ? 'error' : 'success');
});
document.querySelector('#member-exit').addEventListener('click', async () => { await supabase.auth.signOut(); dashboard.hidden = true; login.hidden = false; memberHeader.hidden = false; });
document.querySelector('[data-copy]').addEventListener('click', async (event) => { await navigator.clipboard.writeText(document.querySelector('#member-referral-link').textContent); event.currentTarget.textContent = 'Link copiado ✓'; });
document.querySelector('#business-search').addEventListener('input', (event) => { const term = event.target.value.toLocaleLowerCase('pt-BR'); renderBusinesses(businesses.filter((business) => `${business.name} ${business.segment} ${business.adh_chapters?.city || ''}`.toLocaleLowerCase('pt-BR').includes(term))); });
businessList.addEventListener('click', async (event) => { const link = event.target.closest('[data-refer-business]'); if (!link) return; event.preventDefault(); await recordReferral(link.dataset.referBusiness); location.href = link.href; });
document.querySelector('#feedback-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const status = document.querySelector('#feedback-status');
  const payload = { business_id: document.querySelector('#feedback-business').value, author_id: currentProfile.id, rating: Number(document.querySelector('#feedback-rating').value), message: document.querySelector('#feedback-message').value.trim() || null, requires_attention: document.querySelector('#feedback-attention').checked };
  const { error } = await supabase.from('adh_feedback').upsert(payload, { onConflict: 'business_id,author_id' });
  showMessage(status, error ? error.message : 'Avaliação registrada de forma privada.', error ? 'error' : 'success');
  if (!error) { event.currentTarget.reset(); await loadFeedbackHistory(); }
});

const { data: { user }, error: authError } = await supabase.auth.getUser();
if (user && !authError) { try { await loadDashboard(user); } catch (error) { showMessage(message, `Não foi possível carregar o painel: ${error.message}`, 'error'); } }
