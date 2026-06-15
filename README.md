# userscripts

> Browser **userscripts** — Tampermonkey/Violentmonkey-installable scripts that
> enhance sites I use online. Userscripts-first (MediaWiki + general web), with
> room to broaden into bookmarklets, console snippets, and per-site tooling.

Private collection. Authored/iterated with Claude; the layout is designed so
work-in-progress is cheap to start and promotion to a stable, installable
script is explicit.

## Layout

| Dir | Holds | Promotes to |
|---|---|---|
| [`drafts/`](drafts/) | WIP scripts being shaped — may be broken, half-ideas, spikes | `scripts/` once it works and has a proper metadata header |
| [`scripts/`](scripts/) | The real deal: installable `*.user.js` with full `==UserScript==` headers | — (this is the shippable layer) |
| [`samples/`](samples/) | Reference scripts (mine or others') kept to learn from — *not* meant to be installed as-is | — (study material) |
| [`memory/`](memory/) | Notes: per-site quirks, DOM selectors that break, API gotchas, decisions | — (knowledge, not code) |
| [`mw/`](mw/) | MediaWiki-sourced scripts/gadgets, tracked with [mwsync] so each page keeps its upstream revision history (e.g. Navigation popups) | — (mirror + history) |

[mwsync]: https://github.com/mcint/mwsync

A script lives in exactly one of `drafts/` or `scripts/`. The move between them
is the "is this real yet?" boundary — same spirit as the seedbed→transplant
lifecycle one level up.

## Conventions

- **Filenames:** `<site-or-purpose>.user.js` (e.g. `mediawiki-edit-shortcuts.user.js`).
  The `.user.js` suffix is what makes Tampermonkey offer to install on click.
- **Metadata header:** every script in `scripts/` carries a complete
  `==UserScript==` block — `@name`, `@namespace`, `@version` (semver),
  `@description`, `@match`/`@include`, `@grant`, and update URLs (see below).
  Start from [`scripts/TEMPLATE.user.js`](scripts/TEMPLATE.user.js).
- **Versioning:** bump `@version` on every behavioral change. The header version
  is the source of truth for update reporting.
- **One concern per script** (Unix-y). Compose, don't kitchen-sink.

## Roadmap — management & distribution

The collection is step one; the goal is a small **userscript manager** layer
around it. Tracked here so the structure anticipates it (specs land alongside
code when each is built):

- **Tampermonkey-ready hosting.** Serve raw `scripts/*.user.js` over a stable
  URL (raw.githubusercontent / GH Pages / a tiny proxy) so install + auto-update
  work. Each script's `@updateURL` (metadata-only `.meta.js`) and `@downloadURL`
  point back here → Tampermonkey reports "update available" natively.
- **Pinning by hash.** Record a content hash (sha256) per published version in a
  lockfile/manifest so an install can be pinned to a known-good revision and
  drift is detectable — supply-chain hygiene for self-hosted scripts.
- **Update-available reporting.** A manifest (`scripts/manifest.json`?) listing
  name / version / hash / match-globs, so a glance — or a checker script — shows
  what's outdated across installs without opening Tampermonkey.
- **Version manager + enable toggler.** A control surface (CLI and/or a meta
  userscript) to list installed scripts, their versions vs. latest, and
  enable/disable individually — the "version manager and enable toggler" goal.
- **State opportunities.** Where scripts touch `localStorage` / cookies /
  `GM_setValue`, document the keys and surface them (inspect / export / reset).
  Cookies likely don't matter for most; `localStorage` + `GM_*` storage do.

> These are intent, not yet built. Each gets a spec alongside its first commit.

## Status

See [`STATUS.md`](STATUS.md) for current state and next steps.

## Provenance

Born as a standalone repo (not via the usual seedbed→transplant path) because
hosted-git is a day-one requirement here: Tampermonkey install/auto-update and
the claude.ai GitHub-connector loop both want a real remote. Sibling in spirit
to the `claude-ai-workspace` seed in the seedbed (a git-backed tree shared with
claude.ai).
