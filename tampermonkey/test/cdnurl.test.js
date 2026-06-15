const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('buildCdnUrl composes a jsDelivr gh URL', () => {
  assert.strictEqual(
    L.buildCdnUrl({ repo: 'mcint/userscripts', ref: 'main', path: 'mw/nav-popups/popups.js' }),
    'https://cdn.jsdelivr.net/gh/mcint/userscripts@main/mw/nav-popups/popups.js'
  );
});

test('buildCdnUrl strips a leading slash from path', () => {
  assert.strictEqual(
    L.buildCdnUrl({ repo: 'a/b', ref: 'v1', path: '/x.js' }),
    'https://cdn.jsdelivr.net/gh/a/b@v1/x.js'
  );
});

test('entryCdnUrl uses entry fields with ref default main', () => {
  assert.strictEqual(
    L.entryCdnUrl({ repo: 'a/b', path: 'x.js' }),
    'https://cdn.jsdelivr.net/gh/a/b@main/x.js'
  );
});
