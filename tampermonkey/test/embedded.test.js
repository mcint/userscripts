const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('registry.embedded.js defines parseable EMBEDDED_REGISTRY_JSON', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'registry.embedded.js'), 'utf8');
  const json = src.replace(/^const EMBEDDED_REGISTRY_JSON = /, '').replace(/;\s*$/, '');
  const entries = JSON.parse(json);
  assert.ok(Array.isArray(entries) && entries.length >= 1);
});
