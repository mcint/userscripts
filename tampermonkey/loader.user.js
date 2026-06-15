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
    parseFreeform,
    normalizeIntegrity,
  };
} else {
  main();
}
