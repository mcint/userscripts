const test = require('node:test');
const assert = require('node:assert');
const L = require('../loader.user.js');

test('deriveStatus precedence: error > warning > active > inactive', () => {
  assert.strictEqual(L.deriveStatus({ loaded: true, error: true }), 'error');
  assert.strictEqual(L.deriveStatus({ loaded: true, warning: true }), 'warning');
  assert.strictEqual(L.deriveStatus({ loaded: true }), 'active');
  assert.strictEqual(L.deriveStatus({ loaded: false }), 'inactive');
});

test('statusGlyph maps each status to a symbol + class', () => {
  assert.deepStrictEqual(L.statusGlyph('inactive'), { symbol: '○', cls: 'us-st-inactive' }); // ○
  assert.deepStrictEqual(L.statusGlyph('active'), { symbol: '●', cls: 'us-st-active' });     // ●
  assert.deepStrictEqual(L.statusGlyph('error'), { symbol: '●', cls: 'us-st-error' });
  assert.deepStrictEqual(L.statusGlyph('warning'), { symbol: '●', cls: 'us-st-warning' });
});
