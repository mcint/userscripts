#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# 1. embedded registry: registry.embedded.js defines EMBEDDED_REGISTRY_JSON
printf 'const EMBEDDED_REGISTRY_JSON = %s;\n' "$(cat registry.json)" > registry.embedded.js

# 2. static install index
mkdir -p build
{
  echo '<!doctype html><meta charset=utf-8><title>userscripts</title><h1>userscripts</h1><ul>'
  node -e '
    const r = require("./registry.json");
    for (const e of r) {
      const url = `https://cdn.jsdelivr.net/gh/${e.repo}@${e.ref||"main"}/${e.path}`;
      console.log(`<li><a href="${url}">${e.name}</a> — <code>${e.repo}/${e.path}</code></li>`);
    }
  '
  echo '</ul>'
} > build/index.html

# 3. loader.meta.js (metadata block only, for @updateURL checks)
sed -n '/==UserScript==/,/==\/UserScript==/p' loader.user.js > build/loader.meta.js

echo "build complete: registry.embedded.js, build/index.html, build/loader.meta.js"
