# Tampermonkey Script Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An install-once Tampermonkey loader userscript that loads other userscripts from GitHub — a curated registry plus freeform URL/snippet — with per-domain auto-load, SRI-token integrity, and self-hosting update headers.

**Architecture:** A single `tampermonkey/loader.user.js`. Pure helpers (URL building, freeform/integrity parsing, registry validation, `@match` globbing) are plain functions with a guarded CommonJS export tail, unit-tested with `node --test` (zero deps). Impure work (GM fetch/execute, persistence, UI, auto-load) lives in `main()`, invoked only in-browser. v0.9 adds `build.sh` for the embedded registry + static index.

**Tech Stack:** Vanilla ES2020 JS; Tampermonkey GM_* APIs; WebCrypto (`crypto.subtle`, available in browsers and Node ≥18); jsDelivr `gh` CDN; `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-15-tampermonkey-script-loader-design.md`

---

## File Structure

- `tampermonkey/loader.user.js` — the userscript: `==UserScript==` header, config statics, pure helpers, `main()` (GM/UI), export tail.
- `tampermonkey/registry.json` — curated catalog (source of truth).
- `tampermonkey/package.json` — `node --test` wiring (no deps).
- `tampermonkey/test/*.test.js` — unit tests for pure helpers.
- `tampermonkey/refs/phases.md`, `tampermonkey/refs/inspiration.md` — references.
- `tampermonkey/README.md` — how to install/use/build.
- (v0.9) `tampermonkey/build.sh`, `tampermonkey/registry.embedded.js`, `tampermonkey/build/index.html`, `tampermonkey/build/*.meta.js`.

Pure-helper signatures (used consistently across tasks):
- `buildCdnUrl({repo, ref, path})` → string
- `parseFreeform(input, defaults)` → `{kind:'ref'|'url'|'snippet', repo?, path?, ref?, url?, snippet?, integrity?}`
- `normalizeIntegrity(s)` → token string | null
- `computeSriToken(bytes, algo)` → Promise<string>
- `verifyIntegrity(bytes, token)` → Promise<boolean>
- `parseRegistry(text)` → entries[]
- `validateEntry(entry)` → `{ok:boolean, errors:string[]}`
- `matchUrl(patterns, url)` → boolean
- `entryCdnUrl(entry)` → string

---

### Task 1: Scaffold + test runner

**Files:**
- Create: `tampermonkey/package.json`
- Create: `tampermonkey/test/smoke.test.js`
- Create: `tampermonkey/loader.user.js`

- [ ] **Step 1: Create `tampermonkey/package.json`**

```json
{
  "name": "userscripts-loader",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `tampermonkey/loader.user.js` with header + export tail (no helpers yet)**

```javascript
// ==UserScript==
// @name         userscripts loader
// @namespace    https://github.com/mcint/userscripts
// @version      0.1.0
// @description  Load other userscripts from GitHub: curated registry + freeform, per-domain auto-load, SRI integrity.
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      cdn.jsdelivr.net
// @connect      raw.githubusercontent.com
// @downloadURL  https://cdn.jsdelivr.net/gh/mcint/userscripts@main/tampermonkey/loader.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/mcint/userscripts@main/tampermonkey/build/loader.meta.js
// ==/UserScript==
'use strict';

// ---- config statics (edit in place) -------------------------------------
const REQUIRE_SRI = false;
const DEFAULT_OWNER = 'mcint';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh';
const REGISTRY_URL = 'https://cdn.jsdelivr.net/gh/mcint/userscripts@main/tampermonkey/registry.json';
const REGISTRY_TTL_MS = 12 * 60 * 60 * 1000;

// ---- pure helpers (filled in by later tasks) ----------------------------

// ---- main (browser only) ------------------------------------------------
function main() {
  // wired up by later tasks
}

// ---- export tail: Node tests require() this; browser runs main() --------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REQUIRE_SRI, DEFAULT_OWNER, CDN_BASE,
  };
} else {
  main();
}
```

- [ ] **Step 3: Create `tampermonkey/test/smoke.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('loader requires cleanly and exposes config', () => {
  assert.strictEqual(L.DEFAULT_OWNER, 'mcint');
  assert.strictEqual(typeof L.REQUIRE_SRI, 'boolean');
});
```

- [ ] **Step 4: Run tests**

Run: `cd tampermonkey && node --test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add tampermonkey/package.json tampermonkey/loader.user.js tampermonkey/test/smoke.test.js
git commit -m "feat(tampermonkey): scaffold loader + node --test harness"
```

---

### Task 2: `buildCdnUrl` + `entryCdnUrl`

**Files:**
- Modify: `tampermonkey/loader.user.js` (add helpers + export)
- Test: `tampermonkey/test/cdnurl.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/cdnurl.test.js`

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/cdnurl.test.js`
Expected: FAIL — `L.buildCdnUrl is not a function`.

- [ ] **Step 3: Implement** — in `loader.user.js`, under the "pure helpers" comment:

```javascript
function buildCdnUrl({ repo, ref, path }) {
  const p = String(path).replace(/^\/+/, '');
  return `${CDN_BASE}/${repo}@${ref}/${p}`;
}

function entryCdnUrl(entry) {
  return buildCdnUrl({ repo: entry.repo, ref: entry.ref || 'main', path: entry.path });
}
```

- [ ] **Step 4: Add to exports** — extend the `module.exports` object:

```javascript
    REQUIRE_SRI, DEFAULT_OWNER, CDN_BASE,
    buildCdnUrl, entryCdnUrl,
```

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/cdnurl.test.js
git commit -m "feat(tampermonkey): buildCdnUrl/entryCdnUrl"
```

---

### Task 3: `normalizeIntegrity`

**Files:**
- Modify: `tampermonkey/loader.user.js`
- Test: `tampermonkey/test/integrity-parse.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/integrity-parse.test.js`

```javascript
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
```

Note: pip-style is hex; we tag it `-hex` so `verifyIntegrity` (Task 5) compares hex, not base64.

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/integrity-parse.test.js`
Expected: FAIL — `L.normalizeIntegrity is not a function`.

- [ ] **Step 3: Implement**

```javascript
function normalizeIntegrity(s) {
  if (!s) { return null; }
  const v = String(s).trim().replace(/^#/, '');
  let m = v.match(/^(sha256|sha384|sha512)-(.+)$/);
  if (m) { return `${m[1]}-${m[2]}`; }
  m = v.match(/^(sha256|sha384|sha512)=([0-9a-fA-F]+)$/);
  if (m) { return `${m[1]}-${m[2].toLowerCase()}-hex`; }
  return null;
}
```

- [ ] **Step 4: Add to exports** — add `normalizeIntegrity,` to `module.exports`.

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/integrity-parse.test.js
git commit -m "feat(tampermonkey): normalizeIntegrity (SRI token + pip-style alias)"
```

---

### Task 4: `parseFreeform`

**Files:**
- Modify: `tampermonkey/loader.user.js`
- Test: `tampermonkey/test/freeform.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/freeform.test.js`

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/freeform.test.js`
Expected: FAIL — `L.parseFreeform is not a function`.

- [ ] **Step 3: Implement**

```javascript
function parseFreeform(input, defaults) {
  const d = defaults || { owner: DEFAULT_OWNER, ref: 'main' };
  const raw = String(input).trim();

  // URL form
  if (/^https?:\/\//i.test(raw)) {
    const hashIdx = raw.indexOf('#');
    const url = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
    const integrity = hashIdx >= 0 ? normalizeIntegrity(raw.slice(hashIdx + 1)) : null;
    return { kind: 'url', url, integrity };
  }

  // shorthand: owner/repo/path[@ref] or repo/path[@ref] — must look path-like, single line
  const oneLine = !/[\r\n]/.test(raw);
  const slashParts = raw.split('/');
  if (oneLine && slashParts.length >= 2 && !/[(){};=]/.test(slashParts[0])) {
    let ref = d.ref;
    let body = raw;
    const at = raw.lastIndexOf('@');
    if (at > 0) { ref = raw.slice(at + 1); body = raw.slice(0, at); }
    const parts = body.split('/');
    let owner, rest;
    // heuristic: if first segment looks like a known owner repo pair, keep 2 as repo
    if (parts.length >= 3 && !/\./.test(parts[0]) && !/\./.test(parts[1])) {
      owner = parts[0]; rest = parts.slice(1);
    } else {
      owner = d.owner; rest = parts;
    }
    const repoName = rest.shift();
    const path = rest.join('/');
    if (repoName && path) {
      return { kind: 'ref', repo: `${owner}/${repoName}`, path, ref, integrity: null };
    }
  }

  // otherwise: a pasted snippet
  return { kind: 'snippet', snippet: raw };
}
```

- [ ] **Step 4: Add to exports** — add `parseFreeform,`.

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/freeform.test.js
git commit -m "feat(tampermonkey): parseFreeform (ref shorthand / URL / snippet)"
```

---

### Task 5: `computeSriToken` + `verifyIntegrity`

**Files:**
- Modify: `tampermonkey/loader.user.js`
- Test: `tampermonkey/test/integrity-verify.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/integrity-verify.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const L = require('../loader.user.js');

const bytes = new TextEncoder().encode('hello world');

test('computeSriToken matches node crypto base64 digest', async () => {
  const token = await L.computeSriToken(bytes, 'sha384');
  const expected = 'sha384-' + crypto.createHash('sha384').update(Buffer.from(bytes)).digest('base64');
  assert.strictEqual(token, expected);
});

test('verifyIntegrity true on match, false on mismatch', async () => {
  const good = await L.computeSriToken(bytes, 'sha256');
  assert.strictEqual(await L.verifyIntegrity(bytes, good), true);
  assert.strictEqual(await L.verifyIntegrity(bytes, 'sha256-bm90cmlnaHQ='), false);
});

test('verifyIntegrity supports pip-style hex token', async () => {
  const hex = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  assert.strictEqual(await L.verifyIntegrity(bytes, `sha256-${hex}-hex`), true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/integrity-verify.test.js`
Expected: FAIL — `L.computeSriToken is not a function`.

- [ ] **Step 3: Implement**

```javascript
function _subtle() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  if (typeof require !== 'undefined') { return require('crypto').webcrypto.subtle; }
  throw new Error('WebCrypto unavailable');
}

function _toB64(buf) {
  const a = new Uint8Array(buf);
  if (typeof Buffer !== 'undefined') { return Buffer.from(a).toString('base64'); }
  let s = '';
  for (let i = 0; i < a.length; i++) { s += String.fromCharCode(a[i]); }
  return btoa(s);
}

function _toHex(buf) {
  const a = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i++) { s += a[i].toString(16).padStart(2, '0'); }
  return s;
}

const _ALGO = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };

async function computeSriToken(bytes, algo) {
  const buf = await _subtle().digest(_ALGO[algo], bytes);
  return `${algo}-${_toB64(buf)}`;
}

async function verifyIntegrity(bytes, token) {
  const norm = normalizeIntegrity(token);
  if (!norm) { return false; }
  const hex = norm.endsWith('-hex');
  const core = hex ? norm.slice(0, -4) : norm;
  const algo = core.slice(0, core.indexOf('-'));
  const expected = core.slice(algo.length + 1);
  const buf = await _subtle().digest(_ALGO[algo], bytes);
  const actual = hex ? _toHex(buf) : _toB64(buf);
  return actual === expected;
}
```

- [ ] **Step 4: Add to exports** — add `computeSriToken, verifyIntegrity,`.

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/integrity-verify.test.js
git commit -m "feat(tampermonkey): computeSriToken + verifyIntegrity (WebCrypto)"
```

---

### Task 6: `parseRegistry` + `validateEntry`

**Files:**
- Modify: `tampermonkey/loader.user.js`
- Test: `tampermonkey/test/registry.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/registry.test.js`

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/registry.test.js`
Expected: FAIL — `L.parseRegistry is not a function`.

- [ ] **Step 3: Implement**

```javascript
function parseRegistry(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) { throw new Error('registry must be a JSON array'); }
  return data;
}

function validateEntry(entry) {
  const errors = [];
  if (!entry.id) { errors.push('missing id'); }
  if (!entry.name) { errors.push('missing name'); }
  if (!entry.repo || !/^[^/]+\/[^/]+$/.test(entry.repo)) { errors.push('repo must be owner/name'); }
  if (!entry.path) { errors.push('missing path'); }
  if (entry.integrity != null && normalizeIntegrity(entry.integrity) == null) {
    errors.push('integrity must be an SRI token');
  }
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Add to exports** — add `parseRegistry, validateEntry,`.

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/registry.test.js
git commit -m "feat(tampermonkey): parseRegistry + validateEntry"
```

---

### Task 7: `matchUrl` (`@match`-style globbing)

**Files:**
- Modify: `tampermonkey/loader.user.js`
- Test: `tampermonkey/test/matcher.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/matcher.test.js`

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/matcher.test.js`
Expected: FAIL — `L.matchUrl is not a function`.

- [ ] **Step 3: Implement** — Tampermonkey `@match` subset: `scheme://host/path`, `*` scheme = http|https, `*` in host matches a label span, `*` in path matches any.

```javascript
function _matchOne(pattern, url) {
  const m = pattern.match(/^([^:]+):\/\/([^/]*)(\/.*)$/);
  if (!m) { return false; }
  const [, scheme, host, path] = m;
  const u = url.match(/^([^:]+):\/\/([^/]*)(\/.*)?$/);
  if (!u) { return false; }
  const [, uScheme, uHost, uPath = '/'] = u;

  if (scheme === '*') {
    if (uScheme !== 'http' && uScheme !== 'https') { return false; }
  } else if (scheme !== uScheme) { return false; }

  const hostRe = new RegExp('^' + host.split('*').map(_esc).join('.*') + '$');
  if (!hostRe.test(uHost)) { return false; }

  const pathRe = new RegExp('^' + path.split('*').map(_esc).join('.*') + '$');
  return pathRe.test(uPath);
}

function _esc(s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }

function matchUrl(patterns, url) {
  if (!Array.isArray(patterns)) { return false; }
  return patterns.some((p) => _matchOne(p, url));
}
```

- [ ] **Step 4: Add to exports** — add `matchUrl,`.

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS (all suites).

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/matcher.test.js
git commit -m "feat(tampermonkey): matchUrl (@match-subset globbing)"
```

---

### Task 8: Seed `registry.json`

**Files:**
- Create: `tampermonkey/registry.json`
- Test: `tampermonkey/test/registry-file.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/registry-file.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../loader.user.js');

test('shipped registry.json is valid and every entry validates', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'registry.json'), 'utf8');
  const entries = L.parseRegistry(text);
  assert.ok(entries.length >= 1);
  for (const e of entries) {
    const r = L.validateEntry(e);
    assert.ok(r.ok, `entry ${e.id} invalid: ${r.errors.join(', ')}`);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/registry-file.test.js`
Expected: FAIL — ENOENT (no registry.json).

- [ ] **Step 3: Create `tampermonkey/registry.json`**

```json
[
  {
    "id": "nav-popups",
    "name": "Navigation popups (live)",
    "repo": "mcint/userscripts",
    "path": "mw/nav-popups/popups.js",
    "ref": "main",
    "match": ["*://*.wikipedia.org/*"],
    "runAt": "document-idle",
    "grant": [],
    "integrity": null,
    "desc": "Wikipedia hover previews (maintained fork)"
  }
]
```

- [ ] **Step 4: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tampermonkey/registry.json tampermonkey/test/registry-file.test.js
git commit -m "feat(tampermonkey): seed registry.json (nav-popups) + validity test"
```

---

### Task 9: GM fetch + execute with integrity gate

**Files:**
- Modify: `tampermonkey/loader.user.js` (impure helpers + main wiring)

Manual verification (no unit test — needs GM_* + a browser).

- [ ] **Step 1: Implement impure helpers** — add above `main()`:

```javascript
function gmFetchText(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET', url,
      onload: (r) => (r.status >= 200 && r.status < 300)
        ? resolve(r.responseText)
        : reject(new Error(`HTTP ${r.status} for ${url}`)),
      onerror: () => reject(new Error(`network error for ${url}`)),
    });
  });
}

function executeText(text, label) {
  const el = document.createElement('script');
  el.textContent = `// userscripts-loader: ${label}\n${text}`;
  (document.head || document.documentElement).appendChild(el);
  el.remove();
}

// source: {kind, ...} from parseFreeform OR a registry entry coerced to {kind:'ref',...}
async function loadSource(source, opts) {
  const requireSri = REQUIRE_SRI || (opts && opts.requireSri);
  let text, integrity, label;
  if (source.kind === 'snippet') {
    text = source.snippet; integrity = null; label = 'snippet';
  } else {
    const url = source.kind === 'url' ? source.url
      : buildCdnUrl({ repo: source.repo, ref: source.ref || 'main', path: source.path });
    label = url;
    text = await gmFetchText(url);
    integrity = source.integrity || (source.entry && source.entry.integrity) || null;
  }
  if (integrity) {
    const ok = await verifyIntegrity(new TextEncoder().encode(text), integrity);
    if (!ok) { throw new Error(`integrity mismatch: ${label}`); }
  } else if (requireSri) {
    throw new Error(`integrity required but absent: ${label}`);
  }
  executeText(text, label);
}
```

- [ ] **Step 2: Manual smoke** — Temporarily set `main` to:

```javascript
function main() {
  loadSource({ kind: 'ref', repo: 'mcint/userscripts', path: 'mw/nav-popups/popups.js', ref: 'main' })
    .then(() => console.log('[loader] loaded nav-popups'))
    .catch((e) => console.error('[loader]', e));
}
```

Install `loader.user.js` in Tampermonkey, visit `https://en.wikipedia.org`, open devtools.
Expected: console logs `[loader] loaded nav-popups`; hovering a wikilink shows a popup. Approve the `@connect cdn.jsdelivr.net` prompt if shown.

- [ ] **Step 3: Revert the temporary `main`** back to the empty stub (Task 11 wires it properly).

- [ ] **Step 4: Run unit tests** (ensure require still clean) — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tampermonkey/loader.user.js
git commit -m "feat(tampermonkey): GM fetch + execute with SRI integrity gate"
```

---

### Task 10: Persistence layer

**Files:**
- Modify: `tampermonkey/loader.user.js`
- Test: `tampermonkey/test/state.test.js`

State shape is pure and testable via a pluggable store; GM wrappers are thin.

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/state.test.js`

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/state.test.js`
Expected: FAIL — `L.emptyState is not a function`.

- [ ] **Step 3: Implement** — pure state fns + GM wrappers:

```javascript
function emptyState() { return { enabled: {}, recents: [] }; }

function applyEnabled(state, id, on) {
  return { ...state, enabled: { ...state.enabled, [id]: !!on } };
}

function isEnabled(state, entry, defaultOn) {
  return Object.prototype.hasOwnProperty.call(state.enabled, entry.id)
    ? state.enabled[entry.id]
    : !!defaultOn;
}

function pushRecent(state, item, cap) {
  const recents = [item, ...state.recents.filter((x) => x !== item)].slice(0, cap);
  return { ...state, recents };
}

const STATE_KEY = 'loaderState';
function loadState() {
  try { return Object.assign(emptyState(), JSON.parse(GM_getValue(STATE_KEY, '{}'))); }
  catch (_e) { return emptyState(); }
}
function saveState(state) { GM_setValue(STATE_KEY, JSON.stringify(state)); }
```

- [ ] **Step 4: Add to exports** — add `emptyState, applyEnabled, isEnabled, pushRecent,`.

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/state.test.js
git commit -m "feat(tampermonkey): persistence (pure state fns + GM wrappers)"
```

---

### Task 11: Registry loading (embedded-first, TTL refresh) + auto-load orchestration

**Files:**
- Modify: `tampermonkey/loader.user.js`
- Test: `tampermonkey/test/autoload.test.js`

- [ ] **Step 1: Write failing test** — create `tampermonkey/test/autoload.test.js`

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tampermonkey && node --test test/autoload.test.js`
Expected: FAIL — `L.entriesToAutoLoad is not a function`.

- [ ] **Step 3: Implement pure selector + impure registry load + wire `main`**

```javascript
function entriesToAutoLoad(entries, state, url) {
  return entries.filter((e) => {
    const defaultOn = matchUrl(e.match || [], url);
    return defaultOn && isEnabled(state, e, true);
  });
}

// embedded registry: present when build.sh has run (Task 15); else null.
const EMBEDDED_REGISTRY = (typeof EMBEDDED_REGISTRY_JSON !== 'undefined') ? EMBEDDED_REGISTRY_JSON : null;

async function getRegistry() {
  const state = loadState();
  const cache = state.registryCache;
  const fresh = cache && (Date.now() - cache.fetchedAt) < REGISTRY_TTL_MS;
  if (fresh) { return cache.entries; }
  try {
    const text = await gmFetchText(REGISTRY_URL);
    const entries = parseRegistry(text);
    saveState({ ...state, registryCache: { fetchedAt: Date.now(), entries } });
    return entries;
  } catch (_e) {
    if (cache) { return cache.entries; }
    return EMBEDDED_REGISTRY || [];
  }
}

function main() {
  getRegistry().then((entries) => {
    const state = loadState();
    const due = entriesToAutoLoad(entries, state, location.href);
    for (const e of due) {
      loadSource({ kind: 'ref', repo: e.repo, ref: e.ref || 'main', path: e.path, entry: e })
        .catch((err) => console.error('[loader]', e.id, err));
    }
    registerMenu(entries);  // Task 12
  });
}
```

Note: `Date.now()` is fine in the browser; it is only referenced inside `main`/`getRegistry`, never at require time, so Node tests are unaffected.

- [ ] **Step 4: Add to exports** — add `entriesToAutoLoad,`.

- [ ] **Step 5: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

Note: `registerMenu` is defined in Task 12; until then, comment out its call to keep the script runnable if you smoke-test mid-stream.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/autoload.test.js
git commit -m "feat(tampermonkey): registry load (embedded/TTL) + auto-load orchestration"
```

---

### Task 12: Picker panel UI + menu command + hash helper

**Files:**
- Modify: `tampermonkey/loader.user.js`

Manual verification (DOM + GM_registerMenuCommand).

- [ ] **Step 1: Implement UI** — add above `main()`:

```javascript
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  Object.assign(e, attrs || {});
  for (const c of (children || [])) { e.append(c); }
  return e;
}

function openPicker(entries) {
  const state = loadState();
  const overlay = el('div', {
    style: 'position:fixed;top:10px;right:10px;z-index:2147483647;background:#fff;color:#000;border:1px solid #888;border-radius:6px;padding:12px;max-height:80vh;overflow:auto;font:13px/1.4 sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.3)',
  });
  overlay.append(el('div', { textContent: 'userscripts loader', style: 'font-weight:bold;margin-bottom:8px' }));

  for (const e of entries) {
    const cb = el('input', { type: 'checkbox', checked: isEnabled(state, e, matchUrl(e.match || [], location.href)) });
    cb.addEventListener('change', () => { saveState(applyEnabled(loadState(), e.id, cb.checked)); });
    const run = el('button', { textContent: 'load now', style: 'margin-left:6px' });
    run.addEventListener('click', () => {
      loadSource({ kind: 'ref', repo: e.repo, ref: e.ref || 'main', path: e.path, entry: e })
        .catch((err) => alert('load failed: ' + err.message));
    });
    overlay.append(el('label', { style: 'display:block;margin:2px 0' }, [cb, ' ' + e.name + ' ', run]));
  }

  // freeform
  const input = el('input', { placeholder: 'owner/repo/path@ref, URL#sri, or paste snippet', style: 'width:320px' });
  const reqSri = el('input', { type: 'checkbox' });
  const go = el('button', { textContent: 'load' });
  go.addEventListener('click', () => {
    const src = parseFreeform(input.value, { owner: DEFAULT_OWNER, ref: 'main' });
    loadSource(src, { requireSri: reqSri.checked })
      .then(() => { saveState(pushRecent(loadState(), input.value, 20)); })
      .catch((err) => alert('load failed: ' + err.message));
  });
  const hash = el('button', { textContent: 'hash it' });
  hash.addEventListener('click', async () => {
    const src = parseFreeform(input.value, { owner: DEFAULT_OWNER, ref: 'main' });
    const text = src.kind === 'snippet' ? src.snippet
      : await gmFetchText(src.kind === 'url' ? src.url : buildCdnUrl({ repo: src.repo, ref: src.ref || 'main', path: src.path }));
    const token = await computeSriToken(new TextEncoder().encode(text), 'sha384');
    prompt('SRI token (copy into registry.json "integrity"):', token);
  });
  overlay.append(el('hr'));
  overlay.append(el('label', {}, [el('span', { textContent: 'require SRI ' }), reqSri]));
  overlay.append(el('div', {}, [input, go, hash]));

  const close = el('button', { textContent: 'close', style: 'margin-top:8px' });
  close.addEventListener('click', () => overlay.remove());
  overlay.append(el('div', {}, [close]));

  document.body.append(overlay);
}

function registerMenu(entries) {
  GM_registerMenuCommand('Open userscripts loader', () => openPicker(entries));
}
```

- [ ] **Step 2: Manual verify** — Reinstall the loader, load any page. Tampermonkey menu → "Open userscripts loader". Panel shows nav-popups with a checkbox + "load now"; freeform field loads `mcint/userscripts/scripts/...@main`; "hash it" shows an SRI token; "require SRI" + a hashless freeform load is refused.

- [ ] **Step 3: Run unit tests** (require still clean) — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tampermonkey/loader.user.js
git commit -m "feat(tampermonkey): picker panel, menu command, hash helper"
```

---

### Task 13: README + refs

**Files:**
- Create: `tampermonkey/README.md`
- Create: `tampermonkey/refs/phases.md`
- Create: `tampermonkey/refs/inspiration.md`

- [ ] **Step 1: Write `tampermonkey/refs/phases.md`**

```markdown
# Userscript phases & lifecycle

`@run-at` controls when a userscript runs:

| value | when |
|---|---|
| `document-start` | before any DOM is built; earliest hook (block/patch globals) |
| `document-body`  | as soon as `<body>` exists |
| `document-end`   | at DOMContentLoaded (DOM ready, subresources maybe not) |
| `document-idle`  | after load; default; safest for DOM reads (loader uses this) |
| `context-menu`   | only when invoked from the page context menu (where supported) |

Injection context: managers run scripts in an isolated sandbox; reaching page
globals needs `unsafeWindow` or a `<script>` element (what `executeText` does).

## Docs
- Tampermonkey: https://www.tampermonkey.net/documentation.php
- Violentmonkey: https://violentmonkey.github.io/api/metadata-block/
- Greasemonkey: https://wiki.greasespot.net/Metadata_Block
- MDN userscripts/extensions: https://developer.mozilla.org/
- web.dev (SRI, CSP): https://web.dev/articles/subresource-integrity
```

- [ ] **Step 2: Write `tampermonkey/refs/inspiration.md`**

```markdown
# Inspiration (prior art we draw FROM)

Kept separate from any future COMPARISON doc (methods convention).

- jsDelivr `gh` passthrough — CDN delivery of repo files with JS content-type:
  https://www.jsdelivr.com/documentation#id-github
- W3C Subresource Integrity — the `sha384-<base64>` token format:
  https://www.w3.org/TR/SRI/
- RFC 6920 `ni:` Named Information URIs; multihash/IPFS CIDs — hash-as-identifier.
- PEP 723 inline script metadata (`# /// script`) — header-config inspiration.
- Tampermonkey `@require`/`@resource` + `@downloadURL`/`@updateURL` — self-hosting
  update model this loader mirrors.
```

- [ ] **Step 3: Write `tampermonkey/README.md`**

```markdown
# tampermonkey/ — script loader

Install `loader.user.js` once (click it on the jsDelivr/raw URL). It loads other
userscripts from GitHub: a curated `registry.json` (auto-loaded per-domain) plus a
freeform field (URL or pasted snippet). Integrity via SRI tokens.

- **Install:** open `https://cdn.jsdelivr.net/gh/mcint/userscripts@main/tampermonkey/loader.user.js`
- **Use:** Tampermonkey menu → "Open userscripts loader"
- **Config:** edit the `const` block at the top of `loader.user.js`
  (`REQUIRE_SRI`, `DEFAULT_OWNER`, `REGISTRY_URL`, `REGISTRY_TTL_MS`).
- **Add a script:** add an entry to `registry.json` (see the design spec for the
  schema); use the panel's "hash it" to fill `integrity`.
- **Tests:** `cd tampermonkey && node --test`
- **Phases & prior art:** see `refs/`.

Design: `../docs/superpowers/specs/2026-06-15-tampermonkey-script-loader-design.md`
```

- [ ] **Step 4: Commit**

```bash
git add tampermonkey/README.md tampermonkey/refs/
git commit -m "docs(tampermonkey): README + refs (phases, inspiration)"
```

---

### Task 14 (v0.9): `build.sh` — embedded registry, static index, meta.js

**Files:**
- Create: `tampermonkey/build.sh`
- Modify: `tampermonkey/loader.user.js` (prepend embedded registry on build)

- [ ] **Step 1: Write `tampermonkey/build.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# 1. embedded registry: registry.embedded.js defines EMBEDDED_REGISTRY_JSON
printf 'const EMBEDDED_REGISTRY_JSON = %s;\n' "$(cat registry.json)" > registry.embedded.js

# 2. static install index
mkdir -p build
{
  echo '<!doctype html><meta charset=utf-8><title>userscripts</title><h1>userscripts</h1><ul>'
  node -e '
    const r = require("./registry.json");
    for (const e of r) {
      const url = `https://cdn.jsdelivr.net/gh/${e.repo}@${e.ref||"main"}/${e.path}`;
      console.log(`<li><a href="${url}">${e.name}</a> — <code>${e.repo}/${e.path}</code></li>`);
    }
  '
  echo '</ul>'
} > build/index.html

# 3. loader.meta.js (metadata block only, for @updateURL checks)
sed -n '/==UserScript==/,/==\/UserScript==/p' loader.user.js > build/loader.meta.js

echo "build complete: registry.embedded.js, build/index.html, build/loader.meta.js"
```

- [ ] **Step 2: Make executable and run**

Run: `chmod +x tampermonkey/build.sh && ./tampermonkey/build.sh`
Expected: prints "build complete"; `registry.embedded.js`, `build/index.html`, `build/loader.meta.js` exist.

- [ ] **Step 3: Verify embedded registry parses** — add `tampermonkey/test/embedded.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('registry.embedded.js defines parseable EMBEDDED_REGISTRY_JSON', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'registry.embedded.js'), 'utf8');
  const json = src.replace(/^const EMBEDDED_REGISTRY_JSON = /, '').replace(/;\s*$/, '');
  const entries = JSON.parse(json);
  assert.ok(Array.isArray(entries) && entries.length >= 1);
});
```

- [ ] **Step 4: Run tests** — Run: `cd tampermonkey && node --test`  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tampermonkey/build.sh tampermonkey/registry.embedded.js tampermonkey/build/ tampermonkey/test/embedded.test.js
git commit -m "feat(tampermonkey): build.sh — embedded registry, static index, meta.js"
```

---

### Task 15: Wire embedded registry into the loader (optional prepend)

**Files:**
- Modify: `tampermonkey/README.md` (document distribution build)

- [ ] **Step 1: Document the distribution variant** — append to `tampermonkey/README.md`:

```markdown
## Distribution build

`build.sh` writes `registry.embedded.js`. To ship a self-contained loader that
works with zero network on a cold page, concatenate it ahead of the loader:

    cat tampermonkey/registry.embedded.js tampermonkey/loader.user.js > dist/loader.user.js

The loader detects `EMBEDDED_REGISTRY_JSON` and uses it as the fallback when the
live `registry.json` fetch fails or before the first refresh.
```

- [ ] **Step 2: Verify fallback logic exists** — confirm `loader.user.js` line `const EMBEDDED_REGISTRY = (typeof EMBEDDED_REGISTRY_JSON !== 'undefined') ? EMBEDDED_REGISTRY_JSON : null;` (added in Task 11). No code change if present.

- [ ] **Step 3: Commit**

```bash
git add tampermonkey/README.md
git commit -m "docs(tampermonkey): document embedded-registry distribution build"
```

---

## Self-Review

**Spec coverage:**
- §1 layout → Tasks 1, 8, 13, 14. §2 loader header/invocation/config statics → Tasks 1, 11. §3 registry schema → Tasks 6, 8. §4 load+execute/integrity/hash helper → Tasks 5, 9, 12. §5 persistence (+recents cap) → Task 10. §6 static/dynamic → Tasks 11, 14, 15. §7 self-hosting headers → Tasks 1 (header), 14 (meta.js). §8 refs → Task 13. §9 scope: v0 = Tasks 1–13; v0.9 = Tasks 14–15; deferred items not scheduled (correct).
- Storage-size limiting (§5 future) intentionally unscheduled — `pushRecent` cap is the only bound in v0.
- SRI *enforcement default* deferred: `REQUIRE_SRI=false` + per-load checkbox (Tasks 1, 9, 12) — matches spec.

**Placeholder scan:** No TBD/TODO; every code step has complete code; manual-verify steps (9, 12) state exact actions + expected results.

**Type consistency:** `loadSource(source, opts)`, `gmFetchText`, `buildCdnUrl`, `entryCdnUrl`, `normalizeIntegrity`, `computeSriToken`, `verifyIntegrity`, `parseRegistry`, `validateEntry`, `matchUrl`, `emptyState/applyEnabled/isEnabled/pushRecent`, `entriesToAutoLoad`, `getRegistry`, `openPicker/registerMenu` — names consistent across tasks. `EMBEDDED_REGISTRY_JSON` (build output) vs `EMBEDDED_REGISTRY` (in-loader const) used consistently.

**Note:** Tasks 9 and 12 are browser-manual; if the executor is fully headless, mark them blocked for a human pass and proceed with unit-tested tasks.
