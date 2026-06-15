const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const L = require('../loader.user.js');

const bytes = new TextEncoder().encode('hello world');

test('computeSriToken matches node crypto base64 digest', async () => {
  const token = await L.computeSriToken(bytes, 'sha384');
  const expected = 'sha384-' + crypto.createHash('sha384').update(Buffer.from(bytes)).digest('base64');
  assert.strictEqual(token, expected);
});

test('verifyIntegrity true on match, false on mismatch', async () => {
  const good = await L.computeSriToken(bytes, 'sha256');
  assert.strictEqual(await L.verifyIntegrity(bytes, good), true);
  assert.strictEqual(await L.verifyIntegrity(bytes, 'sha256-bm90cmlnaHQ='), false);
});

test('verifyIntegrity supports pip-style hex token', async () => {
  const hex = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  assert.strictEqual(await L.verifyIntegrity(bytes, `sha256-${hex}-hex`), true);
});
