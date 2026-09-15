import { supabase } from './supabase-client.js';

const filter = document.querySelector('#public-chapter-filter');
const monthNames = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const formatTime = (date) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(date);
const escapeHtml = (text = '') => String(text).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

async function loadChapters() {
  const { data } = await supabase.from('adh_chapters').select('id,name,city,state').eq('active', true).order('city');
  (data || []).forEach((chapter) => { const option = document.createElement('option'); option.value = chapter.id; option.textContent = `${chapter.city} — ${chapter.name}`; filter?.append(option); });
}

async function loadNextEvent(chapterId = '') {
  const now = new Date().toISOString();
  let query = supabase.from('adh_events').select('*,adh_chapters(name,city,state)').eq('published', true).or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})`).order('starts_at').limit(1);
  if (chapterId) query = query.eq('chapter_id', chapterId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    document.querySelector('#next-event-title').textContent = 'Nova agenda em preparação';
    document.querySelector('#next-event-description').textContent = 'O capítulo publicará aqui seu próximo encontro assim que a programação for confirmada.';
    document.querySelector('#next-event-speaker-card').hidden = true;
    return;
  }
  const start = new Date(data.starts_at); const end = data.ends_at ? new Date(data.ends_at) : null;
  document.querySelector('#next-event-chapter').textContent = `AGENDA OFICIAL • ${data.adh_chapters?.name || 'ADHONEP'}`;
  document.querySelector('#next-event-day').textContent = String(start.getDate()).padStart(2, '0');
  document.querySelector('#next-event-month').innerHTML = `${monthNames[start.getMonth()]}<br><b>${start.getFullYear()}</b>`;
  document.querySelector('#next-event-title').textContent = data.title;
  document.querySelector('#next-event-description').textContent = data.description;
  document.querySelector('#next-event-time').textContent = end ? `${formatTime(start)} às ${formatTime(end)}` : formatTime(start);
  document.querySelector('#next-event-location').textContent = data.location_name || 'A confirmar';
  const address = document.querySelector('#next-event-address'); address.replaceChildren();
  if (data.address) { const place = document.createElement('b'); place.textContent = data.location_name || ''; address.append(place, document.createElement('br'), document.createTextNode(data.address)); }
  const image = document.querySelector('#next-event-image'); image.src = data.image_url || 'assets/evento-encontro.png'; image.alt = `Arte de ${data.title}`;
  document.querySelector('#next-event-speaker').textContent = data.speaker_name || 'Convidado a confirmar';
  document.querySelector('#next-event-speaker-title').textContent = data.title;
  document.querySelector('#next-event-speaker-card').hidden = false;
}

async function loadCalendar(chapterId = '') {
  const now = new Date().toISOString();
  let query = supabase.from('adh_events').select('*,adh_chapters(name,city)').eq('published', true).gte('ends_at', now).order('starts_at').limit(12);
  if (chapterId) query = query.eq('chapter_id', chapterId);
  const { data } = await query;
  const summary = document.querySelector('#calendar-summary'); if (summary) summary.textContent = `${(data || []).length} ${(data || []).length === 1 ? 'próxima atividade publicada' : 'próximas atividades publicadas'}`;
  const calendar = document.querySelector('.activity-calendar'); if (!calendar) return;
  calendar.innerHTML = (data || []).map((item) => { const start = new Date(item.starts_at); const end = item.ends_at ? new Date(item.ends_at) : null; return `<article><time datetime="${escapeHtml(item.starts_at)}"><b>${String(start.getDate()).padStart(2, '0')}</b><span>${monthNames[start.getMonth()]}<br>${start.getFullYear()}</span></time><div class="activity-info"><small>PRÓXIMO ENCONTRO • ${escapeHtml(item.adh_chapters?.city || '')}</small><h3>${escapeHtml(item.title)}</h3>${item.speaker_name ? `<p><b>Palestrante:</b> ${escapeHtml(item.speaker_name)}</p>` : ''}<p><b>Horário:</b> ${formatTime(start)}${end ? ` às ${formatTime(end)}` : ''} <i></i> <b>Local:</b> ${escapeHtml(item.location_name || 'A confirmar')}</p><p><b>Endereço:</b> ${escapeHtml(item.address || 'A confirmar')}</p></div><div class="activity-status"><span class="status-review">PUBLICADO</span><button data-live-event>Ver atividade →</button></div></article>`; }).join('') || '<p class="empty-agenda">A próxima programação será publicada em breve.</p>';
  calendar.querySelectorAll('[data-live-event]').forEach((button) => button.addEventListener('click', () => { document.querySelector('#dialog-title').textContent = 'Quero participar do próximo encontro'; document.querySelector('#form-dialog')?.showModal(); }));
}

filter?.addEventListener('change', () => { loadNextEvent(filter.value); loadCalendar(filter.value); });
await loadChapters(); await Promise.all([loadNextEvent(), loadCalendar()]);
