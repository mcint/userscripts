# Decision log — userscripts loader

Append-only record of design decisions: *what* was decided, *why*, *what we
weighed*, and current standing. **Distinct from the spec** — the spec
(`docs/superpowers/specs/…-design.md`) reflects the *current intended status*;
this log keeps the reasoning and the roads not taken, dated, so a later reader
(or future session) doesn't re-litigate settled calls or lose the rationale.

Repo/global *git-workflow* decisions (branch-first, linear-history, tagging) live
in `ClaudeCollab/git-coord/` + auto-memory, not here. This log is loader-scoped.

Status values: **accepted** · **superseded** · **open** (decided in principle,
detail unresolved).

---

## 2026-06-15

### D1 — Console-first surface; on-page dock is a later phase
**Accepted (panel now being designed — see D6–D8).** v0's interactive surface is
the `usLoader.*` console API + prompt-based GM menu. The styled on-page dock was
deferred to prove the load/inclusion mechanics before paying UI cost.
**Weighed:** panel-first (rejected — surface before mechanics).

### D2 — SRI token is the canonical integrity format
**Accepted.** `sha256|sha384|sha512-<base64>` carried unchanged: registry
`integrity` field → URL fragment (`#sha384-…`) → `<script integrity>`. Pip-style
`#sha256=<hex>` tolerated on input only.
**Weighed:** pip-style fragment, RFC 6920 `ni:`, multihash/IPFS CID — rejected as
the *stored/emitted* form for being non-web-native (SRI token round-trips to the
platform). Simplicity + carry-through won.

### D3 — Single-file loader + guarded CommonJS export tail (buildless v0)
**Accepted.** Pure helpers + `module.exports` tail so Node `--test` can `require()`
it while the browser runs `main()`. No build step for v0.
**Weighed:** split `lib/` modules + concatenating build (more structure than v0
needs); ES modules (userscript managers don't import cleanly).

### D4 — Embedded registry first, TTL'd live refresh
**Accepted.** Loader uses the baked-in registry for zero-network cold starts and
self-contained distribution; refreshes from `registry.json@main` on a TTL, cached.
**Weighed:** live-fetch-always (network on every page; CDN-cache lag); embedded-only
(no updates without reinstall).

### D5 — MediaWiki targeting: domain list + `/wiki/*` now, content-detection later
**Accepted (coarse) / detection open.** nav-popups matches the Wikimedia family by
domain (covers non-`/wiki/` paths) + `*://*/wiki/*` catch-all. Runtime content
detection (`mw.config` / `<meta generator>` / `/w/api.php`) is the planned
refinement to drop the domain list and stop false-positiving on non-MW `/wiki/`.

### D6 — Activation persistence: three levers (tab / session / site)
**Accepted in principle; "session" mechanism open.** Per-script activation has
three scopes, surfaced as `[tab] [session] [site]` buttons:

| Lever | Scope | Native primitive |
|---|---|---|
| **tab** | this browsing context; survives reload, dies on tab close | `sessionStorage` |
| **session** | shared across all this origin's open tabs, but ephemeral | **none — synthetic** |
| **site** | per-origin, enduring across tabs + restarts | `localStorage` |

The **activation *signal*** is mirrored to **`localStorage`** (per-origin, and
deliberately *page-visible* so sites that auto-characterize scripts can detect it);
the loader's **internal/tamper-sensitive state stays in GM storage**.
**OPEN:** the **session** lever has no native primitive — `sessionStorage` is
per-tab (not shared), `localStorage` is shared but enduring. Needs a chosen
mechanism (localStorage tagged with a session epoch + `storage`-event sync across
tabs, or a `BroadcastChannel` bus) **and a definition of what ends a "session"**
(a page can't observe browser close — approximate via a per-launch sentinel,
heartbeat/TTL, or last-tab-closed detection). Decide before implementing lever #2.
**Weighed:** GM-only storage (isolated, not page-detectable — loses the
auto-characterization affordance); localStorage-only for all three (can't express
tab/session ephemerality).

### D7 — Public object hydrated early; id = registry slug; discoverable via list()
**Accepted.** Expose `window.usLoader` **at `document-start`** (cheap, reassuring,
and detectable by page scripts), with heavy work **lazy/deferred** — don't pay
costs until use. API: `activate(id, {scope})`, `deactivate(id)`, `status(id)`,
`list()`. **`id` = the registry slug** (`entry.id`, e.g. `nav-popups`). `list()`
returns entries from whichever registry is live (**embedded or online**), so the
object is self-describing — discover ids offline or online, then `activate(id)` to
bootstrap into API use.
**Weighed:** hydrate at idle only (loses early detectability); opaque numeric ids
(slug is human + matches the registry).

### D8 — Per-script status glyph
**Accepted.** A small circle precedes each script row: `○` empty = inactive ·
`●` full = loaded/active · red = error (load/exec failed) · yellow = warning
(loaded with caveats / stale / integrity-skipped).

### D9 — Dock: collapsed icon → hover-expand (lower-right v0)
**Accepted (v0 slice).** Floating dock starts as a tiny circle with a
"userscripts" glyph at **lower-right**; mouseover expands to the script list with a
close button. **v0:** buttons/raw links + the three levers + status glyph for one
script (nav-popups), wired to the existing loader.
**Deferred:** link-tooltips, dropdown-rect for multiple "us-ext"s, upper-right
reposition (config).
