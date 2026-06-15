# mw/ — MediaWiki-sourced scripts

Userscripts and gadgets pulled from MediaWiki wikis, tracked with **[mwsync]**
(your fork) — git-like fetch/diff/push over wiki pages. This subtree stores the
**recipe** (which pages, which wiki), not a vendored copy of the upstream
content: `mwsync.yaml` is the registry, and you run `fetch` locally to pull the
bodies/history on demand.

This subtree exists because there will be more than one MW script; non-MW
userscripts live elsewhere in the repo (`scripts/`, `drafts/`).

[mwsync]: https://github.com/mcint/mwsync

## Tracked pages

| Page | Origin |
|---|---|
| [`MediaWiki:Gadget-popups.js`](https://en.wikipedia.org/wiki/MediaWiki:Gadget-popups.js) — Navigation popups ("Nav Popups") | en.wikipedia.org; descends from [`User:Lupin/popups.js`](https://en.wikipedia.org/wiki/User:Lupin/popups.js) |

To add another: `... add '<wiki page URL>'` (writes an entry to `mwsync.yaml`).

### `nav-popups/` layout

Each tracked page gets a dir holding two copies — the pristine upstream and the
one we maintain:

```
nav-popups/
  upstream/popups.js   # pristine upstream snapshot (mwsync `local`; revid in mwsync.yaml).
                       #   `mwsync merge` refreshes it in place. Don't hand-edit.
  popups.js            # LIVE: our maintained version — edit here, keep updating,
                       #   include elsewhere. Diff against upstream/ to see our deltas.
```

Local modifications in the live copy are marked with `// LOCAL MOD (mcint/userscripts)`
comments (each quoting the upstream original), so the delta vs `upstream/popups.js`
stays legible and re-appliable after an upstream refresh. Current live deltas:
- **Last-modified display** — absolute timestamp (local time, marked `(l)`; UTC in
  the hover tooltip) + a compact age like `2d` / `5h` / `3M` / `5y`, instead of
  upstream's relative "3 weeks 2 days old". (TODO: click `(l)` to toggle to UTC.)

## Tool & version

- **robla/mwsync** (fork: **mcint/mwsync**), **v1.0** — single-file Python CLI,
  only dependency is PyYAML. Pinned at fork commit `08dc3e7` (upstream `e5dfb37`).
- Run from this dir (mwsync uses a CWD-relative `mwsync.yaml` + `_cache/`):

  ```sh
  uv run --with pyyaml python ~/dev-llm/mwsync/mwsync.py <cmd> ...
  ```

## Fetch / inspect (read-only, anonymous — no auth)

```sh
fetch 'MediaWiki:Gadget-popups.js' --depth 50 --with-bodies  # pull last 50 revs + bodies
merge 'MediaWiki:Gadget-popups.js'                           # write working copy at upstream rev
log   'MediaWiki:Gadget-popups.js'                           # revision history
show  'MediaWiki:Gadget-popups.js@<revid>'                   # print a cached revision
diff  'MediaWiki:Gadget-popups.js@<a>' '...@<b>'             # compare two cached revs
```

`fetch` populates `_cache/<page>/` (`<revid>.mw` bodies, `<revid>.json` metadata,
`history.jsonl`) — the full multi-revision archive, **gitignored** because it's
reproducible from `mwsync.yaml`. `merge` writes mwsync's `local`, which we point
at `nav-popups/upstream/popups.js` — that single current snapshot **is tracked**.

## Auth (only for `push`, never for fetch)

`push` writes back to the wiki and needs a MediaWiki bot password
([Special:BotPasswords](https://en.wikipedia.org/wiki/Special:BotPasswords)),
supplied via environment:

```sh
export MWSYNC_MW_USER=<bot username>
export MWSYNC_MW_PASSWORD=<bot password>
push 'MediaWiki:Gadget-popups.js' -m "edit summary"
```

> `mwsync.yaml` carries the same configure/fetch/auth notes as comments, but
> mwsync rewrites that file on `add`/`merge`/`push` and drops them — this README
> is the durable copy.

## Provenance & licensing

Pages here are mirrored from English Wikipedia. The Navigation popups gadget
originates from `User:Lupin/popups.js` with many contributors — attribution is
the upstream
[page history](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&action=history).
Wikipedia text/code contributions are licensed **CC BY-SA 4.0** (Attribution-
ShareAlike) and GFDL; embedded third-party components carry their own (e.g. one
under BSD). Mirrored for study/reuse, not an original work of this repo.

## Distribution & versioning (roadmap)

The plan for getting these (and other) scripts loaded into a browser or a wiki,
pinned and update-aware. Intent, not built — captured so the structure aims here.

1. **CDN delivery via jsDelivr.** Per [WP:User scripts] guidance, jsDelivr's
   GitHub passthrough serves repo files with the correct JS `Content-Type` for
   in-page `<script>` loading/execution:

   ```
   https://cdn.jsdelivr.net/gh/<user>/<repo>@<commit-ish>/<path>
   e.g. https://cdn.jsdelivr.net/gh/mcint/userscripts@<sha>/mw/nav-popups/popups.js
   ```

   `@<commit-ish>` (tag/branch/sha) is the pin — prefer a **commit SHA** for an
   immutable pin (a branch name floats).

2. **SRI layer.** Pair each CDN URL with a Subresource Integrity hash
   (`integrity="sha384-…" crossorigin`) so the browser refuses a script whose
   bytes don't match the pin — pinning that's *verified*, not just *named*.
   (Generalizes the repo README's "pinning by hash" roadmap item.)

3. **Canonical location / URN.** A stable identifier per script (magnet-link
   spirit: name + hash + where-to-check-for-newer), so a consumer can ask "is
   there a newer version?" without hardcoding a host.

4. **In-script metadata block → diff-update suggestions.** A conventional header
   block — like a Tampermonkey `==UserScript==` header, or a PEP 723
   `# /// script` (`uv run --script`) block — that declares `version`, `name`,
   `deps`, and tracked `upstream(s)`. Tooling parses it and **suggests the diff**
   to bump a pinned inclusion: a one-line edit to a wiki `User:<you>/common.js`
   (or `importScript`/`mw.loader.load` line), or the equivalent Tampermonkey
   `@version`/`@require` bump. Closes the loop between this repo and where the
   scripts are actually pinned.

[WP:User scripts]: https://en.wikipedia.org/wiki/Wikipedia:User_scripts
