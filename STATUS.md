# STATUS

**2026-06-15 — scaffolded.** Repo structure + conventions + script template in
place. No real userscripts yet.

## Now
- Empty `scripts/`, `drafts/`, `samples/`, `memory/` (each with a README).
- [`scripts/TEMPLATE.user.js`](scripts/TEMPLATE.user.js) is the starting point
  for new scripts.

## Next (when a real script arrives)
1. Drop the first script into `drafts/`, iterate, promote to `scripts/` with a
   full metadata header + semver `@version`.
2. Decide the hosting URL shape (raw.githubusercontent vs GH Pages vs proxy) —
   this fixes `@updateURL`/`@downloadURL` and unblocks auto-update + pinning.
3. Add `scripts/manifest.json` (name/version/sha256/match) once there are ≥2
   scripts — the spine for update-reporting and the version manager.

## Open questions
- Public vs private long-term? Private now; userscripts are often shared, so
  re-evaluate at the hosting decision (raw URLs from a private repo need a token
  or proxy; a public repo serves directly).
- Manager surface: CLI, meta-userscript, or both?
