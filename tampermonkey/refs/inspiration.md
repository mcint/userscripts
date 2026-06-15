# Inspiration (prior art we draw FROM)

Kept separate from any future COMPARISON doc (methods convention).

- jsDelivr `gh` passthrough — CDN delivery of repo files with JS content-type:
  https://www.jsdelivr.com/documentation#id-github
- W3C Subresource Integrity — the `sha384-<base64>` token format:
  https://www.w3.org/TR/SRI/
- RFC 6920 `ni:` Named Information URIs; multihash/IPFS CIDs — hash-as-identifier.
- PEP 723 inline script metadata (`# /// script`) — header-config inspiration.
- Tampermonkey `@require`/`@resource` + `@downloadURL`/`@updateURL` — self-hosting
  update model this loader mirrors.
