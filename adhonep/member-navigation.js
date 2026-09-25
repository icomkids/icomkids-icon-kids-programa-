// Presentation only. Authentication and data permissions remain in the existing portal.
const viewNames = { overview: 'Visão geral', businesses: 'Empresas', affiliates: 'Afiliados e comissões', referrals: 'Minhas indicações', company: 'Minha empresa', contacts: 'Contatos recebidos', reviews: 'Avaliações' };
const primaryViews = ['overview', 'businesses', 'affiliates', 'referrals'];

export function showMemberView(view, { focus = false } = {}) {
  if (!Object.hasOwn(viewNames, view)) return false;
  const dashboard = document.querySelector('#member-dashboard');
  const buttons = [...document.querySelectorAll('[data-member-view]')];
  // Respect the role-specific visibility already set by members.js.
  if (!buttons.some((button) => button.dataset.memberView === view && !button.hidden)) return false;
  document.querySelectorAll('[data-member-panel]').forEach((panel) => {
    const active = panel.dataset.memberPanel === view;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
  buttons.forEach((button) => {
    const active = button.dataset.memberView === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  dashboard.dataset.view = view;
  document.querySelector('#member-context').textContent = viewNames[view];
  document.querySelector('[data-member-more]').classList.toggle('active', !primaryViews.includes(view));
  const dialog = document.querySelector('#member-more-dialog');
  if (dialog.open) dialog.close();
  if (focus) {
    const heading = view === 'overview' ? document.querySelector('#member-title') : document.querySelector(`[data-member-panel="${view}"] h2`);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return true;
}

export function initMemberNavigation() {
  const dashboard = document.querySelector('#member-dashboard');
  if (!dashboard || dashboard.dataset.navigationReady) return;
  dashboard.dataset.navigationReady = 'true';
  document.querySelectorAll('[data-member-panel]').forEach((panel) => { panel.id = `member-panel-${panel.dataset.memberPanel}`; });
  document.querySelectorAll('[data-member-view], [data-go-member-view]').forEach((button) => {
    const view = button.dataset.memberView || button.dataset.goMemberView;
    button.setAttribute('aria-controls', `member-panel-${view}`);
    button.addEventListener('click', () => showMemberView(view, { focus: true }));
  });
  const dialog = document.querySelector('#member-more-dialog');
  const more = document.querySelector('[data-member-more]');
  more.addEventListener('click', () => {
    if (dashboard.hidden || dialog.open) return;
    dialog.showModal();
    more.setAttribute('aria-expanded', 'true');
    document.body.classList.add('member-menu-open');
  });
  const close = () => dialog.close();
  document.querySelector('[data-close-member-more]').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    more.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('member-menu-open');
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  document.querySelector('[data-member-exit]').addEventListener('click', () => {
    close();
    document.querySelector('#member-exit').click();
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (event) => { if (event.matches && dialog.open) close(); });
  document.querySelector('[data-copy]').addEventListener('click', async () => {
    const link = document.querySelector('#member-referral-link');
    const status = document.querySelector('[data-copy-status]');
    const text = link.textContent.trim();
    status.hidden = false;
    if (!/^https?:\/\//.test(text)) { status.textContent = 'Seu link ainda está carregando. Aguarde e tente novamente.'; return; }
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Link copiado! Agora é só compartilhar.';
    } catch {
      link.closest('details').open = true;
      status.textContent = 'Não foi possível copiar automaticamente. Selecione o endereço acima e copie.';
    }
  });
}

if (typeof document !== 'undefined') initMemberNavigation();
