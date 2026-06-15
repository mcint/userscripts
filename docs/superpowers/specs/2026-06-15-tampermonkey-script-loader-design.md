# Tampermonkey script loader — design

**Status:** design approved 2026-06-15, pending spec review. Repo: `mcint/userscripts`.

An install-once userscript that loads *other* userscripts from GitHub on demand —
a curated catalog plus a freeform escape hatch — with per-domain auto-load,
SRI-ready integrity, and self-hosting (auto-update) headers. Built to ease
distribution and minimise on-demand network calls (embedded registry first,
optional live refresh).

Origin: brainstormed from "a new userscripts dir for tampermonkey scripts, with a
simple picker to include/load other scripts from my github — default `@main` but
freeform available." Pairs with the distribution/versioning roadmap in
[`mw/README.md`](../../../mw/README.md#distribution--versioning-roadmap).

---

## 1. Directory layout (`tampermonkey/`)

```
tampermonkey/
  loader.user.js        # THE install-once meta loader (install this in Tampermonkey)
  registry.json         # curated catalog — source of truth
  registry.embedded.js  # GENERATED: registry.json baked into the loader's default
  build.sh              # regenerate registry.embedded.js + build/ from registry.json
  build/
    index.html          # GENERATED: static install index (per-script install links)
    *.meta.js           # GENERATED: metadata-only headers for native update checks
  refs/                 # references (see §8)
    phases.md           #   userscript lifecycle / @run-at phases, with doc links
    inspiration.md      #   prior art we draw FROM (separate from any comparison)
  README.md
```

Loadable scripts live **anywhere on GitHub** — the repo's own `scripts/*.user.js`
and `mw/nav-popups/popups.js` are just registry entries. `tampermonkey/` houses the
loader + catalog + references, not the loaded scripts. Defaults **prefer `mcint`**:
freeform input prefills the owner as `mcint`, and the curated registry lists own
scripts first.

## 2. The loader userscript

**Self-hosting header** (`a la *monkey` — enables native Tampermonkey auto-update):

```
// ==UserScript==
// @name         userscripts loader
// @namespace    https://github.com/mcint/userscripts
// @version      0.1.0
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
```

**Invocation model:**
- On **every** page (`@match *://*/*`, `document-idle`): auto-load every registry
  entry whose `match`/`domains` apply to the current URL — the "default domains to
  load." Disabled entries and storage-size guards (§5) are respected.
- **Everywhere:** a `GM_registerMenuCommand` entry opens the **picker panel** —
  toggle catalog entries on/off, freeform-load a URL *or* a pasted snippet (§4),
  and use the **hash helper** (§4) to compute an SRI token for the registry.

**Config statics** (top-of-file constants, edited in-place):
- `const REQUIRE_SRI = false;` — when `true`, the loader refuses to run anything
  without a verified integrity hash (the global counterpart to the per-entry
  checkbox in §4).
- `const DEFAULT_OWNER = 'mcint';`
- `const REGISTRY_URL = '…registry.json@main';`, `const REGISTRY_TTL_MS = …;`

## 3. Registry schema (`registry.json`)

An array of entries. **Field names do double duty with Tampermonkey/SRI
conventions** so an entry maps cleanly onto a `==UserScript==` header and a
`<script integrity>`:

```jsonc
{
  "id":        "nav-popups",                 // stable key
  "name":      "Navigation popups (live)",   // ↔ @name
  "repo":      "mcint/userscripts",          // owner/repo on GitHub
  "path":      "mw/nav-popups/popups.js",
  "ref":       "main",                       // default @main; UI/freeform may pin a SHA/tag
  "match":     ["*://*.wikipedia.org/*"],    // ↔ @match; [] = manual-only (no auto-load)
  "runAt":     "document-idle",              // ↔ @run-at
  "grant":     [],                           // ↔ @grant (informational in v0)
  "integrity": null,                         // SRI token "sha384-<base64>" | "sha256-…" | "sha512-…"
  "desc":      "Wikipedia hover previews"
}
```

The CDN URL is derived: `https://cdn.jsdelivr.net/gh/<repo>@<ref>/<path>`.
`@<ref>` defaults to `main` (floats); pin a commit SHA for immutability.

## 4. Load + execute

1. **Source** — either a registry entry, a freeform **URL**, or a freeform
   **pasted snippet**. URLs may carry the hash in the fragment:
   `…popups.js#sha384-<base64>` (SRI token) or pip-style `…#sha256=<hex>`.
2. **Fetch** — `GM_xmlhttpRequest` GET (bypasses page CSP that blocks external
   `<script>`; works cross-origin). Snippets skip fetch.
3. **Integrity (SRI-ready)** — if an `integrity`/fragment hash is present, compute
   the digest (SubtleCrypto: `sha-256`/`-384`/`-512`, algo taken from the token)
   and compare. Behaviour:
   - hash present + matches → run.
   - hash present + mismatch → refuse, surface error.
   - hash absent → run **unless** `REQUIRE_SRI` (global static) or the entry's
     **"require integrity" checkbox** is set, in which case refuse.
4. **Hash helper** — given a URL or pasted snippet, fetch/read the bytes, compute
   the SRI token in the chosen algorithm (256/384/512), and display **token +
   blob** for one-click copy into `registry.json`. (Resolves "offering the
   sha256/384/512 SRI hash and blob.")
5. **Execute** — run the verified text. (Mechanism — Function-eval vs injected
   blob `<script>` — is an implementation-plan detail; v0 picks one and documents
   the page-context vs sandbox trade-off.)

## 5. Persistence (`GM_setValue`)

- `enabled` — set of entry ids the user turned on/off (overrides defaults).
- `domainPrefs` — per-origin overrides (force-on / force-off per site).
- `freeformRecents` — recently freeform-loaded URLs/snippets (with any hashes).
- `registryCache` — `{ fetchedAt, etag, entries }` for the live registry; refreshed
  past `REGISTRY_TTL_MS`, else served from cache (cuts on-demand calls).

**Future (noted, not v0):** storage-size limits — cap `freeformRecents`/cached
blob sizes and surface usage, since GM storage has quotas. Tracked for later.

## 6. Static vs dynamic registry (distribution / fewer calls)

- The loader uses the **embedded** registry (`registry.embedded.js`, baked into the
  loader) first — **zero network** on a cold page, and the loader is self-contained
  for distribution.
- It **optionally refreshes** from `registry.json@main` on a TTL, caching the result
  (§5). Live updates without a loader reinstall, but no per-page fetch storm.
- `build.sh` regenerates `registry.embedded.js`, `build/index.html` (a static
  install index with per-script jsDelivr install links), and `build/*.meta.js`
  (metadata-only headers for native update checks) from `registry.json`.

> Classed as "v0.9" — still in scope, built after the core loader works.

## 7. Self-hosting headers (all scripts)

The loader and any first-party catalog script carry `==UserScript==` headers with
`@version` + `@downloadURL`/`@updateURL` pointing at their self-hosted jsDelivr/raw
locations, so Tampermonkey's native update check works (`*.meta.js` generated by
`build.sh`). This is the per-script analogue of the registry and the on-ramp to the
mw `suggest diff-bump` roadmap.

## 8. References (`tampermonkey/refs/`)

- `phases.md` — userscript **phases/lifecycle**: `@run-at` values
  (`document-start` / `document-body` / `document-end` / `document-idle` /
  `context-menu`), injection contexts (page vs sandbox), and when each fits. Links
  to Tampermonkey, Violentmonkey, Greasemonkey docs; MDN; web.dev; relevant GitHub.
- `inspiration.md` — prior art we draw **from** (kept separate from any future
  comparison doc, per the COMPARISON-vs-INSPIRATION methods convention): existing
  loaders/managers, jsDelivr gh passthrough, SRI, `ni:`/multihash, PEP 723.

## 9. Scope

**v0 (core):** loader.user.js with self-hosting header; `registry.json` + embedded
copy; GM_xhr fetch + execute; SRI-ready integrity (token + fragment formats, helper,
`REQUIRE_SRI` static + per-entry checkbox); per-domain auto-load; picker panel;
freeform URL **and** snippet; persistence; `refs/` docs.

**v0.9 (still in scope):** `build.sh`, static install index, generated `*.meta.js`.

**Deferred (YAGNI for now):** SRI *enforcement by default*; GitHub-API auto-discovery
of scripts; the cross-repo "suggest diff-bump for wiki common.js / Tampermonkey"
tooling (lives in the mw roadmap); storage-size limiting (§5).

## 10. Risks / open questions

- **Execution mechanism** under page CSP and the page-vs-sandbox context trade-off
  — settle in the implementation plan with a small spike.
- **jsDelivr `@main` caching** — the CDN caches branch refs (~12h); document that a
  SHA pin is the way to force-fresh, and that "latest" can lag.
- **`@connect` prompts** — Tampermonkey will prompt for cross-origin fetches;
  enumerate the hosts the loader needs.
- **Testing** — no browser harness in-repo yet; v0 verifies the pure helpers
  (URL/derivation, hash compute/compare, registry parse, match logic) with unit
  tests; in-page behaviour is manual until a harness exists.
