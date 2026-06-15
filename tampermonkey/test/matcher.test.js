const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('host wildcard matches subdomain', () => {
  assert.strictEqual(L.matchUrl(['*://*.wikipedia.org/*'], 'https://en.wikipedia.org/wiki/Foo'), true);
});

test('scheme + path wildcard', () => {
  assert.strictEqual(L.matchUrl(['https://example.com/*'], 'https://example.com/a/b'), true);
  assert.strictEqual(L.matchUrl(['https://example.com/*'], 'http://example.com/a'), false);
});

test('no match when host differs', () => {
  assert.strictEqual(L.matchUrl(['*://*.wikipedia.org/*'], 'https://example.com/'), false);
});

test('empty pattern list never matches', () => {
  assert.strictEqual(L.matchUrl([], 'https://example.com/'), false);
});

test('* scheme matches http and https only', () => {
  assert.strictEqual(L.matchUrl(['*://example.com/*'], 'https://example.com/'), true);
  assert.strictEqual(L.matchUrl(['*://example.com/*'], 'ftp://example.com/'), false);
});
