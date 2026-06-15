# Loader Dock Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the on-page **dock** (collapsed lower-right icon → hover-expand) with a per-script **status glyph** and `[tab]/[session]/[site]` activation levers, plus an early-hydrated `window.usLoader` public object — building on the existing v0 loader.

**Architecture:** Extend `tampermonkey/loader.user.js`. Pure activation/status logic is unit-tested (`node --test`) with injected storage mocks; DOM dock, storage wiring, and the `@run-at document-start` change are browser-manual. Ships `tab`(sessionStorage) + `site`(localStorage); `[session]` renders disabled ("soon") per decision D6.

**Tech Stack:** Vanilla ES2020, GM_* APIs, sessionStorage/localStorage, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-15-tampermonkey-script-loader-design.md` (§2, §2.1, §5). **Decisions:** `tampermonkey/refs/decisions.md` (D6–D9).

**Branch:** `feat/loader-dock` (already checked out).

---

## File structure

- Modify `tampermonkey/loader.user.js` — add pure activation/status helpers (+ exports), the `usLoader` activation API, the dock DOM, and `document-start` hydration; change `@run-at`.
- New tests: `tampermonkey/test/activation.test.js`, `tampermonkey/test/status.test.js`.

Pure signatures (consistent across tasks):
- `effectiveActive({tab, session, site})` → boolean (active if any lever on)
- `deriveStatus({loaded, error, warning})` → `'inactive'|'active'|'error'|'warning'`
- `statusGlyph(status)` → `{ symbol, cls }`
- `activationKey(id)` → string
- `readScopes(id, stores)` → `{ tab, session, site }` (booleans)
- `writeScope(id, scope, on, stores)` → mutates the right store; `session` is a no-op in v0

---

### Task 1: Activation + status pure logic (TDD)

**Files:** Modify `tampermonkey/loader.user.js`; Test `tampermonkey/test/activation.test.js`, `tampermonkey/test/status.test.js`.

- [ ] **Step 1: Write failing tests** — `tampermonkey/test/activation.test.js`

```javascript
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
```

`tampermonkey/test/status.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('deriveStatus precedence: error > warning > active > inactive', () => {
  assert.strictEqual(L.deriveStatus({ loaded: true, error: true }), 'error');
  assert.strictEqual(L.deriveStatus({ loaded: true, warning: true }), 'warning');
  assert.strictEqual(L.deriveStatus({ loaded: true }), 'active');
  assert.strictEqual(L.deriveStatus({ loaded: false }), 'inactive');
});

test('statusGlyph maps each status to a symbol + class', () => {
  assert.deepStrictEqual(L.statusGlyph('inactive'), { symbol: '○', cls: 'us-st-inactive' }); // ○
  assert.deepStrictEqual(L.statusGlyph('active'), { symbol: '●', cls: 'us-st-active' });     // ●
  assert.deepStrictEqual(L.statusGlyph('error'), { symbol: '●', cls: 'us-st-error' });
  assert.deepStrictEqual(L.statusGlyph('warning'), { symbol: '●', cls: 'us-st-warning' });
});
```

- [ ] **Step 2: Run to verify failure** — `cd tampermonkey && node --test test/activation.test.js test/status.test.js` → FAIL (functions undefined).

- [ ] **Step 3: Implement** — add to `loader.user.js` under the pure helpers:

```javascript
function effectiveActive(scopes) {
  return !!(scopes && (scopes.tab || scopes.session || scopes.site));
}

function activationKey(id) { return 'us-loader:act:' + id; }

function readScopes(id, stores) {
  const key = activationKey(id);
  const on = (s) => !!(s && s.getItem(key) === '1');
  return { tab: on(stores.tab), session: false, site: on(stores.site) };
}

function writeScope(id, scope, on, stores) {
  if (scope === 'session') { return; } // v0: lever stubbed (see decision D6)
  const store = scope === 'tab' ? stores.tab : scope === 'site' ? stores.site : null;
  if (!store) { return; }
  const key = activationKey(id);
  if (on) { store.setItem(key, '1'); } else { store.removeItem(key); }
}

function deriveStatus(rt) {
  if (rt && rt.error) { return 'error'; }
  if (rt && rt.warning) { return 'warning'; }
  if (rt && rt.loaded) { return 'active'; }
  return 'inactive';
}

function statusGlyph(status) {
  switch (status) {
    case 'active': return { symbol: '●', cls: 'us-st-active' };
    case 'error': return { symbol: '●', cls: 'us-st-error' };
    case 'warning': return { symbol: '●', cls: 'us-st-warning' };
    default: return { symbol: '○', cls: 'us-st-inactive' };
  }
}
```

- [ ] **Step 4: Add to exports** — extend `module.exports`: `effectiveActive, activationKey, readScopes, writeScope, deriveStatus, statusGlyph,`.

- [ ] **Step 5: Run** — `cd tampermonkey && node --test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add tampermonkey/loader.user.js tampermonkey/test/activation.test.js tampermonkey/test/status.test.js
git commit -m "feat(tampermonkey): activation levers + status pure logic (tab/site; session stubbed)"
```

---

### Task 2: Storage binding + `usLoader` activation API (browser-manual)

**Files:** Modify `tampermonkey/loader.user.js`.

Pure logic is tested in Task 1; this binds it to real storage + the public object. No new unit test (browser-only surfaces); `require()` must stay clean.

- [ ] **Step 1: Implement** — add above `main()`:

```javascript
function browserStores() {
  return { tab: (typeof sessionStorage !== 'undefined' ? sessionStorage : null),
           site: (typeof localStorage !== 'undefined' ? localStorage : null) };
}

// runtime status of loaded scripts this page (id -> {loaded,error,warning})
const _runtime = {};

function scriptStatus(id) { return deriveStatus(_runtime[id] || {}); }

async function activateScript(id, scope, entries) {
  writeScope(id, scope || 'site', true, browserStores());
  const e = entries.find((x) => x.id === id);
  if (!e) { _runtime[id] = { error: true }; return; }
  try {
    await loadSource({ kind: 'ref', repo: e.repo, ref: e.ref || 'main', path: e.path, entry: e });
    _runtime[id] = { loaded: true };
  } catch (err) {
    _runtime[id] = { error: true };
    throw err;
  }
}

function deactivateScript(id) {
  const stores = browserStores();
  writeScope(id, 'tab', false, stores);
  writeScope(id, 'site', false, stores);
  _runtime[id] = { loaded: false };
}
```

- [ ] **Step 2: Manual verify** — temporarily install; in console after load, `window.usLoader` exists (wired in Task 4); `usLoader.status('nav-popups')` returns a status string; `usLoader.activate('nav-popups',{scope:'site'})` loads it and `localStorage['us-loader:act:nav-popups']==='1'`.

- [ ] **Step 3: Run unit tests** — `cd tampermonkey && node --test` → pass; `node -e "require('./tampermonkey/loader.user.js')"` no throw.

- [ ] **Step 4: Commit**

```bash
git add tampermonkey/loader.user.js
git commit -m "feat(tampermonkey): bind activation to sessionStorage/localStorage + script runtime status"
```

---

### Task 3: Dock DOM + styles + events (browser-manual)

**Files:** Modify `tampermonkey/loader.user.js`.

- [ ] **Step 1: Implement** — add a dock builder above `main()`:

```javascript
function injectDockStyles() {
  if (document.getElementById('us-dock-style')) { return; }
  const css = `
  #us-dock{position:fixed;right:14px;bottom:14px;z-index:2147483647;font:13px/1.4 sans-serif}
  #us-dock .us-orb{width:26px;height:26px;border-radius:50%;background:#222;color:#fff;display:flex;
    align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.4)}
  #us-dock .us-panel{display:none;background:#fff;color:#111;border:1px solid #999;border-radius:6px;
    padding:8px;min-width:240px;box-shadow:0 2px 12px rgba(0,0,0,.3)}
  #us-dock:hover .us-panel{display:block}
  #us-dock:hover .us-orb{display:none}
  #us-dock .us-row{display:flex;align-items:center;gap:6px;margin:3px 0}
  #us-dock button{font:12px sans-serif;cursor:pointer}
  #us-dock button[disabled]{opacity:.45;cursor:default}
  .us-st-inactive{color:#999}.us-st-active{color:#1a7f37}.us-st-error{color:#cf222e}.us-st-warning{color:#bf8700}`;
  const el = document.createElement('style'); el.id = 'us-dock-style'; el.textContent = css;
  document.head.appendChild(el);
}

function renderDock(entries) {
  injectDockStyles();
  let dock = document.getElementById('us-dock');
  if (dock) { dock.remove(); }
  dock = document.createElement('div'); dock.id = 'us-dock';

  const orb = document.createElement('div'); orb.className = 'us-orb'; orb.textContent = '⚙'; // ⚙
  orb.title = 'userscripts';
  const panel = document.createElement('div'); panel.className = 'us-panel';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px';
  const title = document.createElement('strong'); title.textContent = 'userscripts';
  const close = document.createElement('button'); close.textContent = '×'; // ×
  close.title = 'collapse'; close.onclick = () => { panel.style.display = 'none'; };
  head.append(title, close); panel.append(head);

  const stores = browserStores();
  for (const e of entries) {
    const scopes = readScopes(e.id, stores);
    const st = deriveStatus(_runtime[e.id] || (effectiveActive(scopes) ? { loaded: true } : {}));
    const g = statusGlyph(st);
    const row = document.createElement('div'); row.className = 'us-row';
    const dot = document.createElement('span'); dot.className = g.cls; dot.textContent = g.symbol;
    const name = document.createElement('span'); name.textContent = e.name; name.style.flex = '1';
    row.append(dot, name);
    for (const scope of ['tab', 'session', 'site']) {
      const b = document.createElement('button'); b.textContent = scope;
      if (scope === 'session') { b.disabled = true; b.title = 'soon'; }
      else {
        if (scopes[scope]) { b.style.fontWeight = 'bold'; }
        b.onclick = () => {
          const cur = readScopes(e.id, stores)[scope];
          if (cur) { writeScope(e.id, scope, false, stores); }
          else { activateScript(e.id, scope, entries).catch((err) => console.error('[loader]', err)); }
          renderDock(entries);
        };
      }
      row.append(b);
    }
    panel.append(row);
  }
  dock.append(orb, panel); document.body.appendChild(dock);
}
```

- [ ] **Step 2: Manual verify** — install; lower-right shows a ⚙ orb; hover expands to the nav-popups row with `○/●` glyph, `tab`/`site` buttons (toggle + load), `session` disabled, and a × that collapses.

- [ ] **Step 3: Run unit tests** — `cd tampermonkey && node --test` → pass; require clean.

- [ ] **Step 4: Commit**

```bash
git add tampermonkey/loader.user.js
git commit -m "feat(tampermonkey): on-page dock — collapsed orb, hover-expand, status + levers"
```

---

### Task 4: Early hydration + wire into loader (browser-manual)

**Files:** Modify `tampermonkey/loader.user.js`.

- [ ] **Step 1: Change `@run-at`** in the header from `// @run-at       document-idle` to `// @run-at       document-start` (hydrate early; defer DOM).

- [ ] **Step 2: Restructure `main()`** — hydrate the public object immediately, defer DOM/auto-load to ready:

```javascript
function main() {
  const PUBLIC = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
  // hydrate early (document-start): object exists + is detectable; costs deferred
  let _entries = null;
  const ensure = () => getRegistry().then((e) => (_entries = e));
  PUBLIC.usLoader = {
    list: () => (_entries ? _entries.map((e) => ({ id: e.id, name: e.name, repo: e.repo, path: e.path }))
                          : ensure().then(() => PUBLIC.usLoader.list())),
    load: (input, opts) => loadSource(parseFreeform(input, { owner: DEFAULT_OWNER, ref: 'main' }), opts),
    loadEntry: (id) => ensure().then((e) => activateScript(id, 'tab', e)),
    activate: (id, opts) => ensure().then((e) => activateScript(id, (opts && opts.scope) || 'site', e)),
    deactivate: (id) => { deactivateScript(id); return true; },
    status: (id) => scriptStatus(id),
    hashIt: (input) => hashInput(input),
  };

  const start = async () => {
    const entries = await ensure();
    const stores = browserStores();
    // auto-load: URL match OR a saved activation (tab/site)
    for (const e of entries) {
      const saved = effectiveActive(readScopes(e.id, stores));
      if (saved || (matchUrl(e.match || [], location.href) && isEnabled(loadState(), e, true))) {
        activateScript(e.id, saved ? 'tab' : 'site', entries).catch((err) => console.error('[loader]', e.id, err));
      }
    }
    renderDock(entries);
    GM_registerMenuCommand('usLoader: open dock', () => {
      const p = document.querySelector('#us-dock .us-panel'); if (p) { p.style.display = 'block'; }
    });
    GM_registerMenuCommand('usLoader: list in console', () => console.table(PUBLIC.usLoader.list()));
    GM_registerMenuCommand('usLoader: hash input', async () => {
      const v = prompt('owner/repo/path@ref or URL to hash');
      if (v) { prompt('SRI token:', await PUBLIC.usLoader.hashIt(v)); }
    });
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') { start(); }
  else { window.addEventListener('DOMContentLoaded', start); }
}
```

Note: `auto-load on saved activation` uses scope `'tab'` only as a re-write label; the saved flag already governs loading — re-writing the same scope is harmless. `Date.now()`, `document`, `window`, `unsafeWindow`, GM_* remain inside functions → `require()` stays clean.

- [ ] **Step 3: Manual verify** — on a Wikipedia page: `window.usLoader` exists immediately (check at document-start via a breakpoint or quick console); nav-popups auto-loads (matches) and the dock shows `●` active; click `site` on, reload → still active (localStorage); `tab` on, new tab → not active. `usLoader.list()` returns entries.

- [ ] **Step 4: Run unit tests** — `cd tampermonkey && node --test` → pass; `node -e "require('./tampermonkey/loader.user.js')"` no throw.

- [ ] **Step 5: Commit**

```bash
git add tampermonkey/loader.user.js
git commit -m "feat(tampermonkey): document-start hydration of usLoader + wire dock/auto-load"
```

---

### Task 5: Docs touch-up

**Files:** Modify `tampermonkey/README.md`.

- [ ] **Step 1: Add a "Dock" line** under Use in `tampermonkey/README.md`:

```markdown
- **Dock:** a ⚙ orb lower-right; hover to expand. Each script row shows a status
  dot (`○` inactive / `●` active, red=error, yellow=warning) and `[tab] [session] [site]`
  activation (session disabled for now). `window.usLoader` is available from
  `document-start` (`activate(id,{scope})`, `deactivate`, `status`, `list`).
```

- [ ] **Step 2: Commit**

```bash
git add tampermonkey/README.md
git commit -m "docs(tampermonkey): document the dock + usLoader public object"
```

---

## Self-Review

**Spec coverage:** §2 early hydration → Task 4; §2.1 dock (orb/hover/close, status glyph, levers) → Tasks 1,3; §5 levers (tab/site native, session stubbed) → Tasks 1,2; status states → Task 1. D6 (session stubbed, localStorage signal) honored; D7 (document-start, id=slug, list from registry) → Task 4; D8 glyph → Task 1; D9 dock slice → Task 3.

**Placeholder scan:** every code step has complete code; browser-manual steps (2,3,4) give exact actions + expected results.

**Type consistency:** `effectiveActive/activationKey/readScopes/writeScope/deriveStatus/statusGlyph` defined Task 1; `browserStores/_runtime/scriptStatus/activateScript/deactivateScript` Task 2; `renderDock/injectDockStyles` Task 3; `main` rewrite Task 4 uses all consistently. `usLoader` API matches the spec/decision D7.

**Note:** Tasks 2–4 are browser-manual (DOM + GM + storage + run-at). A headless executor implements the code, runs `node --test` for the pure logic (Task 1) + require-cleanliness, and flags 2–4 for a human browser pass. `[session]` is intentionally inert (D6 open).
