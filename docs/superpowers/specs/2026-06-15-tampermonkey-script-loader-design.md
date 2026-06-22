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

**Invocation model (layered, lazy):**
- **`document-start` (cheap, low-priority, interruptable):** hydrate the public
  object `window.usLoader` (`activate(id,{scope})`, `deactivate(id)`, `status(id)`,
  `list()`). Early presence is reassuring and **detectable** by page scripts that
  auto-characterize userscripts. `id` = the registry slug; `list()` returns entries
  from whichever registry is live (embedded or online) → discover then `activate`.
  Heavy work stays **deferred** — nothing costly runs until used.
- **Auto-load:** scripts marked active for this origin (per §5 activation levers)
  and matching the URL load at their `runAt`.
- **`document-idle`:** render the **dock** (§2.1, lazy) and register the
  `GM_registerMenuCommand` entries (console-first surface: load-prompt, list,
  hash-input).

### 2.1 Dock (on-page control UI)

A floating dock, collapsed by default:
- **Collapsed:** a tiny circle with a "userscripts" glyph, **lower-right** (v0;
  upper-right + configurable position later).
- **Hover → expand:** shows the script list with a **× close**; each row is
  `[status glyph] name [tab] [session] [site]`.
  - **Status glyph** (§5): `○` inactive · `●` active/loaded · red = error ·
    yellow = warning (loaded-with-caveats / stale / integrity-skipped).
  - **`[tab] [session] [site]`** = the three activation levers (§5).
- v0 renders buttons/raw rows; **later:** link tooltips, then a dropdown-rect for
  managing multiple userscript "extensions."

**Config statics** (top-of-file constants, edited in-place):
- `const REQUIRE_SRI = false;` — when `true`, the loader refuses to run anything
  without a verified integrity hash (the global counterpart to the per-entry
  checkbox in §4).
- `const DEFAULT_OWNER = 'mcint';` — also overridable at runtime (GM storage / UI)
  so a fork can prefer its own owner without editing source.
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
`@<ref>` defaults to `main` (floats); pin a commit SHA for immutability. Besides
`@main` and SHAs, the **date-tag convention** `@YYYY-MM[.vv]` / `@YYYY-MM-DD[.vv]`
(git tags) gives human, sortable update points for consumers (`vv` = same-day
minor). Any tag string is a valid `ref` — jsDelivr resolves it; no loader change.
Caveat: git tags are mutable/floating and can't be validated cheaply in-flight —
integrity for a pinned tag still comes from the SRI token, not the tag itself.

## 4. Load + execute

1. **Source** — either a registry entry, a freeform **URL**, or a freeform
   **pasted snippet**. The **SRI token** (`sha256|sha384|sha512-<base64>`) is the
   single canonical integrity format — carried through unchanged from the registry
   `integrity` field, to the URL fragment (`…popups.js#sha384-<base64>`), to a
   `<script integrity>` attribute. Pip-style `#sha256=<hex>` is tolerated on input
   only (normalised to a token); nothing emits it.
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

## 5. Persistence

**Two stores, on purpose:**
- **GM storage** (`GM_setValue`) — the loader's own internal/tamper-sensitive
  state: `freeformRecents`, `registryCache` (`{fetchedAt, etag, entries}`,
  refreshed past `REGISTRY_TTL_MS`), and global prefs. Isolated from the page.
- **`localStorage`** (per-origin, page-visible) — mirrors the per-script
  **activation signal** so sites that auto-characterize scripts can detect it.

### Activation levers (per script, per origin)

Three scopes, surfaced as `[tab] [session] [site]`; a script is **active** if any
lever is on (additive; deactivate per scope). Effective state derived from:

| Lever | Scope | Mechanism |
|---|---|---|
| **tab** | this browsing context; survives reload, dies on tab close | `sessionStorage` |
| **session** | shared across all this origin's open tabs, ephemeral | **synthetic — OPEN** |
| **site** | per-origin, enduring across tabs + restarts | `localStorage` |

The **session** lever has no native primitive (`sessionStorage` is per-tab,
`localStorage` is enduring); it needs a chosen mechanism (localStorage tagged with
a session epoch + `storage`-event sync, or `BroadcastChannel`) and a definition of
"what ends a session." **v0 ships `tab` + `site`; `[session]` renders
disabled/"soon"** until that's decided (see decision log D6).

**Status** per script ∈ `{inactive, active, error, warning}` → the §2.1 glyph.

**Future (noted, not v0):** storage-size limits — cap `freeformRecents`/cached
blob sizes and surface usage, since GM storage has quotas.

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

Interactive surface is built **console-first**, simplest → richest:
1. **in-script config** (the `const` block) + **per-domain auto-load**,
2. a **console API** (`usLoader.load(input, opts)`, `.loadEntry(id)`, `.list()`,
   `.hashIt()`) callable from devtools, with args, plus prompt-based GM menu items,
3. *later* an **on-page panel** (overlays / notifications / buttons) — the
   styled interactive REPL.

**v0 (minimal core):** loader.user.js with self-hosting header; `registry.json`;
GM_xhr fetch + execute; SRI-ready integrity (token format, helper, `REQUIRE_SRI`
static + per-load flag); per-domain auto-load; freeform URL **and** snippet via the
**console API + prompt menu**; persistence; `refs/` docs.

**v0 — shipped** (PR #1 + nav-popups MediaWiki match): the above + console API.

**v0.9 (shipped):** `build.sh`, embedded registry, static install index,
generated `*.meta.js`.

**v1.0 — dock prototype (this increment):** the on-page **dock** (§2.1) —
collapsed lower-right icon → hover-expand list; one `nav-popups` row with the
**status glyph** + `[tab] [session] [site]` levers; public object hydrated at
`document-start` (§2). Ships **`tab` + `site` activation**; **`[session]` renders
disabled/"soon"** pending its mechanism (§5 / decision D6). Deferred within the
dock: link-tooltips, dropdown-rect for multiple us-exts, upper-right reposition.

**Roadmap (post-v0.9):**
- **`registry.meta.json`** — registry-level metadata carrying a **signing public
  key**; cheaper than a per-script merkle tree, embeddable as one reference.
- **Signed `*.meta.js` as gossip-able update units** — each `*.meta.js` doubles as
  the version/update report; sign it (age / gpg) so a relayed/"gossiped" update
  notice is verifiable against the registry pubkey. Needs dev signing keys
  (generate; cache/store the *public* half in-source, never the private).
- **Content detection** to refine matching — beyond `match` globs, detect a wiki/app
  at runtime (e.g. MediaWiki via `mw`/`mw.config`, `<meta name="generator">`,
  `/w/api.php`) so an entry auto-loads on *any* MediaWiki without enumerating
  domains, and the coarse `*/wiki/*` catch-all stops false-positiving on non-MW
  sites that happen to use a `/wiki/` path. Schema would gain an optional `detect`
  hook; matching becomes "glob match AND (no detector OR detector passes)".
- SRI *enforcement by default*; GitHub-API auto-discovery; the cross-repo
  "suggest diff-bump" tooling (mw roadmap); storage-size limiting (§5).

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
