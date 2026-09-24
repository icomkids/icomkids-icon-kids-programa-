import { supabase } from './supabase-client.js';

const polarSponsor = {
  id: 'polar-ar-condicionado', slug: 'polar-ar-condicionado', name: 'Polar Ar Condicionado', segment: 'Climatização e ar-condicionado',
  headline: 'Conforto e qualidade de vida em qualquer estação.',
  short_description: 'Há mais de 30 anos oferecendo venda, instalação, manutenção e higienização de ar-condicionado em Taubaté e região.',
  description: 'A Polar Ar Condicionado é especialista em climatização e atua há mais de 30 anos atendendo residências, comércios e empresas de Taubaté e região. A empresa oferece soluções completas para criar ambientes mais frescos, agradáveis e eficientes, desde a escolha do equipamento até a instalação profissional, a manutenção preventiva e corretiva e a higienização. Com técnicos especializados, atendimento rápido e personalizado, trabalha com equipamentos de todas as marcas e prioriza segurança, qualidade e o melhor custo-benefício para cada cliente.',
  logo_url: 'assets/empresarios/polar-ar-condicionado/logo-polar-ar-condicionado.png', cover_url: 'assets/empresarios/polar-ar-condicionado/capa-servicos-polar.png',
  instagram_url: 'https://www.instagram.com/polar_arcondicionado2021/', whatsapp: '5512981935517', featured: true, status: 'active',
  offerings: ['Venda de equipamentos de ar-condicionado', 'Instalação profissional e segura', 'Manutenção preventiva e corretiva', 'Higienização e limpeza completa', 'Atendimento residencial, comercial e industrial'],
  differentials: ['Mais de 30 anos de experiência', 'Técnicos especializados', 'Atendimento de todas as marcas', 'Serviço rápido, confiável e personalizado', 'Produtos de qualidade e garantia'],
  service_area: 'Taubaté e região', adh_chapters: { name: 'Capítulo ADHONEP Taubaté', city: 'Taubaté', state: 'SP' }
};
function withSponsorFallback(rows = [], chapterRows = []) {
  if (rows.some((item) => item.slug === polarSponsor.slug)) return rows;
  const taubate = chapterRows.find((item) => String(item.city || '').toLocaleLowerCase('pt-BR') === 'taubaté');
  return [{ ...polarSponsor, chapter_id: taubate?.id || '' }, ...rows];
}

const grid = document.querySelector('#market-grid');
const status = document.querySelector('#market-status');
const search = document.querySelector('#market-search');
const chapter = document.querySelector('#market-chapter');
const segments = document.querySelector('#market-segments');
const segmentMobile = document.querySelector('#market-segment-mobile');
const dialog = document.querySelector('#business-dialog');
let businesses = withSponsorFallback();
let selectedSegment = '';
let affiliateTrackingCode = '';

const safe = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const action = (label, url) => { const href = safeUrl(url); return href ? `<a href="${safe(href)}" target="_blank" rel="noreferrer">${safe(label)} ↗</a>` : ''; };
const list = (title, items) => items?.length ? `<section class="profile-section"><span class="eyebrow">${safe(title)}</span><ul>${items.map(item => `<li>${safe(item)}</li>`).join('')}</ul></section>` : '';

function render() {
  const term = search.value.trim().toLocaleLowerCase('pt-BR');
  const chosen = chapter.value;
  const rows = businesses.filter(x => (!chosen || x.chapter_id === chosen) && (!selectedSegment || x.segment === selectedSegment) && (!term || `${x.name} ${x.segment} ${x.short_description} ${x.description} ${(x.offerings || []).join(' ')} ${x.adh_chapters?.city}`.toLocaleLowerCase('pt-BR').includes(term)));
  grid.innerHTML = '';
  status.textContent = rows.length ? `${rows.length} empresa${rows.length === 1 ? '' : 's'} encontrada${rows.length === 1 ? '' : 's'}.` : 'Nenhuma empresa encontrada.';
  rows.forEach(item => {
    const card = document.createElement('article');
    card.className = 'market-card';
    card.innerHTML = '<div class="cover-wrap"><img class="market-cover"/><span class="verified">EMPRESA DA COMUNIDADE</span></div><div class="market-card-body"><img class="market-logo"/><small></small><h2></h2><h3></h3><p></p><div class="card-tags"></div><button>Ver perfil completo →</button></div>';
    const cardCover = card.querySelector('.market-cover');
    cardCover.src = item.cover_url || item.logo_url || 'assets/capitulo-taubate-oficial.png';
    cardCover.classList.toggle('logo-as-cover', !item.cover_url && Boolean(item.logo_url));
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

function renderSegmentFilters() {
  const labels = [...new Set(businesses.map(item => item.segment?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  segments.replaceChildren();
  segmentMobile.innerHTML = '<option value="">Todos os segmentos</option>' + labels.map(label => `<option value="${safe(label)}">${safe(label)}</option>`).join('');
  [['', 'Todos'], ...labels.map(label => [label, label])].forEach(([segment, label]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.segment = segment; button.textContent = label;
    button.classList.toggle('active', segment === selectedSegment);
    button.addEventListener('click', () => {
      selectedSegment = segment;
      segments.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      render();
    });
    segments.append(button);
  });
  segmentMobile.value = selectedSegment;
}

function openDetail(x) {
  const detail = document.querySelector('#business-detail');
  const params = new URLSearchParams(location.search); const referralCode = params.get('ref'); const offerId = params.get('offer');
  const referralNote = referralCode ? ` Vim por uma indicação ADHONEP${affiliateTrackingCode ? ` (código ${affiliateTrackingCode})` : ''}.` : '';
  const whatsapp = x.whatsapp ? `https://wa.me/${x.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Conheci a ${x.name} pelo portal ADHONEP e gostaria de mais informações.${referralNote}`)}` : '';
  const cover = safeUrl(x.cover_url || x.logo_url) || safe(x.cover_url || x.logo_url);
  const logo = safeUrl(x.logo_url) || safe(x.logo_url);
  const video = safeUrl(x.video_url);
  const paragraphs = String(x.description || x.short_description || '').split(/\n+/).filter(Boolean).map(p => `<p>${safe(p)}</p>`).join('');
  detail.innerHTML = `<article class="business-full"><div class="profile-visual"><img class="detail-cover" src="${safe(cover)}" alt="Imagem de apresentação da ${safe(x.name)}"><img class="detail-logo" src="${safe(logo)}" alt="Logo da ${safe(x.name)}"></div><div class="profile-intro"><span class="chapter">${safe(x.segment)} • CAPÍTULO ${safe(x.adh_chapters?.city).toUpperCase()}</span><h2>${safe(x.name)}</h2><h3>${safe(x.headline || x.short_description || `Soluções em ${x.segment}`)}</h3><p class="lead">${safe(x.short_description || 'Conheça esta empresa da comunidade ADHONEP.')}</p></div><div class="profile-content"><section class="profile-section about"><span class="eyebrow">SOBRE A EMPRESA</span>${paragraphs}</section>${list('PRODUTOS E SERVIÇOS', x.offerings)}${list('POR QUE ESCOLHER', x.differentials)}${x.service_area ? `<section class="profile-section service-area"><span class="eyebrow">ONDE ATENDE</span><p>${safe(x.service_area)}</p></section>` : ''}</div>${video ? `<section class="profile-video"><span class="eyebrow">CONHEÇA MAIS</span><video controls preload="metadata" playsinline src="${safe(video)}"></video></section>` : ''}<section class="contact-panel"><div><span class="eyebrow">FALE COM A EMPRESA</span><h3>Gostou? Inicie uma conversa.</h3><p>Diga que encontrou a empresa pelo portal ADHONEP.</p></div><div class="detail-actions">${action('Conversar no WhatsApp', whatsapp)}${action('Visitar site', x.website_url)}${action('Instagram', x.instagram_url)}${action('Facebook', x.facebook_url)}${action('LinkedIn', x.linkedin_url)}${action('Enviar e-mail', x.contact_email ? `mailto:${x.contact_email}` : '')}</div></section></article>`;
  if (!x.cover_url && x.logo_url) {
    detail.querySelector('.profile-visual')?.classList.add('logo-hero');
    detail.querySelector('.detail-cover')?.classList.add('logo-as-cover');
  }
  dialog.showModal();
}

async function trackAffiliateVisit(referralCode, offerId) {
  if (!referralCode || !offerId) return '';
  const storageKey = `adhonep-affiliate:${referralCode}:${offerId}`;
  const saved = sessionStorage.getItem(storageKey);
  if (saved) return saved;
  const { data, error } = await supabase.rpc('adh_track_affiliate_visit', { p_referral_code: referralCode, p_offer_id: offerId });
  if (error || !data) return '';
  sessionStorage.setItem(storageKey, data);
  return data;
}

dialog.querySelector('.dialog-close').onclick = () => dialog.close();
dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
search.oninput = render;
chapter.onchange = render;
segmentMobile.onchange = () => {
  selectedSegment = segmentMobile.value;
  segments.querySelectorAll('button').forEach(item => item.classList.toggle('active', item.dataset.segment === selectedSegment));
  render();
};

renderSegmentFilters();
render();

const [{ data: chapterRows }, { data: businessRows, error }] = await Promise.all([
  supabase.from('adh_chapters').select('id,name,city').eq('active', true).order('city'),
  supabase.from('adh_businesses').select('*,adh_chapters(name,city,state)').eq('status', 'active').order('featured', { ascending: false }).order('name')
]);
if (error) status.textContent = 'Não foi possível carregar as empresas agora.';
else {
  businesses = withSponsorFallback(businessRows || [], chapterRows || []);
  renderSegmentFilters();
  chapter.innerHTML += [...(chapterRows || [])].map(x => `<option value="${x.id}">${x.name}</option>`).join('');
  render();
  const params = new URLSearchParams(location.search);
  affiliateTrackingCode = await trackAffiliateVisit(params.get('ref'), params.get('offer'));
  const requested = params.get('empresa');
  const selected = businesses.find(item => item.slug === requested || item.id === requested);
  if (selected) openDetail(selected);
}
