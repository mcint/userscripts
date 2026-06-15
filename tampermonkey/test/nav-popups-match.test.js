const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../loader.user.js');

function navPopups() {
  const text = fs.readFileSync(path.join(__dirname, '..', 'registry.json'), 'utf8');
  return L.parseRegistry(text).find((e) => e.id === 'nav-popups');
}

test('nav-popups matches Wikimedia by domain — incl. non-/wiki/ paths', () => {
  const m = navPopups().match;
  assert.ok(L.matchUrl(m, 'https://en.wikipedia.org/wiki/Cat'));
  assert.ok(L.matchUrl(m, 'https://en.wikipedia.org/w/index.php?title=Cat&action=history'));
  assert.ok(L.matchUrl(m, 'https://en.wiktionary.org/wiki/cat'));
  assert.ok(L.matchUrl(m, 'https://www.mediawiki.org/wiki/Manual:Contents'));
});

test('nav-popups matches self-hosted MediaWiki by /wiki/ path catch-all', () => {
  const m = navPopups().match;
  assert.ok(L.matchUrl(m, 'https://some-wiki.example.org/wiki/Page'));
});

test('nav-popups does not match non-wiki pages', () => {
  const m = navPopups().match;
  assert.strictEqual(L.matchUrl(m, 'https://example.com/'), false);
  assert.strictEqual(L.matchUrl(m, 'https://github.com/mcint/userscripts'), false);
});
