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
