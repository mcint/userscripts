# mw/ — MediaWiki-sourced scripts

Userscripts and gadgets pulled from MediaWiki wikis, tracked with **[mwsync]**
(your fork) so each page keeps its upstream revision history locally — git-like
checkout/fetch/diff over wiki pages.

This subtree exists because there will be more than one MW script; non-MW
userscripts live elsewhere in the repo (`scripts/`, `drafts/`).

[mwsync]: https://github.com/mcint/mwsync

## What's tracked

| Page | Local | Revisions cached |
|---|---|---|
| [`MediaWiki:Gadget-popups.js`](https://en.wikipedia.org/wiki/MediaWiki:Gadget-popups.js) (Navigation popups / "Nav Popups") | `MediaWiki:Gadget-popups.js.mw` | last 50 (mwsync default depth), 2023-07-25 → 2025-11-18 |

`mwsync.yaml` is the registry; `_cache/<page>/` holds the upstream history:
- `<revid>.mw` — revision body (wikitext/JS)
- `<revid>.json` — revision metadata (user, timestamp, comment, sha1, size)
- `history.jsonl` — chronological manifest
- `refs/upstream`, `refs/base` — sync-state pointers

The top-level `<page>.mw` is the editable working copy (currently at the latest
upstream revision).

## Working with it

```sh
# from this dir (mwsync uses CWD-relative mwsync.yaml + _cache/)
uv run --with pyyaml python ~/dev-llm/mwsync/mwsync.py <cmd> ...

log    'MediaWiki:Gadget-popups.js'              # revision history
show   'MediaWiki:Gadget-popups.js@<revid>'      # print a cached revision
diff   'MediaWiki:Gadget-popups.js@<a>' '...@<b>'# compare two cached revs
fetch  'MediaWiki:Gadget-popups.js' --depth 50 --with-bodies   # refresh / deepen
merge  'MediaWiki:Gadget-popups.js'              # update working copy to upstream
```

To add another MW page: `... add '<wiki page URL>'` then `fetch`.

## Provenance & licensing

Mirrored from English Wikipedia. The Navigation popups gadget originates from
`User:Lupin/popups.js` and has many contributors — see the upstream
[page history](https://en.wikipedia.org/w/index.php?title=MediaWiki:Gadget-popups.js&action=history)
(also captured in `history.jsonl`). Wikipedia text/code contributions are
licensed **CC BY-SA 4.0** (and GFDL); attribution is the page history. This is a
mirror for study/reuse, not an original work of this repo.

## Caveat: colon in paths

mwsync names the cache after the page key, so paths contain a colon
(`MediaWiki:Gadget-popups.js`). Valid on macOS/Linux; **Windows checkouts of
this public repo will choke on the colon.** Flagged, not fixed — kept to stay
faithful to mwsync's native layout. Revisit if Windows support matters.
