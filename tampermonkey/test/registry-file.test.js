const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../loader.user.js');

test('shipped registry.json is valid and every entry validates', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'registry.json'), 'utf8');
  const entries = L.parseRegistry(text);
  assert.ok(entries.length >= 1);
  for (const e of entries) {
    const r = L.validateEntry(e);
    assert.ok(r.ok, `entry ${e.id} invalid: ${r.errors.join(', ')}`);
  }
});
