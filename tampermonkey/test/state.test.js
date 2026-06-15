const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('applyEnabled toggles an id on/off in state', () => {
  let s = L.emptyState();
  s = L.applyEnabled(s, 'nav-popups', true);
  assert.deepStrictEqual(s.enabled, { 'nav-popups': true });
  s = L.applyEnabled(s, 'nav-popups', false);
  assert.deepStrictEqual(s.enabled, { 'nav-popups': false });
});

test('isEnabled: explicit state overrides default-by-match', () => {
  const s = L.applyEnabled(L.emptyState(), 'a', false);
  assert.strictEqual(L.isEnabled(s, { id: 'a' }, true), false);  // user turned off
  assert.strictEqual(L.isEnabled(s, { id: 'b' }, true), true);   // default
  assert.strictEqual(L.isEnabled(s, { id: 'b' }, false), false); // default
});

test('pushRecent caps and dedupes', () => {
  let s = L.emptyState();
  for (let i = 0; i < 30; i++) { s = L.pushRecent(s, 'item' + i, 20); }
  s = L.pushRecent(s, 'item29', 20); // dedupe to front
  assert.strictEqual(s.recents.length, 20);
  assert.strictEqual(s.recents[0], 'item29');
});
