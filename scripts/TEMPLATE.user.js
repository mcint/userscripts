// ==UserScript==
// @name         TEMPLATE — rename me
// @namespace    https://github.com/mcint/userscripts
// @version      0.1.0
// @description  One-line, present-tense description of what this script does.
// @author       mcint
// @match        https://example.org/*
// @grant        none
// @run-at       document-idle
// ----------------------------------------------------------------------------
// Auto-update (uncomment + point at the hosted raw URLs once hosting is chosen).
// .meta.js is a metadata-only copy so Tampermonkey can cheaply check @version.
// @updateURL    https://raw.githubusercontent.com/mcint/userscripts/main/scripts/TEMPLATE.meta.js
// @downloadURL  https://raw.githubusercontent.com/mcint/userscripts/main/scripts/TEMPLATE.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Keep one concern per script. Guard against double-injection if needed.
  // Document any localStorage / cookie / GM_setValue keys you touch in memory/.

  console.debug('[TEMPLATE] loaded on', location.href);
})();
