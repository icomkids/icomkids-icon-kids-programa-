import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../adhonep/public-data.js', import.meta.url), 'utf8').replaceAll('export ', '');
const eight = Array.from({ length: 8 }, (_, id) => ({ id, name: `Empresa ${id}` }));
function fixture({ rows = eight, failed = false, saved, blockedStorage = false, total = null } = {}) {
  let calls = 0;
  const cache = new Map(saved ? [['adhonep-public-v1:businesses', JSON.stringify(saved)]] : []);
  const context = vm.createContext({ Date, Set, Map, Promise, JSON, Number, Error, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: key => { if (blockedStorage) throw Error(); return cache.get(key) || null; }, setItem: (key, value) => { if (blockedStorage) throw Error(); cache.set(key, value); } },
    fetch: async (_url, options) => { calls++; assert.equal(options.credentials, 'omit'); if (failed) throw Error('503'); return { ok: true, json: async () => rows, headers: new Headers(total ? { 'content-range': `0-${rows.length - 1}/${total}` } : {}) }; }
  });
  vm.runInContext(source + '\nglobalThis.api={loadPublicData,cachedPublicData,upcomingEvents};', context);
  return { ...context.api, get calls() { return calls; } };
}
test('simultaneous public reads share one request and preserve all eight businesses', async () => {
  const f = fixture(); const results = await Promise.all([f.loadPublicData('businesses'), f.loadPublicData('businesses')]);
  assert.equal(f.calls, 1); assert.equal(results[0].data.length, 8);
  await f.loadPublicData('businesses'); assert.equal(f.calls, 1);
});
test('a server failure retains the last complete list and explicitly marks it stale', async () => {
  const f = fixture({ failed: true, saved: { data: eight, updatedAt: Date.now() - 120_000 } });
  const result = await f.loadPublicData('businesses'); assert.equal(result.data.length, 8); assert.equal(result.stale, true);
});
test('authoritative empty result removes outdated businesses instead of injecting a hardcoded sponsor', async () => {
  const f = fixture({ rows: [], saved: { data: eight, updatedAt: Date.now() - 120_000 } });
  assert.equal((await f.loadPublicData('businesses')).data.length, 0); assert.equal(f.cachedPublicData('businesses').data.length, 0);
});
test('a partial API result never replaces the complete catalog', async () => {
  const f = fixture({ rows: eight.slice(0, 3), total: 8, saved: { data: eight, updatedAt: Date.now() - 120_000 } });
  const result = await f.loadPublicData('businesses'); assert.equal(result.data.length, 8); assert.equal(result.stale, true);
});
test('without a valid cache errors are not misrepresented as an empty directory', async () => {
  const f = fixture({ failed: true, saved: { data: eight, updatedAt: Date.now() - 25 * 3600_000 } });
  await assert.rejects(f.loadPublicData('businesses'));
});
test('storage blocked by the browser does not prevent public reads', async () => {
  assert.equal((await fixture({ blockedStorage: true }).loadPublicData('businesses')).data.length, 8);
});
test('unlisted resources cannot use the public cache', async () => {
  const f = fixture(); await assert.rejects(f.loadPublicData('profiles')); assert.equal(f.calls, 0);
});
test('next event and calendar filter the same data, exclude past events and retain null-end future events', () => {
  const f = fixture(); const rows = [
    { id: 1, chapter_id: 'a', starts_at: '2026-09-24T19:00:00Z', ends_at: '2026-09-24T21:00:00Z' },
    { id: 2, chapter_id: 'a', starts_at: '2026-09-26T19:00:00Z', ends_at: null },
    { id: 3, chapter_id: 'b', starts_at: '2026-09-27T19:00:00Z', ends_at: '2026-09-27T21:00:00Z' }
  ];
  assert.deepEqual(Array.from(f.upcomingEvents(rows, 'a', Date.parse('2026-09-25')), x => x.id), [2]);
});
test('public routes are anonymous, read-only, whitelist fields and share server cache', () => {
  const conf = readFileSync(new URL('../adhonep/nginx.conf', import.meta.url), 'utf8');
  assert.match(conf, /limit_except GET \{ deny all; \}/); assert.match(conf, /proxy_pass_request_headers off/);
  assert.match(conf, /proxy_cache_lock on/); assert.match(conf, /proxy_cache_key \$uri/);
  assert.match(conf, /status=eq.active/); assert.match(conf, /published=eq.true/);
  assert.doesNotMatch(conf, /service_role|sb_secret_|select=\*/);
  const home = readFileSync(new URL('../adhonep/public-live.js', import.meta.url), 'utf8');
  const market = readFileSync(new URL('../adhonep/marketplace.js', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /supabase-client|withSponsorFallback|polarSponsor/);
  assert.doesNotMatch(market, /withSponsorFallback|polarSponsor/);
  assert.match(home, /Promise.allSettled/);
});
