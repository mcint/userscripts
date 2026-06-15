const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('loader requires cleanly and exposes config', () => {
  assert.strictEqual(L.DEFAULT_OWNER, 'mcint');
  assert.strictEqual(typeof L.REQUIRE_SRI, 'boolean');
});
