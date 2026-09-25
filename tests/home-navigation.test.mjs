import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../adhonep/home-navigation.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../adhonep/index.html', import.meta.url), 'utf8');

function setup() {
  const positions = { inicio: 0, eventos: 2000, empresarios: 3000, 'o-que-e-adhonep': 1000 };
  const listeners = {};
  const frames = [];
  const link = (id) => ({
    hash: `#${id}`, attrs: {}, active: false,
    classList: { toggle(_, active) { this.owner.active = active; } },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
  });
  const desktop = ['inicio', 'eventos', 'empresarios', 'o-que-e-adhonep'].map(link);
  const mobile = ['inicio', 'eventos', 'empresarios'].map(link);
  [...desktop, ...mobile].forEach((item) => { item.classList.owner = item; });
  runInNewContext(source, {
    document: {
      querySelectorAll: () => [desktop, mobile].map((items) => ({ querySelectorAll: () => items })),
      getElementById: (id) => ({ getBoundingClientRect: () => ({ top: positions[id] }) }),
    },
    window: { innerHeight: 800, addEventListener: (name, callback) => { listeners[name] = callback; } },
    requestAnimationFrame: (callback) => frames.push(callback),
  });
  const flush = () => { while (frames.length) frames.shift()(); };
  return { positions, desktop, mobile, listeners, frames, flush };
}

test('home is active in both navigation menus on initial load', () => {
  const state = setup();
  for (const items of [state.desktop, state.mobile]) {
    assert.equal(items.filter((item) => item.active).length, 1);
    assert.equal(items[0].attrs['aria-current'], 'location');
  }
});

test('scroll uses visual section positions, including reordered mobile content', () => {
  const state = setup();
  Object.assign(state.positions, { inicio: -1000, eventos: -200, empresarios: 80, 'o-que-e-adhonep': 1500 });
  state.listeners.scroll(); state.flush();
  for (const items of [state.desktop, state.mobile]) {
    assert.deepEqual(items.filter((item) => item.active).map((item) => item.hash), ['#empresarios']);
    assert.equal(items[0].attrs['aria-current'], undefined);
  }
});

test('resize and hash changes refresh the active section without duplicate animation frames', () => {
  const state = setup();
  Object.assign(state.positions, { inicio: -2200, eventos: -1000, empresarios: -500, 'o-que-e-adhonep': 80 });
  state.listeners.resize(); state.listeners.hashchange(); state.listeners.scroll();
  assert.equal(state.frames.length, 1);
  state.flush();
  assert.equal(state.desktop.find((item) => item.active).hash, '#o-que-e-adhonep');
  state.positions.inicio = 0;
  Object.assign(state.positions, { eventos: 1000, empresarios: 2000, 'o-que-e-adhonep': 3000 });
  state.listeners.scroll(); state.flush();
  assert.equal(state.mobile.find((item) => item.active).hash, '#inicio');
});

test('all homepage local anchor destinations exist and IDs are unique', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(anchor), anchor);
});

test('the approved hero preserves the real photograph and native links', () => {
  assert.match(html, /class="executive-portrait"[\s\S]*?src="assets\/administradores-capitulo.webp"/);
  assert.match(html, /class="executive-cta" href="#eventos"/);
  assert.match(html, /class="executive-secondary" href="#empresarios"/);
  assert.match(html, /class="home-dock"[\s\S]*?href="membros.html"/);
  assert.doesNotMatch(html, /class="mobile-journey"/);
});
