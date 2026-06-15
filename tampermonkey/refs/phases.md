# Userscript phases & lifecycle

`@run-at` controls when a userscript runs:

| value | when |
|---|---|
| `document-start` | before any DOM is built; earliest hook (block/patch globals) |
| `document-body`  | as soon as `<body>` exists |
| `document-end`   | at DOMContentLoaded (DOM ready, subresources maybe not) |
| `document-idle`  | after load; default; safest for DOM reads (loader uses this) |
| `context-menu`   | only when invoked from the page context menu (where supported) |

Injection context: managers run scripts in an isolated sandbox; reaching page
globals needs `unsafeWindow` or a `<script>` element (what `executeText` does).

## Docs
- Tampermonkey: https://www.tampermonkey.net/documentation.php
- Violentmonkey: https://violentmonkey.github.io/api/metadata-block/
- Greasemonkey: https://wiki.greasespot.net/Metadata_Block
- MDN userscripts/extensions: https://developer.mozilla.org/
- web.dev (SRI, CSP): https://web.dev/articles/subresource-integrity
