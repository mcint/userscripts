const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

const reg = [
  { id: 'wp', name: 'WP', repo: 'a/b', path: 'p.js', match: ['*://*.wikipedia.org/*'] },
  { id: 'none', name: 'None', repo: 'a/b', path: 'q.js', match: [] },
];

test('entriesToAutoLoad returns match+enabled entries for a URL', () => {
  const state = L.emptyState();
  const out = L.entriesToAutoLoad(reg, state, 'https://en.wikipedia.org/wiki/X');
  assert.deepStrictEqual(out.map((e) => e.id), ['wp']);
});

test('entriesToAutoLoad respects user disable', () => {
  const state = L.applyEnabled(L.emptyState(), 'wp', false);
  const out = L.entriesToAutoLoad(reg, state, 'https://en.wikipedia.org/wiki/X');
  assert.deepStrictEqual(out.map((e) => e.id), []);
});
