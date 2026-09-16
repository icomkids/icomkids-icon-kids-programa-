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
let affiliateOffers = [];
let affiliations = [];
let ownedOffers = [];
let currentProfile;
let currentUser;

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]); }
function emptyState(title, copy) { return `<div class="member-empty"><span>◇</span><b>${escapeHtml(title)}</b><p>${escapeHtml(copy)}</p></div>`; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Data não informada'; }
function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)); }
function commissionLabel(offer) { return offer.commission_type === 'percentage' ? `${Number(offer.commission_value)}% da venda` : `${money(offer.commission_value)} por negócio`; }

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
  target.innerHTML = referrals.map((item) => `<article><span class="timeline-dot"></span><div><small>${escapeHtml(item.adh_businesses?.name || 'Empresa da comunidade')}</small><b>${escapeHtml(statusNames[item.status] || item.status)}</b><p>${formatDate(item.created_at)}${item.commission_amount ? ` • comissão ${money(item.commission_amount)}` : ''}${item.financial_status === 'paid' ? ' • paga' : ''}</p></div><em>${item.status === 'converted' ? '✓' : '→'}</em></article>`).join('');
}

function renderAffiliateOffers() {
  const joinedIds = new Set(affiliations.map((item) => item.offer_id));
  const target = document.querySelector('#affiliate-offers');
  target.innerHTML = affiliateOffers.length ? affiliateOffers.map((offer) => `<article class="affiliate-card"><small>${escapeHtml(offer.adh_businesses?.name || 'Empresa ADHONEP')}</small><h3>${escapeHtml(offer.title)}</h3><p>${escapeHtml(offer.description)}</p><strong>${escapeHtml(commissionLabel(offer))}</strong><button class="primary navy" type="button" data-join-offer="${offer.id}" ${joinedIds.has(offer.id) ? 'disabled' : ''}>${joinedIds.has(offer.id) ? 'Já afiliado ✓' : 'Quero me afiliar'}</button></article>`).join('') : emptyState('Nenhuma oferta disponível', 'Os empresários ainda não publicaram produtos ou serviços para afiliação.');

  const ledger = document.querySelector('#affiliate-memberships');
  ledger.innerHTML = affiliations.length ? affiliations.map((membership) => {
    const offer = membership.adh_affiliate_offers; const business = offer?.adh_businesses;
    const link = `${location.origin}/empresas.html?empresa=${encodeURIComponent(business?.slug || business?.id || '')}&offer=${offer?.id}&ref=${encodeURIComponent(currentProfile.referral_code)}`;
    return `<article class="affiliate-membership"><div><small>${escapeHtml(business?.name || '')}</small><h4>${escapeHtml(offer?.title || 'Oferta')}</h4><b>${escapeHtml(commissionLabel(offer || {}))}</b></div><div class="affiliate-actions"><button type="button" data-copy-offer="${escapeHtml(link)}">Copiar link</button><button type="button" data-open-referral="${membership.id}">Cadastrar indicação</button></div><form class="referral-lead-form" data-referral-form="${membership.id}" hidden><input name="name" placeholder="Nome da pessoa indicada" required /><input name="contact" placeholder="Telefone ou e-mail" required /><button class="primary navy">Registrar indicação</button></form></article>`;
  }).join('') : emptyState('Você ainda não se afiliou', 'Escolha uma oferta acima para gerar seu link exclusivo.');
}

function renderOwnedOffers() {
  const target = document.querySelector('#owned-offers');
  target.innerHTML = ownedOffers.length ? ownedOffers.map((offer) => `<article class="affiliate-card"><small>${escapeHtml(offer.adh_businesses?.name || '')}</small><h3>${escapeHtml(offer.title)}</h3><p>${escapeHtml(offer.description)}</p><strong>${escapeHtml(commissionLabel(offer))}</strong><button type="button" data-toggle-offer="${offer.id}">${offer.active ? 'Pausar oferta' : 'Reativar oferta'}</button></article>`).join('') : emptyState('Nenhuma oferta publicada', 'Crie a primeira condição de comissão para seus produtos ou serviços.');
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
  const referralQuery = supabase.from('adh_referrals').select('id,status,points_awarded,commission_amount,financial_status,created_at,adh_businesses(name)').eq('referrer_id', user.id).order('created_at', { ascending: false });
  let ownedQuery = supabase.from('adh_businesses').select('id,name,slug,segment,description,short_description,logo_url,status,adh_chapters(city)').order('name');
  if (currentProfile.role !== 'super_admin') ownedQuery = ownedQuery.eq('owner_id', user.id);
  const offerQuery = supabase.from('adh_affiliate_offers').select('*,adh_businesses(id,name,slug)').eq('active', true).order('created_at', { ascending: false });
  const affiliationQuery = supabase.from('adh_affiliations').select('*,adh_affiliate_offers(*,adh_businesses(id,name,slug))').eq('affiliate_id', user.id).eq('status', 'active').order('created_at', { ascending: false });
  const [{ data: businessRows, error: businessError }, { data: referralRows, error: referralError }, { data: ownedRows, error: ownedError }, { data: offerRows, error: offerError }, { data: affiliationRows, error: affiliationError }] = await Promise.all([businessQuery, referralQuery, ownedQuery, offerQuery, affiliationQuery]);
  const loadError = businessError || referralError || ownedError || offerError || affiliationError;
  if (loadError) throw loadError;
  businesses = businessRows || [];
  referrals = referralRows || [];
  ownedBusinesses = ownedRows || [];
  affiliateOffers = offerRows || []; affiliations = affiliationRows || [];
  if (ownedBusinesses.length) {
    const { data, error } = await supabase.from('adh_affiliate_offers').select('*,adh_businesses(name)').in('business_id', ownedBusinesses.map((item) => item.id)).order('created_at', { ascending: false });
    if (error) throw error; ownedOffers = data || [];
  } else ownedOffers = [];
  renderBusinesses(businesses); renderReferrals(); renderOwnedBusinesses(); renderAffiliateOffers(); renderOwnedOffers();
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
  document.querySelector('#offer-business').innerHTML = ownedBusinesses.map((business) => `<option value="${business.id}">${escapeHtml(business.name)}</option>`).join('');
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
document.querySelector('[data-copy]').addEventListener('click', async (event) => { const button = event.currentTarget; await navigator.clipboard.writeText(document.querySelector('#member-referral-link').textContent); button.textContent = 'Link copiado ✓'; });
document.querySelector('#business-search').addEventListener('input', (event) => { const term = event.target.value.toLocaleLowerCase('pt-BR'); renderBusinesses(businesses.filter((business) => `${business.name} ${business.segment} ${business.adh_chapters?.city || ''}`.toLocaleLowerCase('pt-BR').includes(term))); });
businessList.addEventListener('click', async (event) => { const link = event.target.closest('[data-refer-business]'); if (!link) return; event.preventDefault(); await recordReferral(link.dataset.referBusiness); location.href = link.href; });
document.querySelector('#affiliate-offers').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-join-offer]'); if (!button) return; button.disabled = true;
  const { error } = await supabase.from('adh_affiliations').insert({ offer_id: button.dataset.joinOffer, affiliate_id: currentUser.id });
  if (error) { button.disabled = false; return alert(`Não foi possível concluir a afiliação: ${error.message}`); }
  const { data } = await supabase.from('adh_affiliations').select('*,adh_affiliate_offers(*,adh_businesses(id,name,slug))').eq('affiliate_id', currentUser.id).eq('status', 'active').order('created_at', { ascending: false });
  affiliations = data || []; renderAffiliateOffers();
});
document.querySelector('#affiliate-memberships').addEventListener('click', async (event) => {
  const copy = event.target.closest('[data-copy-offer]');
  if (copy) { await navigator.clipboard.writeText(copy.dataset.copyOffer); copy.textContent = 'Link copiado ✓'; return; }
  const open = event.target.closest('[data-open-referral]'); if (open) document.querySelector(`[data-referral-form="${open.dataset.openReferral}"]`).hidden = false;
});
document.querySelector('#affiliate-memberships').addEventListener('submit', async (event) => {
  const leadForm = event.target.closest('[data-referral-form]'); if (!leadForm) return; event.preventDefault();
  const membership = affiliations.find((item) => item.id === leadForm.dataset.referralForm); if (!membership) return;
  const payload = { affiliation_id: membership.id, offer_id: membership.offer_id, referrer_id: currentUser.id, business_id: membership.adh_affiliate_offers.business_id, visitor_name: leadForm.elements.name.value.trim(), visitor_contact: leadForm.elements.contact.value.trim(), status: 'registered' };
  const { data, error } = await supabase.from('adh_referrals').insert(payload).select('id,status,commission_amount,financial_status,created_at,adh_businesses(name)').single();
  if (error) return alert(`Não foi possível registrar: ${error.message}`);
  referrals.unshift(data); renderReferrals(); leadForm.reset(); leadForm.hidden = true; alert('Indicação registrada e enviada para acompanhamento.');
});
document.querySelector('#offer-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const offerForm = event.currentTarget; const status = document.querySelector('#offer-status');
  const payload = { business_id: document.querySelector('#offer-business').value, title: document.querySelector('#offer-title').value.trim(), description: document.querySelector('#offer-description').value.trim(), commission_type: document.querySelector('#offer-type').value, commission_value: Number(document.querySelector('#offer-value').value), created_by: currentUser.id };
  const { data, error } = await supabase.from('adh_affiliate_offers').insert(payload).select('*,adh_businesses(name)').single();
  showMessage(status, error ? error.message : 'Oferta publicada para os membros.', error ? 'error' : 'success');
  if (!error) { ownedOffers.unshift(data); affiliateOffers.unshift(data); offerForm.reset(); renderOwnedOffers(); renderAffiliateOffers(); }
});
document.querySelector('#owned-offers').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-toggle-offer]'); if (!button) return; const offer = ownedOffers.find((item) => item.id === button.dataset.toggleOffer); if (!offer) return;
  const { error } = await supabase.from('adh_affiliate_offers').update({ active: !offer.active }).eq('id', offer.id); if (error) return alert(error.message);
  offer.active = !offer.active; affiliateOffers = ownedOffers.filter((item) => item.active); renderOwnedOffers(); renderAffiliateOffers();
});
document.querySelector('#feedback-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const status = document.querySelector('#feedback-status');
  const payload = { business_id: document.querySelector('#feedback-business').value, author_id: currentProfile.id, rating: Number(document.querySelector('#feedback-rating').value), message: document.querySelector('#feedback-message').value.trim() || null, requires_attention: document.querySelector('#feedback-attention').checked };
  const { error } = await supabase.from('adh_feedback').upsert(payload, { onConflict: 'business_id,author_id' });
  showMessage(status, error ? error.message : 'Avaliação registrada de forma privada.', error ? 'error' : 'success');
  if (!error) { form.reset(); await loadFeedbackHistory(); }
});

const { data: { user }, error: authError } = await supabase.auth.getUser();
if (user && !authError) { try { await loadDashboard(user); } catch (error) { showMessage(message, `Não foi possível carregar o painel: ${error.message}`, 'error'); } }
