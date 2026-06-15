const EMBEDDED_REGISTRY_JSON = [
  {
    "id": "nav-popups",
    "name": "Navigation popups (live)",
    "repo": "mcint/userscripts",
    "path": "mw/nav-popups/popups.js",
    "ref": "main",
    "match": [
      "*://*.wikipedia.org/*",
      "*://*.wiktionary.org/*",
      "*://*.wikimedia.org/*",
      "*://*.wikidata.org/*",
      "*://*.wikisource.org/*",
      "*://*.wikibooks.org/*",
      "*://*.wikiquote.org/*",
      "*://*.wikinews.org/*",
      "*://*.wikiversity.org/*",
      "*://*.wikivoyage.org/*",
      "*://*.mediawiki.org/*",
      "*://*/wiki/*"
    ],
    "runAt": "document-idle",
    "grant": [],
    "integrity": null,
    "desc": "Navigation popups (maintained fork) — MediaWiki hover previews. Matches Wikimedia family by domain + any */wiki/* path (coarse; content-detection planned)."
  }
];
