const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('passes through a valid SRI token', () => {
  assert.strictEqual(L.normalizeIntegrity('sha384-AbC123+/='), 'sha384-AbC123+/=');
});

test('accepts sha256 and sha512 tokens', () => {
  assert.strictEqual(L.normalizeIntegrity('sha256-x'), 'sha256-x');
  assert.strictEqual(L.normalizeIntegrity('sha512-y'), 'sha512-y');
});

test('normalizes pip-style hex fragment to a token', () => {
  assert.strictEqual(L.normalizeIntegrity('sha256=deadbeef'), 'sha256-deadbeef-hex');
});

test('returns null for empty/garbage', () => {
  assert.strictEqual(L.normalizeIntegrity(''), null);
  assert.strictEqual(L.normalizeIntegrity('md5-nope'), null);
});
