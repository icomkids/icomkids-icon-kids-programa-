import { supabase } from './supabase-client.js';

const grid = document.querySelector('#market-grid');
const status = document.querySelector('#market-status');
const search = document.querySelector('#market-search');
const chapter = document.querySelector('#market-chapter');
const dialog = document.querySelector('#business-dialog');
let businesses = [];

const safe = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const action = (label, url) => { const href = safeUrl(url); return href ? `<a href="${safe(href)}" target="_blank" rel="noreferrer">${safe(label)} ↗</a>` : ''; };
const list = (title, items) => items?.length ? `<section class="profile-section"><span class="eyebrow">${safe(title)}</span><ul>${items.map(item => `<li>${safe(item)}</li>`).join('')}</ul></section>` : '';

function render() {
  const term = search.value.trim().toLocaleLowerCase('pt-BR');
  const chosen = chapter.value;
  const rows = businesses.filter(x => (!chosen || x.chapter_id === chosen) && (!term || `${x.name} ${x.segment} ${x.short_description} ${x.description} ${(x.offerings || []).join(' ')} ${x.adh_chapters?.city}`.toLocaleLowerCase('pt-BR').includes(term)));
  grid.innerHTML = '';
  status.textContent = rows.length ? `${rows.length} empresa${rows.length === 1 ? '' : 's'} encontrada${rows.length === 1 ? '' : 's'}.` : 'Nenhuma empresa encontrada.';
  rows.forEach(item => {
    const card = document.createElement('article');
    card.className = 'market-card';
    card.innerHTML = '<div class="cover-wrap"><img class="market-cover"/><span class="verified">EMPRESA DA COMUNIDADE</span></div><div class="market-card-body"><img class="market-logo"/><small></small><h2></h2><h3></h3><p></p><div class="card-tags"></div><button>Ver perfil completo →</button></div>';
    card.querySelector('.market-cover').src = item.cover_url || item.logo_url || 'assets/capitulo-taubate-oficial.png';
    card.querySelector('.market-logo').src = item.logo_url || 'assets/logo-adhonep-expansao.png';
    card.querySelector('small').textContent = `${item.segment} • ${item.adh_chapters?.city || ''}`;
    card.querySelector('h2').textContent = item.name;
    card.querySelector('h3').textContent = item.headline || `Soluções em ${item.segment}`;
    card.querySelector('p').textContent = item.short_description || item.description;
    card.querySelector('.card-tags').innerHTML = (item.offerings || []).slice(0, 3).map(tag => `<span>${safe(tag)}</span>`).join('');
    card.querySelector('button').onclick = () => openDetail(item);
    grid.append(card);
  });
}

function openDetail(x) {
  const detail = document.querySelector('#business-detail');
  const params = new URLSearchParams(location.search); const referralCode = params.get('ref'); const offerId = params.get('offer');
  const referralNote = referralCode ? ` Meu código de indicação é ${referralCode}${offerId ? `, referente à oferta ${offerId}` : ''}.` : '';
  const whatsapp = x.whatsapp ? `https://wa.me/${x.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Conheci a ${x.name} pelo portal ADHONEP e gostaria de mais informações.${referralNote}`)}` : '';
  const cover = safeUrl(x.cover_url || x.logo_url) || safe(x.cover_url || x.logo_url);
  const logo = safeUrl(x.logo_url) || safe(x.logo_url);
  const video = safeUrl(x.video_url);
  const paragraphs = String(x.description || x.short_description || '').split(/\n+/).filter(Boolean).map(p => `<p>${safe(p)}</p>`).join('');
  detail.innerHTML = `<article class="business-full"><div class="profile-visual"><img class="detail-cover" src="${safe(cover)}" alt="Imagem de apresentação da ${safe(x.name)}"><img class="detail-logo" src="${safe(logo)}" alt="Logo da ${safe(x.name)}"></div><div class="profile-intro"><span class="chapter">${safe(x.segment)} • CAPÍTULO ${safe(x.adh_chapters?.city).toUpperCase()}</span><h2>${safe(x.name)}</h2><h3>${safe(x.headline || x.short_description || `Soluções em ${x.segment}`)}</h3><p class="lead">${safe(x.short_description || 'Conheça esta empresa da comunidade ADHONEP.')}</p></div><div class="profile-content"><section class="profile-section about"><span class="eyebrow">SOBRE A EMPRESA</span>${paragraphs}</section>${list('PRODUTOS E SERVIÇOS', x.offerings)}${list('POR QUE ESCOLHER', x.differentials)}${x.service_area ? `<section class="profile-section service-area"><span class="eyebrow">ONDE ATENDE</span><p>${safe(x.service_area)}</p></section>` : ''}</div>${video ? `<section class="profile-video"><span class="eyebrow">CONHEÇA MAIS</span><video controls preload="metadata" playsinline src="${safe(video)}"></video></section>` : ''}<section class="contact-panel"><div><span class="eyebrow">FALE COM A EMPRESA</span><h3>Gostou? Inicie uma conversa.</h3><p>Diga que encontrou a empresa pelo portal ADHONEP.</p></div><div class="detail-actions">${action('Conversar no WhatsApp', whatsapp)}${action('Visitar site', x.website_url)}${action('Instagram', x.instagram_url)}${action('Facebook', x.facebook_url)}${action('LinkedIn', x.linkedin_url)}${action('Enviar e-mail', x.contact_email ? `mailto:${x.contact_email}` : '')}</div></section></article>`;
  dialog.showModal();
}

dialog.querySelector('.dialog-close').onclick = () => dialog.close();
dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
search.oninput = render;
chapter.onchange = render;

const [{ data: chapterRows }, { data: businessRows, error }] = await Promise.all([
  supabase.from('adh_chapters').select('id,name,city').eq('active', true).order('city'),
  supabase.from('adh_businesses').select('*,adh_chapters(name,city,state)').eq('status', 'active').order('featured', { ascending: false }).order('name')
]);
if (error) status.textContent = 'Não foi possível carregar as empresas agora.';
else {
  businesses = businessRows || [];
  chapter.innerHTML += [...(chapterRows || [])].map(x => `<option value="${x.id}">${x.name}</option>`).join('');
  render();
  const requested = new URLSearchParams(location.search).get('empresa');
  const selected = businesses.find(item => item.slug === requested || item.id === requested);
  if (selected) openDetail(selected);
}
