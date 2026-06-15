# tampermonkey/ — script loader

Install `loader.user.js` once (click it on the jsDelivr/raw URL). It loads other
userscripts from GitHub: a curated `registry.json` (auto-loaded per-domain) plus a
freeform field (URL or pasted snippet). Integrity via SRI tokens.

- **Install:** open `https://cdn.jsdelivr.net/gh/mcint/userscripts@main/tampermonkey/loader.user.js`
- **Dock:** a ⚙ orb lower-right; hover to expand. Each script row shows a status
  dot (`○` inactive / `●` active, red=error, yellow=warning) and `[tab] [session] [site]`
  activation (session disabled for now). `window.usLoader` is available from
  `document-start` (`activate(id,{scope})`, `deactivate`, `status`, `list`).
- **Use:** Tampermonkey menu → `usLoader: open dock` (focus dock), `usLoader: list in console`
  (show registry), `usLoader: hash input` (SRI helper).
  All commands also available via `usLoader.*` in devtools console.
- **Config:** edit the `const` block at the top of `loader.user.js`
  (`REQUIRE_SRI`, `DEFAULT_OWNER`, `REGISTRY_URL`, `REGISTRY_TTL_MS`).
- **Add a script:** add an entry to `registry.json` (see the design spec for the
  schema); use `usLoader: hash input` (menu) or `usLoader.hashIt(url)` (console)
  to generate the `integrity` value.
- **Tests:** `cd tampermonkey && node --test`
- **Phases & prior art:** see `refs/`.

Design: `../docs/superpowers/specs/2026-06-15-tampermonkey-script-loader-design.md`

## Distribution build

`build.sh` writes `registry.embedded.js`. To ship a self-contained loader that
works with zero network on a cold page, concatenate it ahead of the loader:

    cat tampermonkey/registry.embedded.js tampermonkey/loader.user.js > dist/loader.user.js

The loader detects `EMBEDDED_REGISTRY_JSON` and uses it as the fallback when the
live `registry.json` fetch fails or before the first refresh.
