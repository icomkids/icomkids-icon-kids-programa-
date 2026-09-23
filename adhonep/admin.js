import { supabase, showMessage } from './supabase-client.js';

const access = document.querySelector('#admin-access');
const shell = document.querySelector('#admin-shell');
const loginMessage = document.querySelector('#admin-message');
const statusMessage = document.querySelector('#admin-status');
let profile;
let chapters = [];
let businesses = [];
let events = [];
let financialReferrals = [];
let managedChapterIds = [];
let editingChapterId = null;
let editingBusinessId = null;
let editingEventId = null;
const MEDIA_BUCKET = 'adhonep-business-media';
const EVENT_MEDIA_BUCKET = 'adhonep-event-media';

function options(items) { return items.map((x) => `<option value="${x.id}">${x.name} — ${x.city}</option>`).join(''); }
function renderRows(target, rows, empty = 'Nenhum registro cadastrado.') {
  target.replaceChildren();
  if (!rows.length) { const item = document.createElement('p'); item.className = 'empty-admin-list'; item.textContent = empty; target.append(item); return; }
  rows.forEach(({ title, detail, status, onEdit, onDelete }) => {
    const row = document.createElement('div'); row.className = 'admin-list-item';
    const content = document.createElement('div'); content.className = 'admin-row-content';
    const name = document.createElement('b'); const description = document.createElement('small');
    name.textContent = title; description.textContent = detail; content.append(name, description); row.append(content);
    const controls = document.createElement('div'); controls.className = 'admin-row-controls';
    if (status) { const badge = document.createElement('span'); badge.className = `admin-badge ${['Ativo', 'Publicado', 'Patrocinador'].includes(status) ? 'is-active' : ''}`; badge.textContent = status; controls.append(badge); }
    if (onEdit) { const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'admin-action'; edit.textContent = 'Editar'; edit.addEventListener('click', onEdit); controls.append(edit); }
    if (onDelete) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'admin-action danger'; remove.textContent = 'Excluir'; remove.addEventListener('click', onDelete); controls.append(remove); }
    row.append(controls); target.append(row);
  });
}
function setBusy(form, busy) {
  const button = form?.querySelector('button[type="submit"],button:not([type])');
  if (button) button.disabled = busy;
}
async function functionFailure(error, data) {
  if (data?.error) return data.error;
  try { const body = await error?.context?.clone?.().json(); if (body?.error) return body.error; } catch { /* resposta sem JSON */ }
  return error?.message || null;
}
function value(id) { return document.querySelector(id).value.trim(); }
function setValue(id, next = '') { const field = document.querySelector(id); if (field) field.value = next ?? ''; }
function toLocalParts(dateValue) {
  const date = new Date(dateValue); const pad = (number) => String(number).padStart(2, '0');
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}
function fileExtension(file) { return (file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'webp')).toLowerCase(); }
async function videoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video'); const url = URL.createObjectURL(file);
    video.preload = 'metadata'; video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível validar o vídeo.')); }; video.src = url;
  });
}
async function validateMedia(logo, cover, video) {
  for (const image of [logo, cover].filter(Boolean)) if (image.size > 5 * 1024 * 1024) throw new Error(`${image.name}: imagem maior que 5 MB.`);
  if (video) {
    if (video.size > 30 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 30 MB.');
    if (await videoDuration(video) > 60.5) throw new Error('O vídeo deve ter no máximo 60 segundos.');
  }
}
async function uploadBusinessFile(businessId, kind, file) {
  if (!file) return null;
  const path = `${businessId}/${kind}-${Date.now()}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
async function uploadEventImage(eventId, file) {
  if (!file) return null;
  if (!file.type.startsWith('image/') || file.size > 6 * 1024 * 1024) throw new Error('A arte deve ser JPG, PNG ou WebP e ter no máximo 6 MB.');
  const path = `${eventId}/speaker-${Date.now()}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from(EVENT_MEDIA_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) throw error;
  return supabase.storage.from(EVENT_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

function addEditorControls() {
  const businessForm = document.querySelector('#business-form');
  const businessHeading = businessForm.closest('.admin-panel').querySelector('h2'); businessHeading.id = 'business-form-title';
  const paidLabel = document.querySelector('#business-paid-until').closest('label');
  const featured = document.createElement('label'); featured.className = 'admin-check'; featured.innerHTML = '<input id="business-featured" type="checkbox" /> Exibir como patrocinador em destaque'; paidLabel.after(featured);
  const businessSubmit = businessForm.querySelector('button[type="submit"],button:not([type])'); businessSubmit.id = 'business-submit';
  const businessCancel = document.createElement('button'); businessCancel.type = 'button'; businessCancel.id = 'business-cancel'; businessCancel.className = 'admin-cancel'; businessCancel.textContent = 'Cancelar edição'; businessCancel.hidden = true; businessSubmit.after(businessCancel);

  const eventForm = document.querySelector('#event-form');
  const eventHeading = eventForm.closest('.admin-panel').querySelector('h2'); eventHeading.id = 'event-form-title';
  const eventSubmit = eventForm.querySelector('button[type="submit"],button:not([type])'); eventSubmit.id = 'event-submit';
  const eventCancel = document.createElement('button'); eventCancel.type = 'button'; eventCancel.id = 'event-cancel'; eventCancel.className = 'admin-cancel'; eventCancel.textContent = 'Cancelar edição'; eventCancel.hidden = true; eventSubmit.after(eventCancel);
}

function resetChapterEditor() {
  editingChapterId = null; document.querySelector('#chapter-form').reset(); setValue('#chapter-state', 'SP');
  document.querySelector('#chapter-form-title').textContent = 'Novo capítulo'; document.querySelector('#chapter-submit').textContent = 'Cadastrar capítulo'; document.querySelector('#chapter-cancel').hidden = true;
}
function editChapter(id) {
  const item = chapters.find((row) => row.id === id); if (!item) return;
  editingChapterId = id; setValue('#chapter-name', item.name); setValue('#chapter-city', item.city); setValue('#chapter-state', item.state); setValue('#chapter-leader', item.leader_name);
  document.querySelector('#chapter-form-title').textContent = 'Editar capítulo'; document.querySelector('#chapter-submit').textContent = 'Salvar alterações'; document.querySelector('#chapter-cancel').hidden = false;
  showAdminView('chapters'); document.querySelector('#chapter-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function resetBusinessEditor() {
  editingBusinessId = null; const form = document.querySelector('#business-form'); form.reset();
  document.querySelector('#business-logo-file').required = true; document.querySelector('#business-form-title').textContent = 'Novo empresário pagante'; document.querySelector('#business-submit').textContent = 'Cadastrar e publicar no marketplace'; document.querySelector('#business-cancel').hidden = true;
}
function editBusiness(id) {
  const item = businesses.find((row) => row.id === id); if (!item) return; editingBusinessId = id;
  const fields = { '#business-chapter': item.chapter_id, '#business-name': item.name, '#business-segment': item.segment, '#business-headline': item.headline, '#business-short': item.short_description, '#business-description': item.description, '#business-offerings': (item.offerings || []).join('\n'), '#business-differentials': (item.differentials || []).join('\n'), '#business-service-area': item.service_area, '#business-whatsapp': item.whatsapp, '#business-contact-email': item.contact_email, '#business-website': item.website_url, '#business-instagram': item.instagram_url, '#business-facebook': item.facebook_url, '#business-linkedin': item.linkedin_url, '#business-paid-until': item.paid_until };
  Object.entries(fields).forEach(([selector, next]) => setValue(selector, next)); document.querySelector('#business-featured').checked = Boolean(item.featured);
  document.querySelector('#business-logo-file').required = false; document.querySelector('#business-form-title').textContent = 'Editar empresário ou patrocinador'; document.querySelector('#business-submit').textContent = 'Salvar alterações'; document.querySelector('#business-cancel').hidden = false;
  showAdminView('businesses'); document.querySelector('#business-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function resetEventEditor() {
  editingEventId = null; const form = document.querySelector('#event-form'); form.reset(); setValue('#event-start-time', '19:00'); setValue('#event-end-time', '21:00');
  document.querySelector('#event-image-file').required = true; document.querySelector('#event-form-title').textContent = 'Novo evento da agenda'; document.querySelector('#event-submit').textContent = 'Publicar na agenda e no site'; document.querySelector('#event-cancel').hidden = true;
}
function editEvent(id) {
  const item = events.find((row) => row.id === id); if (!item) return; editingEventId = id;
  const start = toLocalParts(item.starts_at); const end = toLocalParts(item.ends_at);
  const fields = { '#event-chapter': item.chapter_id, '#event-title': item.title, '#event-description': item.description, '#event-speaker': item.speaker_name, '#event-registration': item.registration_url, '#event-date': start.date, '#event-start-time': start.time, '#event-end-time': end.time, '#event-location': item.location_name, '#event-address': item.address };
  Object.entries(fields).forEach(([selector, next]) => setValue(selector, next)); document.querySelector('#event-image-file').required = false;
  document.querySelector('#event-form-title').textContent = 'Editar evento'; document.querySelector('#event-submit').textContent = 'Salvar alterações'; document.querySelector('#event-cancel').hidden = false;
  showAdminView('events'); document.querySelector('#event-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function removeStoredFolder(bucket, id) {
  const { data, error } = await supabase.storage.from(bucket).list(id, { limit: 100 }); if (error) throw error;
  const paths = (data || []).map((file) => `${id}/${file.name}`); if (paths.length) { const { error: removeError } = await supabase.storage.from(bucket).remove(paths); if (removeError) throw removeError; }
}

function formatMoney(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)); }
function renderFinance() {
  const target = document.querySelector('#admin-finance-list'); if (!target) return; target.replaceChildren();
  const payable = financialReferrals.filter((item) => ['validated', 'payable'].includes(item.financial_status)).reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  const paid = financialReferrals.filter((item) => item.financial_status === 'paid').reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  document.querySelector('#finance-sales').textContent = financialReferrals.filter((item) => item.status === 'converted').length;
  document.querySelector('#finance-payable').textContent = formatMoney(payable); document.querySelector('#finance-paid').textContent = formatMoney(paid);
  if (!financialReferrals.length) { const empty = document.createElement('p'); empty.className = 'empty-admin-list'; empty.textContent = 'Nenhuma indicação financeira registrada.'; target.append(empty); return; }
  financialReferrals.forEach((item) => {
    const row = document.createElement('article'); row.className = 'finance-row'; row.dataset.financeId = item.id;
    const info = document.createElement('div'); info.className = 'finance-info';
    const company = document.createElement('small'); company.textContent = `${item.adh_businesses?.name || 'Empresa'} • ${item.adh_businesses?.adh_chapters?.city || ''}`;
    const title = document.createElement('b'); title.textContent = item.adh_affiliate_offers?.title || 'Oferta';
    const affiliate = document.createElement('p'); affiliate.textContent = `Indicador: ${item.referrer_name || 'Membro'} • Cliente: ${item.visitor_name || 'não informado'} • ${item.visitor_contact || ''}`;
    info.append(company, title, affiliate);
    const controls = document.createElement('div'); controls.className = 'finance-controls';
    const sale = document.createElement('input'); sale.type = 'number'; sale.min = '0'; sale.step = '0.01'; sale.value = item.converted_value || ''; sale.placeholder = 'Valor da venda'; sale.setAttribute('aria-label', 'Valor da venda');
    const status = document.createElement('select'); status.setAttribute('aria-label', 'Situação financeira');
    [['pending','Pendente'],['validated','Validada'],['payable','A pagar'],['paid','Paga'],['cancelled','Cancelada']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = item.financial_status === value; status.append(option); });
    const commission = document.createElement('strong'); commission.textContent = `Comissão: ${formatMoney(item.commission_amount)}`;
    const save = document.createElement('button'); save.type = 'button'; save.className = 'admin-action'; save.textContent = 'Salvar';
    save.addEventListener('click', () => saveFinance(item.id, sale.value, status.value, save));
    controls.append(sale, status, commission, save); row.append(info, controls); target.append(row);
  });
}

async function saveFinance(id, saleValue, financialStatus, button) {
  button.disabled = true;
  try {
    const convertedValue = saleValue === '' ? null : Number(saleValue);
    const payload = { converted_value: convertedValue, financial_status: financialStatus, status: financialStatus === 'cancelled' ? 'cancelled' : (convertedValue !== null ? 'converted' : 'contacted') };
    const { error } = await supabase.from('adh_referrals').update(payload).eq('id', id); if (error) throw error;
    showMessage(statusMessage, financialStatus === 'paid' ? 'Pagamento da comissão registrado.' : 'Movimentação financeira atualizada.', 'success'); await refreshData();
  } catch (error) { showMessage(statusMessage, `Não foi possível atualizar a comissão: ${error.message}`, 'error'); }
  finally { button.disabled = false; }
}

async function loadAdmin(user) {
  const { data, error } = await supabase.from('adh_profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!data || !['super_admin', 'chapter_admin'].includes(data.role)) throw new Error('Seu usuário ainda não possui permissão administrativa na ADHONEP.');
  profile = data;
  const isGeneral = profile.role === 'super_admin';
  if (!isGeneral) {
    const { data: links, error: linkError } = await supabase.from('adh_chapter_admins').select('chapter_id').eq('user_id', user.id);
    if (linkError) throw linkError;
    managedChapterIds = (links || []).map((item) => item.chapter_id);
    if (!managedChapterIds.length) throw new Error('Seu acesso ainda não foi vinculado a um capítulo.');
  }
  document.querySelectorAll('.general-only').forEach((item) => { item.hidden = !isGeneral; });
  document.querySelector('#admin-scope').textContent = isGeneral ? 'ADMINISTRAÇÃO GERAL • TODOS OS CAPÍTULOS' : 'ADMINISTRAÇÃO DO MEU CAPÍTULO';
  document.querySelector('#admin-greeting').textContent = `Olá, ${profile.full_name.split(' ')[0] || 'administrador'}.`;
  document.querySelector('#admin-description').textContent = isGeneral ? 'Você pode administrar toda a rede ADHONEP.' : 'Você administra empresários, agenda e avaliações do seu capítulo.';
  access.hidden = true; shell.hidden = false;
  await refreshData();
  showAdminView('overview');
}

async function refreshData() {
  let chapterQuery = supabase.from('adh_chapters').select('*').order('city');
  let businessQuery = supabase.from('adh_businesses').select('*,adh_chapters(city)').order('created_at', { ascending: false });
  let eventQuery = supabase.from('adh_events').select('*,adh_chapters(city)').order('starts_at', { ascending: true });
  let financeQuery = supabase.from('adh_referrals').select('*,adh_businesses(name,chapter_id,adh_chapters(city)),adh_affiliate_offers(title)').not('offer_id', 'is', null).order('created_at', { ascending: false });
  if (profile.role !== 'super_admin') {
    chapterQuery = chapterQuery.in('id', managedChapterIds);
    businessQuery = businessQuery.in('chapter_id', managedChapterIds);
    eventQuery = eventQuery.in('chapter_id', managedChapterIds);
  }
  let adminQuery = supabase.from('adh_profiles').select('id,full_name,phone,role').in('role', ['super_admin', 'chapter_admin']).order('full_name');
  const [{ data: chapterRows, error: chapterError }, { data: businessRows, error: businessError }, { data: eventRows, error: eventError }, { data: admins, error: adminError }] = await Promise.all([chapterQuery, businessQuery, eventQuery, adminQuery]);
  if (profile.role !== 'super_admin') financeQuery = supabase.from('adh_referrals').select('*,adh_businesses!inner(name,chapter_id,adh_chapters(city)),adh_affiliate_offers(title)').in('adh_businesses.chapter_id', managedChapterIds).not('offer_id', 'is', null).order('created_at', { ascending: false });
  const { data: financeRows, error: financeError } = await financeQuery;
  const error = chapterError || businessError || eventError || adminError || financeError; if (error) throw error;
  chapters = chapterRows || [];
  businesses = businessRows || [];
  events = eventRows || [];
  financialReferrals = financeRows || [];
  document.querySelector('#business-chapter').innerHTML = options(chapters);
  document.querySelector('#event-chapter').innerHTML = options(chapters);
  document.querySelector('#leader-chapter').innerHTML = options(chapters);
  document.querySelector('#admin-chapters-count').textContent = chapters.length;
  document.querySelector('#admin-business-count').textContent = businesses.length;
  document.querySelector('#admin-events-count').textContent = events.length;
  const records = document.querySelector('#admin-records'); records.innerHTML = '';
  [...events.map((x) => ({ title: x.title, detail: `Evento • ${x.adh_chapters?.city || ''}` })), ...businesses.map((x) => ({ title: x.name, detail: `${x.segment} • ${x.adh_chapters?.city || ''} • ${x.status}` }))].slice(0, 12).forEach((x) => {
    const row = document.createElement('div'); row.className = 'admin-list-item'; row.innerHTML = '<b></b><small></small>'; row.querySelector('b').textContent = x.title; row.querySelector('small').textContent = x.detail; records.append(row);
  });
  renderRows(document.querySelector('#admin-chapters-list'), chapters.map((x) => ({ title: x.name, detail: `${x.city}/${x.state} • Líder: ${x.leader_name || 'a definir'}`, status: x.active ? 'Ativo' : 'Inativo', onEdit: profile.role === 'super_admin' ? () => editChapter(x.id) : null, onDelete: profile.role === 'super_admin' ? () => deleteChapter(x.id) : null })), 'Nenhum capítulo cadastrado.');
  renderRows(document.querySelector('#admin-leaders-list'), (admins || []).map((x) => ({ title: x.full_name || 'Administrador', detail: `${x.role === 'super_admin' ? 'Administrador geral' : 'Líder de capítulo'}${x.phone ? ` • ${x.phone}` : ''}`, status: 'Ativo' })), 'Nenhum administrador cadastrado.');
  renderBusinessRows(document.querySelector('[data-admin-view].active')?.dataset.adminView === 'sponsors');
  renderRows(document.querySelector('#admin-events-list'), events.map((x) => ({ title: x.title, detail: `${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(x.starts_at))} • ${x.adh_chapters?.city || ''}`, status: x.published ? 'Publicado' : 'Rascunho', onEdit: () => editEvent(x.id), onDelete: () => deleteEvent(x.id) })), 'Nenhum evento cadastrado. Use “Agenda e eventos” para publicar o próximo.');
  renderFinance();
}

function renderBusinessRows(sponsorView = false) {
  const visibleBusinesses = sponsorView ? businesses.filter((item) => item.featured) : businesses;
  renderRows(document.querySelector('#admin-business-list'), visibleBusinesses.map((item) => ({ title: item.name, detail: `${item.segment} • ${item.adh_chapters?.city || ''}${item.featured ? ' • destaque' : ''}`, status: item.featured ? 'Patrocinador' : (item.status === 'active' ? 'Ativo' : item.status), onEdit: () => editBusiness(item.id), onDelete: () => deleteBusiness(item.id) })), sponsorView ? 'Nenhum patrocinador em destaque.' : 'Nenhum empresário cadastrado.');
}

async function deleteChapter(id) {
  const item = chapters.find((row) => row.id === id); if (!item || !confirm(`Excluir o capítulo “${item.name}”? Esta ação não pode ser desfeita.`)) return;
  try {
    const { error } = await supabase.from('adh_chapters').delete().eq('id', id); if (error) throw error;
    if (editingChapterId === id) resetChapterEditor(); showMessage(statusMessage, 'Capítulo excluído.', 'success'); await refreshData();
  } catch (error) { showMessage(statusMessage, `Não foi possível excluir. Remova primeiro os líderes, empresários e eventos vinculados ao capítulo. Detalhe: ${error.message}`, 'error'); }
}
async function deleteBusiness(id) {
  const item = businesses.find((row) => row.id === id); if (!item || !confirm(`Excluir “${item.name}” e seus arquivos? Esta ação não pode ser desfeita.`)) return;
  try {
    try { await removeStoredFolder(MEDIA_BUCKET, id); } catch (storageError) { console.warn('Não foi possível limpar os arquivos do empresário.', storageError); }
    const { error } = await supabase.from('adh_businesses').delete().eq('id', id); if (error) throw error;
    if (editingBusinessId === id) resetBusinessEditor(); showMessage(statusMessage, 'Empresário excluído.', 'success'); await refreshData();
  } catch (error) { showMessage(statusMessage, `Não foi possível excluir o empresário: ${error.message}`, 'error'); }
}
async function deleteEvent(id) {
  const item = events.find((row) => row.id === id); if (!item || !confirm(`Excluir o evento “${item.title}”? Esta ação não pode ser desfeita.`)) return;
  try {
    try { await removeStoredFolder(EVENT_MEDIA_BUCKET, id); } catch (storageError) { console.warn('Não foi possível limpar a arte do evento.', storageError); }
    const { error } = await supabase.from('adh_events').delete().eq('id', id); if (error) throw error;
    if (editingEventId === id) resetEventEditor(); showMessage(statusMessage, 'Evento excluído.', 'success'); await refreshData();
  } catch (error) { showMessage(statusMessage, `Não foi possível excluir o evento: ${error.message}`, 'error'); }
}

function showAdminView(view) {
  document.querySelectorAll('[data-panel-view]').forEach((panel) => { panel.hidden = !panel.dataset.panelView.split(' ').includes(view); });
  document.querySelectorAll('[data-admin-view]').forEach((button) => button.classList.toggle('active', button.dataset.adminView === view));
  const titles = { overview: 'Visão geral', administrators: 'Administradores', chapters: 'Capítulos', businesses: 'Empresários', sponsors: 'Patrocinadores', financial: 'Financeiro e comissões', events: 'Agenda e eventos', calendar: 'Calendário' };
  document.querySelector('#admin-section-title').textContent = titles[view] || 'Visão geral';
  const listTitle = document.querySelector('#business-list-title'); if (listTitle) listTitle.textContent = view === 'sponsors' ? 'Patrocinadores em destaque' : 'Empresários publicados';
  if (view === 'businesses' || view === 'sponsors') renderBusinessRows(view === 'sponsors');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

addEditorControls();
document.querySelector('#chapter-cancel').addEventListener('click', resetChapterEditor);
document.querySelector('#business-cancel').addEventListener('click', resetBusinessEditor);
document.querySelector('#event-cancel').addEventListener('click', resetEventEditor);

document.querySelector('#admin-login').addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage(loginMessage, 'Validando acesso...');
  const { data, error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#admin-email').value.trim(), password: document.querySelector('#admin-password').value });
  if (error) return showMessage(loginMessage, error.message, 'error');
  try { await loadAdmin(data.user); } catch (loadError) { await supabase.auth.signOut(); showMessage(loginMessage, loadError.message, 'error'); }
});

document.querySelector('#chapter-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true);
  try {
    const payload = { name: value('#chapter-name'), city: value('#chapter-city'), state: value('#chapter-state').toUpperCase(), leader_name: value('#chapter-leader') || null };
    const query = editingChapterId ? supabase.from('adh_chapters').update(payload).eq('id', editingChapterId) : supabase.from('adh_chapters').insert(payload);
    const { error } = await query;
    if (error) throw error;
    showMessage(statusMessage, editingChapterId ? 'Capítulo atualizado.' : 'Capítulo cadastrado.', 'success'); resetChapterEditor(); await refreshData();
  } catch (error) { showMessage(statusMessage, `Não foi possível salvar o capítulo: ${error.message}`, 'error'); }
  finally { setBusy(form, false); }
});

document.querySelector('#leader-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true);
  try {
    const { data, error } = await supabase.functions.invoke('manage-adhonep-user', { body: { role: 'chapter_admin', chapter_id: document.querySelector('#leader-chapter').value, full_name: value('#leader-name'), email: value('#leader-email') } });
    const failure = await functionFailure(error, data);
    if (failure) throw new Error(failure);
    showMessage(statusMessage, data.invited ? 'Líder cadastrado e convite enviado por e-mail.' : 'Líder existente vinculado ao capítulo.', 'success'); form.reset(); await refreshData();
  } catch (error) { showMessage(statusMessage, `Não foi possível convidar o líder: ${error.message}`, 'error'); }
  finally { setBusy(form, false); }
});

document.querySelector('#business-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true); showMessage(statusMessage, 'Validando e enviando os arquivos...');
  const logo = document.querySelector('#business-logo-file').files[0];
  const cover = document.querySelector('#business-cover-file').files[0];
  const video = document.querySelector('#business-video-file').files[0];
  try {
    await validateMedia(logo, cover, video);
    const lines = selector => value(selector).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    const payload = { chapter_id: document.querySelector('#business-chapter').value, name: value('#business-name'), segment: value('#business-segment'), headline: value('#business-headline') || null, short_description: value('#business-short'), description: value('#business-description'), offerings: lines('#business-offerings'), differentials: lines('#business-differentials'), service_area: value('#business-service-area') || null, whatsapp: value('#business-whatsapp') || null, contact_email: value('#business-contact-email') || null, website_url: value('#business-website') || null, instagram_url: value('#business-instagram') || null, facebook_url: value('#business-facebook') || null, linkedin_url: value('#business-linkedin') || null, paid_until: value('#business-paid-until'), featured: document.querySelector('#business-featured').checked, status: 'active' };
    const existing = editingBusinessId ? businesses.find((item) => item.id === editingBusinessId) : null;
    if (!editingBusinessId) payload.created_by = profile.id;
    const mutation = editingBusinessId ? supabase.from('adh_businesses').update(payload).eq('id', editingBusinessId) : supabase.from('adh_businesses').insert(payload);
    const { data: business, error } = await mutation.select().single();
    if (error) throw error;
    const [logoUrl, coverUrl, videoUrl] = await Promise.all([uploadBusinessFile(business.id, 'logo', logo), uploadBusinessFile(business.id, 'cover', cover), uploadBusinessFile(business.id, 'video', video)]);
    const media = { logo_url: logoUrl || existing?.logo_url || business.logo_url, cover_url: coverUrl || existing?.cover_url || business.cover_url, video_url: videoUrl || existing?.video_url || business.video_url };
    const { error: mediaError } = await supabase.from('adh_businesses').update(media).eq('id', business.id);
    if (mediaError) throw mediaError;
    const ownerEmail = value('#business-owner-email');
    if (ownerEmail) {
      const { data: owner, error: ownerError } = await supabase.functions.invoke('manage-adhonep-user', { body: { role: 'business', chapter_id: payload.chapter_id, full_name: value('#business-owner-name') || payload.name, email: ownerEmail } });
      const ownerFailure = await functionFailure(ownerError, owner); if (ownerFailure) throw new Error(ownerFailure);
      const { error: linkError } = await supabase.from('adh_businesses').update({ owner_id: owner.user_id }).eq('id', business.id);
      if (linkError) throw linkError;
    }
    showMessage(statusMessage, editingBusinessId ? 'Empresário atualizado com sucesso.' : 'Empresário publicado no marketplace com sucesso.', 'success'); resetBusinessEditor(); await refreshData();
  } catch (error) { showMessage(statusMessage, error.message, 'error'); }
  finally { setBusy(form, false); }
});

document.querySelector('#event-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true); showMessage(statusMessage, 'Enviando a arte e publicando o evento...');
  try {
    const eventDate = value('#event-date'); const startTime = value('#event-start-time'); const endTime = value('#event-end-time');
    const startsAt = new Date(`${eventDate}T${startTime}:00`); const endsAt = new Date(`${eventDate}T${endTime}:00`);
    const durationMinutes = (endsAt - startsAt) / 60000;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('A hora de término deve ser posterior à hora de início, no mesmo dia.');
    if (durationMinutes > 180) throw new Error('O evento pode ter duração máxima de três horas.');
    const payload = { chapter_id: value('#event-chapter'), title: value('#event-title'), description: value('#event-description'), speaker_name: value('#event-speaker') || null, location_name: value('#event-location'), address: value('#event-address'), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), registration_url: value('#event-registration') || null, published: true };
    const existing = editingEventId ? events.find((item) => item.id === editingEventId) : null;
    if (!editingEventId) payload.created_by = profile.id;
    const mutation = editingEventId ? supabase.from('adh_events').update(payload).eq('id', editingEventId) : supabase.from('adh_events').insert(payload);
    const { data: created, error } = await mutation.select().single();
    if (error) throw error;
    const imageUrl = await uploadEventImage(created.id, document.querySelector('#event-image-file').files[0]);
    const { error: updateError } = await supabase.from('adh_events').update({ image_url: imageUrl || existing?.image_url || created.image_url }).eq('id', created.id);
    if (updateError) throw updateError;
    showMessage(statusMessage, editingEventId ? 'Evento atualizado com sucesso.' : 'Evento publicado. A página pública mostrará este evento na data correta.', 'success'); resetEventEditor(); await refreshData();
  } catch (error) { showMessage(statusMessage, error.message, 'error'); }
  finally { setBusy(form, false); }
});

document.querySelectorAll('[data-admin-view]').forEach((button) => button.addEventListener('click', () => showAdminView(button.dataset.adminView)));
document.querySelectorAll('[data-scroll-to]').forEach((button) => button.addEventListener('click', () => showAdminView('events')));

document.querySelector('#admin-exit').addEventListener('click', async () => { await supabase.auth.signOut(); shell.hidden = true; access.hidden = false; });
const { data: { session } } = await supabase.auth.getSession();
if (session) { try { await loadAdmin(session.user); } catch { await supabase.auth.signOut(); } }
