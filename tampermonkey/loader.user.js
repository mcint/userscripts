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

// ---- pure helpers (filled in by later tasks) ----------------------------

function buildCdnUrl({ repo, ref, path }) {
  const p = String(path).replace(/^\/+/, '');
  return `${CDN_BASE}/${repo}@${ref}/${p}`;
}

function entryCdnUrl(entry) {
  return buildCdnUrl({ repo: entry.repo, ref: entry.ref || 'main', path: entry.path });
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

// ---- main (browser only) ------------------------------------------------
function main() {
  // wired up by later tasks
}

// ---- export tail: Node tests require() this; browser runs main() --------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REQUIRE_SRI, DEFAULT_OWNER, CDN_BASE,
    buildCdnUrl, entryCdnUrl,
    normalizeIntegrity,
  };
} else {
  main();
}
