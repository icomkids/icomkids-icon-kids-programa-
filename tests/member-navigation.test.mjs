import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../adhonep/member-navigation.js', import.meta.url), 'utf8').replaceAll('export function', 'function');
const html = readFileSync(new URL('../adhonep/membros.html', import.meta.url), 'utf8');
const views = ['overview', 'businesses', 'affiliates', 'referrals', 'company', 'contacts', 'reviews'];

function setup({ business = false, reducedMotion = false } = {}) {
  const node = (dataset = {}) => ({ dataset, hidden: false, attrs: {}, classes: new Set(),
    classList: { toggle(name, enabled) { if (enabled) this.owner.classes.add(name); else this.owner.classes.delete(name); } },
    setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
  });
  const buttons = views.map((view) => {
    const button = node({ memberView: view });
    button.hidden = ['company', 'contacts'].includes(view) && !business;
    return button;
  });
  const panels = views.map((view) => { const panel = node({ memberPanel: view }); panel.hidden = view !== 'overview'; return panel; });
  const dashboard = node({ navigationReady: 'true', view: 'overview' });
  const more = node(); const label = { textContent: '' }; const heading = node();
  const dialog = { open: false, close() { this.open = false; } };
  const scrolls = []; let focused = false;
  heading.focus = () => { focused = true; };
  [...buttons, ...panels, dashboard, more, heading].forEach((item) => { item.classList.owner = item; });
  const context = {
    document: {
      querySelector(selector) {
        if (selector === '#member-dashboard') return dashboard;
        if (selector === '#member-context') return label;
        if (selector === '[data-member-more]') return more;
        if (selector === '#member-more-dialog') return dialog;
        if (selector === '#member-title' || selector.endsWith(' h2')) return heading;
        throw new Error(`Unexpected selector: ${selector}`);
      },
      querySelectorAll(selector) { return selector === '[data-member-view]' ? buttons : panels; },
    },
    window: { matchMedia: () => ({ matches: reducedMotion }), scrollTo: (options) => scrolls.push(options) },
  };
  runInNewContext(source, context);
  return { ...context, panels, buttons, more, label, dialog, dashboard, scrolls, isFocused: () => focused };
}

test('primary navigation selects only one panel and announces the active page', () => {
  const state = setup();
  assert.equal(state.showMemberView('businesses', { focus: true }), true);
  assert.deepEqual(state.panels.filter((item) => !item.hidden).map((item) => item.dataset.memberPanel), ['businesses']);
  assert.equal(state.buttons[1].attrs['aria-current'], 'page');
  assert.equal(state.label.textContent, 'Empresas');
  assert.equal(state.dashboard.dataset.view, 'businesses');
  assert.equal(state.isFocused(), true);
});

test('ordinary members cannot reveal role-hidden company or contacts views', () => {
  const state = setup();
  for (const view of ['company', 'contacts', 'unknown']) assert.equal(state.showMemberView(view), false);
  assert.equal(state.dashboard.dataset.view, 'overview');
  assert.deepEqual(state.panels.filter((item) => !item.hidden).map((item) => item.dataset.memberPanel), ['overview']);
});

test('business members can open their company and the More menu closes', () => {
  const state = setup({ business: true }); state.dialog.open = true;
  assert.equal(state.showMemberView('company'), true);
  assert.equal(state.dialog.open, false);
  assert.equal(state.more.classes.has('active'), true);
  assert.equal(state.label.textContent, 'Minha empresa');
});

test('returning to overview clears the More selection and respects reduced motion', () => {
  const state = setup({ reducedMotion: true });
  state.showMemberView('reviews'); state.showMemberView('overview');
  assert.equal(state.more.classes.has('active'), false);
  assert.equal(state.buttons.filter((item) => item.attrs['aria-current']).length, 1);
  assert.equal(state.scrolls.at(-1).behavior, 'auto');
});

test('the HTML preserves every data panel and has unique IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const view of views) {
    assert.ok(html.includes(`data-member-panel="${view}"`));
    assert.ok(html.includes(`data-member-view="${view}"`));
  }
  for (const id of ['member-access', 'member-exit', 'member-refresh', 'offer-form', 'feedback-form', 'member-referral-link']) assert.ok(ids.includes(id));
  assert.match(html, /id="member-dashboard"[^>]*hidden/);
  assert.doesNotMatch(html, /member-preview|example\.test|sem dados reais/);
});
