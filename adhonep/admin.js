import { supabase, showMessage } from './supabase-client.js';

const access = document.querySelector('#admin-access');
const shell = document.querySelector('#admin-shell');
const loginMessage = document.querySelector('#admin-message');
const statusMessage = document.querySelector('#admin-status');
let profile;
let chapters = [];
let managedChapterIds = [];
const MEDIA_BUCKET = 'adhonep-business-media';
const EVENT_MEDIA_BUCKET = 'adhonep-event-media';

function options(items) { return items.map((x) => `<option value="${x.id}">${x.name} — ${x.city}</option>`).join(''); }
function renderRows(target, rows, empty = 'Nenhum registro cadastrado.') {
  target.replaceChildren();
  if (!rows.length) { const item = document.createElement('p'); item.className = 'empty-admin-list'; item.textContent = empty; target.append(item); return; }
  rows.forEach(({ title, detail, status }) => { const row = document.createElement('div'); row.className = 'admin-list-item'; const content = document.createElement('div'); const name = document.createElement('b'); const description = document.createElement('small'); name.textContent = title; description.textContent = detail; content.append(name, description); row.append(content); if (status) { const badge = document.createElement('span'); badge.className = `admin-badge ${status === 'Ativo' || status === 'Publicado' ? 'is-active' : ''}`; badge.textContent = status; row.append(badge); } target.append(row); });
}
function setBusy(form, busy) { form.querySelector('button[type="submit"],button:not([type])').disabled = busy; }
function value(id) { return document.querySelector(id).value.trim(); }
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
  let businessQuery = supabase.from('adh_businesses').select('id,chapter_id,name,segment,status,adh_chapters(city)').order('created_at', { ascending: false });
  let eventQuery = supabase.from('adh_events').select('id,chapter_id,title,starts_at,published,adh_chapters(city)').order('starts_at', { ascending: true });
  if (profile.role !== 'super_admin') {
    chapterQuery = chapterQuery.in('id', managedChapterIds);
    businessQuery = businessQuery.in('chapter_id', managedChapterIds);
    eventQuery = eventQuery.in('chapter_id', managedChapterIds);
  }
  let adminQuery = supabase.from('adh_profiles').select('id,full_name,phone,role').in('role', ['super_admin', 'chapter_admin']).order('full_name');
  const [{ data: chapterRows, error: chapterError }, { data: businesses, error: businessError }, { data: events, error: eventError }, { data: admins, error: adminError }] = await Promise.all([chapterQuery, businessQuery, eventQuery, adminQuery]);
  const error = chapterError || businessError || eventError || adminError; if (error) throw error;
  chapters = chapterRows || [];
  document.querySelector('#business-chapter').innerHTML = options(chapters);
  document.querySelector('#event-chapter').innerHTML = options(chapters);
  document.querySelector('#leader-chapter').innerHTML = options(chapters);
  document.querySelector('#admin-chapters-count').textContent = chapters.length;
  document.querySelector('#admin-business-count').textContent = (businesses || []).length;
  document.querySelector('#admin-events-count').textContent = (events || []).length;
  const records = document.querySelector('#admin-records'); records.innerHTML = '';
  [...(events || []).map((x) => ({ title: x.title, detail: `Evento • ${x.adh_chapters?.city || ''}` })), ...(businesses || []).map((x) => ({ title: x.name, detail: `${x.segment} • ${x.adh_chapters?.city || ''} • ${x.status}` }))].slice(0, 12).forEach((x) => {
    const row = document.createElement('div'); row.className = 'admin-list-item'; row.innerHTML = '<b></b><small></small>'; row.querySelector('b').textContent = x.title; row.querySelector('small').textContent = x.detail; records.append(row);
  });
  renderRows(document.querySelector('#admin-chapters-list'), chapters.map((x) => ({ title: x.name, detail: `${x.city}/${x.state} • Líder: ${x.leader_name || 'a definir'}`, status: x.active ? 'Ativo' : 'Inativo' })), 'Nenhum capítulo cadastrado.');
  renderRows(document.querySelector('#admin-leaders-list'), (admins || []).map((x) => ({ title: x.full_name || 'Administrador', detail: `${x.role === 'super_admin' ? 'Administrador geral' : 'Líder de capítulo'}${x.phone ? ` • ${x.phone}` : ''}`, status: 'Ativo' })), 'Nenhum administrador cadastrado.');
  renderRows(document.querySelector('#admin-business-list'), (businesses || []).map((x) => ({ title: x.name, detail: `${x.segment} • ${x.adh_chapters?.city || ''}`, status: x.status === 'active' ? 'Ativo' : x.status })), 'Nenhum empresário cadastrado.');
  renderRows(document.querySelector('#admin-events-list'), (events || []).map((x) => ({ title: x.title, detail: `${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(x.starts_at))} • ${x.adh_chapters?.city || ''}`, status: x.published ? 'Publicado' : 'Rascunho' })), 'Nenhum evento cadastrado. Use “Agenda e eventos” para publicar o próximo.');
}

function showAdminView(view) {
  document.querySelectorAll('[data-panel-view]').forEach((panel) => { panel.hidden = !panel.dataset.panelView.split(' ').includes(view); });
  document.querySelectorAll('[data-admin-view]').forEach((button) => button.classList.toggle('active', button.dataset.adminView === view));
  const titles = { overview: 'Visão geral', administrators: 'Administradores', chapters: 'Capítulos', businesses: 'Empresários', sponsors: 'Patrocinadores', events: 'Agenda e eventos', calendar: 'Calendário' };
  document.querySelector('#admin-section-title').textContent = titles[view] || 'Visão geral';
  const listTitle = document.querySelector('#business-list-title'); if (listTitle) listTitle.textContent = view === 'sponsors' ? 'Patrocinadores em destaque' : 'Empresários publicados';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelector('#admin-login').addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage(loginMessage, 'Validando acesso...');
  const { data, error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#admin-email').value.trim(), password: document.querySelector('#admin-password').value });
  if (error) return showMessage(loginMessage, error.message, 'error');
  try { await loadAdmin(data.user); } catch (loadError) { await supabase.auth.signOut(); showMessage(loginMessage, loadError.message, 'error'); }
});

document.querySelector('#chapter-form').addEventListener('submit', async (event) => {
  event.preventDefault(); setBusy(event.currentTarget, true);
  const { error } = await supabase.from('adh_chapters').insert({ name: document.querySelector('#chapter-name').value.trim(), city: document.querySelector('#chapter-city').value.trim(), state: document.querySelector('#chapter-state').value.trim().toUpperCase(), leader_name: document.querySelector('#chapter-leader').value.trim() || null });
  setBusy(event.currentTarget, false); showMessage(statusMessage, error ? error.message : 'Capítulo cadastrado.', error ? 'error' : 'success'); if (!error) { event.currentTarget.reset(); await refreshData(); }
});

document.querySelector('#leader-form').addEventListener('submit', async (event) => {
  event.preventDefault(); setBusy(event.currentTarget, true);
  const { data, error } = await supabase.functions.invoke('manage-adhonep-user', { body: { role: 'chapter_admin', chapter_id: document.querySelector('#leader-chapter').value, full_name: value('#leader-name'), email: value('#leader-email') } });
  setBusy(event.currentTarget, false);
  const failure = error?.message || data?.error;
  showMessage(statusMessage, failure || (data.invited ? 'Líder cadastrado e convite enviado por e-mail.' : 'Líder existente vinculado ao capítulo.'), failure ? 'error' : 'success');
  if (!failure) event.currentTarget.reset();
});

document.querySelector('#business-form').addEventListener('submit', async (event) => {
  event.preventDefault(); setBusy(event.currentTarget, true); showMessage(statusMessage, 'Validando e enviando os arquivos...');
  const logo = document.querySelector('#business-logo-file').files[0];
  const cover = document.querySelector('#business-cover-file').files[0];
  const video = document.querySelector('#business-video-file').files[0];
  try {
    await validateMedia(logo, cover, video);
    const lines = selector => value(selector).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    const payload = { chapter_id: document.querySelector('#business-chapter').value, name: value('#business-name'), segment: value('#business-segment'), headline: value('#business-headline') || null, short_description: value('#business-short'), description: value('#business-description'), offerings: lines('#business-offerings'), differentials: lines('#business-differentials'), service_area: value('#business-service-area') || null, whatsapp: value('#business-whatsapp') || null, contact_email: value('#business-contact-email') || null, website_url: value('#business-website') || null, instagram_url: value('#business-instagram') || null, facebook_url: value('#business-facebook') || null, linkedin_url: value('#business-linkedin') || null, paid_until: value('#business-paid-until'), status: 'active', created_by: profile.id };
    const { data: business, error } = await supabase.from('adh_businesses').insert(payload).select().single();
    if (error) throw error;
    const [logoUrl, coverUrl, videoUrl] = await Promise.all([uploadBusinessFile(business.id, 'logo', logo), uploadBusinessFile(business.id, 'cover', cover), uploadBusinessFile(business.id, 'video', video)]);
    const { error: mediaError } = await supabase.from('adh_businesses').update({ logo_url: logoUrl, cover_url: coverUrl, video_url: videoUrl }).eq('id', business.id);
    if (mediaError) throw mediaError;
    const ownerEmail = value('#business-owner-email');
    if (ownerEmail) {
      const { data: owner, error: ownerError } = await supabase.functions.invoke('manage-adhonep-user', { body: { role: 'business', chapter_id: payload.chapter_id, full_name: value('#business-owner-name') || payload.name, email: ownerEmail } });
      if (ownerError || owner?.error) throw new Error(owner?.error || ownerError.message);
      const { error: linkError } = await supabase.from('adh_businesses').update({ owner_id: owner.user_id }).eq('id', business.id);
      if (linkError) throw linkError;
    }
    showMessage(statusMessage, 'Empresário publicado no marketplace com sucesso.', 'success'); event.currentTarget.reset(); await refreshData();
  } catch (error) { showMessage(statusMessage, error.message, 'error'); }
  finally { setBusy(event.currentTarget, false); }
});

document.querySelector('#event-form').addEventListener('submit', async (event) => {
  event.preventDefault(); setBusy(event.currentTarget, true); showMessage(statusMessage, 'Enviando a arte e publicando o evento...');
  try {
    const eventDate = value('#event-date'); const startTime = value('#event-start-time'); const endTime = value('#event-end-time');
    const startsAt = new Date(`${eventDate}T${startTime}:00`); const endsAt = new Date(`${eventDate}T${endTime}:00`);
    const durationMinutes = (endsAt - startsAt) / 60000;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('A hora de término deve ser posterior à hora de início, no mesmo dia.');
    if (durationMinutes > 180) throw new Error('O evento pode ter duração máxima de três horas.');
    const payload = { chapter_id: value('#event-chapter'), title: value('#event-title'), description: value('#event-description'), speaker_name: value('#event-speaker') || null, location_name: value('#event-location'), address: value('#event-address'), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), registration_url: value('#event-registration') || null, published: true, created_by: profile.id };
    const { data: created, error } = await supabase.from('adh_events').insert(payload).select().single();
    if (error) throw error;
    const imageUrl = await uploadEventImage(created.id, document.querySelector('#event-image-file').files[0]);
    const { error: updateError } = await supabase.from('adh_events').update({ image_url: imageUrl }).eq('id', created.id);
    if (updateError) throw updateError;
    showMessage(statusMessage, 'Evento publicado. A página pública mostrará este evento na data correta.', 'success'); event.currentTarget.reset(); await refreshData();
  } catch (error) { showMessage(statusMessage, error.message, 'error'); }
  finally { setBusy(event.currentTarget, false); }
});

document.querySelectorAll('[data-admin-view]').forEach((button) => button.addEventListener('click', () => showAdminView(button.dataset.adminView)));
document.querySelectorAll('[data-scroll-to]').forEach((button) => button.addEventListener('click', () => showAdminView('events')));

document.querySelector('#admin-exit').addEventListener('click', async () => { await supabase.auth.signOut(); shell.hidden = true; access.hidden = false; });
const { data: { session } } = await supabase.auth.getSession();
if (session) { try { await loadAdmin(session.user); } catch { await supabase.auth.signOut(); } }
