// Compact, accessible agenda. Event data continues to use the shared public cache.
const portraits = {
  'fb1ed88c-3e8e-491f-9f25-538a36a70194': {
    title: 'Jantar ADHONEP', chapter: 'Capítulo 085 · Taubaté',
    portrait: 'https://swsfwthjxtqtkloexyjs.supabase.co/storage/v1/object/public/adhonep-event-media/aldrin-retrato-v1.png',
    contact: 'https://wa.me/5512991092187',
    schedule: '19h · Recepção e networking / 19h30 · Jantar', price: 'R$ 150 por pessoa'
  }
};
const clean = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = (value = '') => /^https?:\/\//i.test(value) ? value : '';
const style = `
.home-page .compact-event{display:block!important;grid-column:1/-1;width:min(100%,920px)!important;min-width:0;margin:24px auto!important;padding:0!important;color:#112c3e;background:transparent!important;scroll-margin-top:24px}
.compact-event *{box-sizing:border-box;min-width:0}
.compact-event .event-notice{display:block;padding:24px;border:1px solid #ddd4c3;border-radius:16px;background:#fffdf9;box-shadow:0 8px 28px #061e2e0a;overflow:hidden}
.compact-event .notice-top{display:grid;grid-template-columns:minmax(0,1fr) 150px;align-items:center;gap:24px}
.compact-event .notice-date{margin:0 0 10px;color:#825914;font:700 14px/1.4 var(--sans);letter-spacing:.03em}
.compact-event .notice-title{margin:0!important;color:#092638;font:400 34px/1.12 var(--serif)!important;letter-spacing:-.02em;overflow-wrap:anywhere}
.compact-event .notice-chapter{margin:8px 0 14px!important;color:#4c5c68;font:500 15px/1.4 var(--sans)}
.compact-event .notice-speaker{margin:0!important;color:#213c4e;font:600 14px/1.4 var(--sans);overflow-wrap:anywhere}
.compact-event .notice-speaker small{display:block;margin-bottom:3px;font-size:10px;letter-spacing:.1em;color:#7a643b}
.compact-event .notice-photo{display:block!important;width:150px!important;height:172px!important;object-fit:cover!important;object-position:center 25%!important;border-radius:12px;border:1px solid #ede4d4;background:#f6edda}
.compact-event .notice-photo.poster{object-fit:contain!important}
.compact-event .notice-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin:18px 0 0;padding-top:16px;border-top:1px solid #e9e1d6;font:500 13px/1.5 var(--sans);color:#475967}
.compact-event .notice-meta span{overflow-wrap:anywhere}
.compact-event .notice-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:16px}
.compact-event .notice-reserve{display:inline-flex;justify-content:center;align-items:center;min-height:44px;padding:11px 20px;border-radius:8px;background:#092638;color:white!important;text-decoration:none;font:600 14px/1.4 var(--sans)}
.compact-event .notice-details{margin-top:12px;border-top:1px solid #e9e1d6;padding-top:4px}
.compact-event .notice-details summary{display:list-item;cursor:pointer;min-height:44px;padding:12px 0;color:#805619;font:600 14px/1.4 var(--sans)}
.compact-event .notice-description{margin:8px 0 16px!important;white-space:pre-line;overflow-wrap:anywhere;color:#435563;font:400 15px/1.65 var(--sans)}
.compact-event .notice-art-link{display:inline-flex;align-items:center;min-height:44px;color:#805619;font:600 14px/1.4 var(--sans)}
.compact-event :is(a,summary):focus-visible{outline:3px solid #bd8c3c;outline-offset:4px}
.compact-event .notice-empty{margin:0;color:#435563;font:400 15px/1.6 var(--sans)}
@media(max-width:600px){
 .home-page .compact-event{margin:16px auto!important;scroll-margin-top:16px}
 .compact-event .event-notice{padding:16px;border-radius:12px}
 .compact-event .notice-top{grid-template-columns:minmax(0,1fr) 104px;gap:14px;align-items:start}
 .compact-event .notice-date{font-size:13px;margin-bottom:8px}
 .compact-event .notice-title{font-size:25px!important;line-height:1.12!important}
 .compact-event .notice-chapter{font-size:12px;margin:6px 0 10px!important}
 .compact-event .notice-speaker{font-size:12px}
 .compact-event .notice-speaker small{font-size:9px}
 .compact-event .notice-photo{width:104px!important;height:138px!important;border-radius:9px}
 .compact-event .notice-meta{display:grid;gap:5px;margin-top:14px;padding-top:12px;font-size:12px}
 .compact-event .notice-actions{margin-top:12px}
 .compact-event .notice-reserve{width:100%;font-size:13px}
 .compact-event .notice-details{margin-top:8px}
}
@media(max-width:360px){.compact-event .notice-top{grid-template-columns:minmax(0,1fr) 88px;gap:10px}.compact-event .notice-photo{width:88px!important;height:124px!important}.compact-event .notice-title{font-size:23px!important}}
`;
export function renderEventNotice(data, error = false) {
  const host = document.querySelector('[data-dynamic-event] .event-copy, [data-dynamic-event] .compact-event');
  if (!host) return;
  if (!document.querySelector('#compact-event-style')) {
    const css = document.createElement('style'); css.id = 'compact-event-style'; css.textContent = style; document.head.append(css);
  }
  host.className = 'compact-event';
  if (!data) {
    host.innerHTML = `<article class="event-notice"><h2 class="notice-title">${error ? 'Agenda temporariamente indisponível' : 'Nova agenda em preparação'}</h2><p class="notice-empty">${error ? 'Não foi possível atualizar a programação. Tente novamente em instantes.' : 'O capítulo publicará aqui seu próximo encontro.'}</p></article>`;
    return;
  }
  const custom = portraits[data.id] || {};
  const start = new Date(data.starts_at);
  const date = new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'long',timeZone:'America/Sao_Paulo'}).format(start);
  const time = new Intl.DateTimeFormat('pt-BR', {hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(start);
  const portrait = safeUrl(custom.portrait || data.image_url);
  const art = safeUrl(data.image_url);
  const contact = safeUrl(data.registration_url || custom.contact);
  host.innerHTML = `<article class="event-notice" aria-labelledby="next-event-title">
    <div class="notice-top"><div>
      <p class="notice-date"><time datetime="${clean(data.starts_at)}">${clean(date)}</time></p>
      <h2 class="notice-title" id="next-event-title">${clean(custom.title || data.title)}</h2>
      <p class="notice-chapter">${clean(custom.chapter || data.adh_chapters?.name || 'ADHONEP')}</p>
      ${data.speaker_name ? `<p class="notice-speaker"><small>PALESTRANTE</small>${clean(data.speaker_name)}</p>` : ''}
    </div>${portrait ? `<img class="notice-photo${custom.portrait ? '' : ' poster'}" src="${clean(portrait)}" alt="${clean(custom.portrait ? data.speaker_name : 'Arte de ' + data.title)}" width="150" height="172" loading="lazy" decoding="async" />` : ''}</div>
    <div class="notice-meta"><span>${clean(custom.schedule || time)}</span><span>${clean(data.location_name || 'Local a confirmar')}</span>${custom.price ? `<span>${clean(custom.price)}</span>` : ''}</div>
    ${contact ? `<div class="notice-actions"><a class="notice-reserve" href="${clean(contact)}" target="_blank" rel="noopener noreferrer">Reservar meu lugar ↗</a></div>` : ''}
    <details class="notice-details"><summary>Ver detalhes do jantar</summary><p class="notice-description">${clean(data.description || '')}</p>${data.address ? `<p class="notice-description">${clean(data.address)}</p>` : ''}${art ? `<a class="notice-art-link" href="${clean(art)}" target="_blank" rel="noopener noreferrer">Abrir convite completo ↗</a>` : ''}</details>
  </article>`;
}