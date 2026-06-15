const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');
const defaults = { owner: 'mcint', ref: 'main' };

test('owner/repo/path@ref shorthand', () => {
  assert.deepStrictEqual(
    L.parseFreeform('mcint/userscripts/scripts/foo.user.js@abc123', defaults),
    { kind: 'ref', repo: 'mcint/userscripts', path: 'scripts/foo.user.js', ref: 'abc123', integrity: null }
  );
});

test('repo/path with default owner and ref', () => {
  assert.deepStrictEqual(
    L.parseFreeform('userscripts/scripts/foo.user.js', defaults),
    { kind: 'ref', repo: 'mcint/userscripts', path: 'scripts/foo.user.js', ref: 'main', integrity: null }
  );
});

test('full URL with integrity fragment', () => {
  const r = L.parseFreeform('https://cdn.jsdelivr.net/gh/a/b@v1/x.js#sha384-AbC', defaults);
  assert.strictEqual(r.kind, 'url');
  assert.strictEqual(r.url, 'https://cdn.jsdelivr.net/gh/a/b@v1/x.js');
  assert.strictEqual(r.integrity, 'sha384-AbC');
});

test('pasted snippet (contains newline or no slash) is a snippet', () => {
  const r = L.parseFreeform('(function(){ alert(1); })();', defaults);
  assert.strictEqual(r.kind, 'snippet');
  assert.strictEqual(r.snippet, '(function(){ alert(1); })();');
});
