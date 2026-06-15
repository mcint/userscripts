const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('parseRegistry parses an array of entries', () => {
  const entries = L.parseRegistry('[{"id":"a","name":"A","repo":"x/y","path":"a.js"}]');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].id, 'a');
});

test('parseRegistry throws on non-array', () => {
  assert.throws(() => L.parseRegistry('{"id":"a"}'), /array/);
});

test('validateEntry ok on minimal valid entry', () => {
  assert.deepStrictEqual(
    L.validateEntry({ id: 'a', name: 'A', repo: 'x/y', path: 'a.js' }),
    { ok: true, errors: [] }
  );
});

test('validateEntry reports missing required fields and bad repo', () => {
  const r = L.validateEntry({ id: '', repo: 'noslash', path: 'a.js' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /id/.test(e)));
  assert.ok(r.errors.some((e) => /name/.test(e)));
  assert.ok(r.errors.some((e) => /repo/.test(e)));
});
