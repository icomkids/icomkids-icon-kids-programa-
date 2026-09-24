import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessFlow, friendlyAuthError, withTimeout } from '../adhonep/portal-auth.js';
import { boundedFetch } from '../adhonep/request-timeout.js';
import { isRecoverySession } from '../adhonep/auth-link.js';

function setup(overrides = {}) {
  const states = []; const opened = [];
  const auth = {
    signInWithPassword: async () => ({ data: { user: { id: 'test-user' } } }),
    getSession: async () => ({ data: { session: null } }),
    signOut: () => { throw new Error('Authentication failures must not sign out other sessions'); },
    ...overrides,
  };
  return { states, opened, flow: createAccessFlow({ auth, open: async (user) => opened.push(user.id), onState: (state) => states.push(state), timeout: 30 }) };
}

test('valid login opens the authorized profile and releases submit', async () => {
  const { flow, states, opened } = setup();
  assert.equal(await flow.signIn(' user@example.test ', 'test-only'), true);
  assert.deepEqual(opened, ['test-user']);
  assert.deepEqual(states.at(-1), { busy: false });
});
test('wrong password is visible and never opens the dashboard', async () => {
  const { flow, states, opened } = setup({ signInWithPassword: async () => ({ error: { message: 'Invalid login credentials' } }) });
  assert.equal(await flow.signIn('user@example.test', 'test-only'), false);
  assert.equal(opened.length, 0);
  assert.match(states.find((state) => state.kind === 'error').message, /senha incorretos/);
  assert.equal(states.at(-1).busy, false);
});
test('session restore without a user enables login', async () => {
  const { flow, states, opened } = setup();
  await flow.restore(); assert.equal(opened.length, 0); assert.equal(states.at(-1).busy, false);
});
test('restore and manual submit cannot run at the same time', async () => {
  let release; let calls = 0;
  const { flow } = setup({ getSession: () => new Promise((resolve) => { release = resolve; }), signInWithPassword: async () => { calls++; return { data: { user: { id: 'test' } } }; } });
  const restore = flow.restore();
  assert.equal(await flow.signIn('user@example.test', 'test-only'), false);
  release({ data: { session: null } }); await restore; assert.equal(calls, 0);
});
test('a late login response after timeout cannot open the panel', async () => {
  let release;
  const { flow, states, opened } = setup({ signInWithPassword: () => new Promise((resolve) => { release = resolve; }) });
  assert.equal(await flow.signIn('user@example.test', 'test-only'), false);
  release({ data: { user: { id: 'late-user' } } }); await Promise.resolve();
  assert.equal(opened.length, 0); assert.equal(states.at(-1).busy, false);
});
test('profile permission failure is not reported as a wrong password', async () => {
  const states = [];
  const flow = createAccessFlow({ auth: { signInWithPassword: async () => ({ data: { user: { id: 'test' } } }) }, open: async () => { throw new Error('permission denied for schema adh_private'); }, onState: (state) => states.push(state) });
  assert.equal(await flow.signIn('user@example.test', 'test-only'), false);
  assert.match(states.find((state) => state.kind === 'error').message, /não é erro de senha/);
  assert.equal(states.at(-1).busy, false);
});
test('network failures show a useful error', () => {
  assert.match(friendlyAuthError(new TypeError('Failed to fetch')), /conexão/);
});
test('an expired invitation cannot change the password of a previously signed-in account', () => {
  assert.equal(isRecoverySession({ access_token: 'previous-account' }, { type: 'invite', token: 'invited-account' }), false);
  assert.equal(isRecoverySession({ access_token: 'invited-account' }, { type: 'invite', token: 'invited-account' }), true);
  assert.equal(isRecoverySession(null, { type: 'recovery', token: null }), false);
});
test('withTimeout does not swallow an API error', async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error('test failure')), 10), /test failure/);
});
test('boundedFetch propagates cancellation without discarding caller headers', async () => {
  const original = globalThis.fetch; const abort = new AbortController(); abort.abort();
  globalThis.fetch = async (_, init) => { assert.equal(init.headers.apikey, 'test-only'); assert.equal(init.signal.aborted, true); throw new DOMException('Aborted', 'AbortError'); };
  try { await assert.rejects(boundedFetch('https://example.test/auth/v1/settings', { signal: abort.signal, headers: { apikey: 'test-only' } }), { name: 'AbortError' }); }
  finally { globalThis.fetch = original; }
});
