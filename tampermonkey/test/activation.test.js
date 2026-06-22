const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

function fakeStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('effectiveActive is true if any lever is on', () => {
  assert.strictEqual(L.effectiveActive({ tab: false, session: false, site: false }), false);
  assert.strictEqual(L.effectiveActive({ tab: true, session: false, site: false }), true);
  assert.strictEqual(L.effectiveActive({ tab: false, session: false, site: true }), true);
});

test('activationKey is stable and namespaced', () => {
  assert.strictEqual(L.activationKey('nav-popups'), 'us-loader:act:nav-popups');
});

test('writeScope(tab/site) writes to the matching store; readScopes reads back', () => {
  const tab = fakeStore(), site = fakeStore();
  L.writeScope('nav-popups', 'site', true, { tab, site });
  L.writeScope('nav-popups', 'tab', true, { tab, site });
  assert.deepStrictEqual(L.readScopes('nav-popups', { tab, site }), { tab: true, session: false, site: true });
  L.writeScope('nav-popups', 'tab', false, { tab, site });
  assert.deepStrictEqual(L.readScopes('nav-popups', { tab, site }), { tab: false, session: false, site: true });
});

test('writeScope(session) is a no-op in v0 (lever stubbed)', () => {
  const tab = fakeStore(), site = fakeStore();
  L.writeScope('x', 'session', true, { tab, site });
  assert.deepStrictEqual(L.readScopes('x', { tab, site }), { tab: false, session: false, site: false });
});
