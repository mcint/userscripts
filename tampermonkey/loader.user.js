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
// @grant        unsafeWindow
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

// ---- pure helpers -------------------------------------------------------

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

// ---- legacy section label -----------------------------------------------

function buildCdnUrl({ repo, ref, path }) {
  const p = String(path).replace(/^\/+/, '');
  return `${CDN_BASE}/${repo}@${ref}/${p}`;
}

function entryCdnUrl(entry) {
  return buildCdnUrl({ repo: entry.repo, ref: entry.ref || 'main', path: entry.path });
}

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
    // need >= 4 parts (owner/repo/dir/file) to confidently infer the owner from input
    if (parts.length >= 4 && !/\./.test(parts[0]) && !/\./.test(parts[1])) {
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

function normalizeIntegrity(s) {
  if (!s) { return null; }
  const v = String(s).trim().replace(/^#/, '');
  let m = v.match(/^(sha256|sha384|sha512)-(.+)$/);
  if (m) { return `${m[1]}-${m[2]}`; }
  m = v.match(/^(sha256|sha384|sha512)=([0-9a-fA-F]+)$/);
  if (m) { return `${m[1]}-${m[2].toLowerCase()}-hex`; }
  return null;
}

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

// ---- persistence: pure state fns ----------------------------------------

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

// ---- impure helpers (GM/DOM — only called from main) --------------------

const STATE_KEY = 'loaderState';
function loadState() {
  try { return Object.assign(emptyState(), JSON.parse(GM_getValue(STATE_KEY, '{}'))); }
  catch (_e) { return emptyState(); }
}
function saveState(state) { GM_setValue(STATE_KEY, JSON.stringify(state)); }


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

// ---- registry + auto-load ------------------------------------------------

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

async function hashInput(input) {
  const src = parseFreeform(input, { owner: DEFAULT_OWNER, ref: 'main' });
  const text = src.kind === 'snippet' ? src.snippet
    : await gmFetchText(src.kind === 'url' ? src.url
      : buildCdnUrl({ repo: src.repo, ref: src.ref || 'main', path: src.path }));
  return computeSriToken(new TextEncoder().encode(text), 'sha384');
}

// ---- storage binding + activation API (browser-only; called from main) --

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

// ---- main (browser only) ------------------------------------------------
function main() {
  getRegistry().then((entries) => {
    const state = loadState();
    // 1. auto-load matching + enabled entries
    for (const e of entriesToAutoLoad(entries, state, location.href)) {
      loadSource({ kind: 'ref', repo: e.repo, ref: e.ref || 'main', path: e.path, entry: e })
        .catch((err) => console.error('[loader]', e.id, err));
    }
    // 2. console API (devtools, with args) + prompt-based menu — the minimal
    //    interactive surface; the on-page panel is a later phase (Task 12).
    const api = {
      list: () => entries.map((e) => ({ id: e.id, name: e.name, repo: e.repo, path: e.path })),
      load: (input, opts) => loadSource(parseFreeform(input, { owner: DEFAULT_OWNER, ref: 'main' }), opts),
      loadEntry: (id) => {
        const e = entries.find((x) => x.id === id);
        return e ? loadSource({ kind: 'ref', repo: e.repo, ref: e.ref || 'main', path: e.path, entry: e })
          : Promise.reject(new Error('no entry ' + id));
      },
      hashIt: (input) => hashInput(input),
    };
    (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).usLoader = api;
    GM_registerMenuCommand('usLoader: load (prompt)', () => {
      const v = prompt('owner/repo/path@ref, URL#sri, or paste snippet');
      if (v) { api.load(v).catch((e) => alert('load failed: ' + e.message)); }
    });
    GM_registerMenuCommand('usLoader: list in console', () => console.table(api.list()));
    GM_registerMenuCommand('usLoader: hash input', async () => {
      const v = prompt('owner/repo/path@ref or URL to hash');
      if (v) { prompt('SRI token (copy into registry.json "integrity"):', await api.hashIt(v)); }
    });
  });
}

// ---- export tail: Node tests require() this; browser runs main() --------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REQUIRE_SRI, DEFAULT_OWNER, CDN_BASE,
    buildCdnUrl, entryCdnUrl,
    parseFreeform,
    normalizeIntegrity,
    computeSriToken, verifyIntegrity,
    parseRegistry, validateEntry,
    matchUrl,
    emptyState, applyEnabled, isEnabled, pushRecent,
    entriesToAutoLoad,
    effectiveActive, activationKey, readScopes, writeScope, deriveStatus, statusGlyph,
  };
} else {
  main();
}
