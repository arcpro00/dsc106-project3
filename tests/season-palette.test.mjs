import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { seasonDifferenceScale } from '../src/seasons.js';
const context = { exports: {}, module: {} };
vm.createContext(context);
vm.runInContext(readFileSync('vendor/d3.v7.min.js', 'utf8'), context);
const d3 = context.exports;
const colors = ['#467FA8', '#4D9876', '#D5A13F', '#C56F55'];
test('all six pairs preserve exact season endpoints, neutral zero, and swap symmetry', () => {
  for (let a = 0; a < 4; a++)
    for (let b = a + 1; b < 4; b++) {
      const scale = seasonDifferenceScale(d3, colors[a], colors[b], [-2, 2]);
      const reverse = seasonDifferenceScale(d3, colors[b], colors[a], [-2, 2]);
      assert.equal(scale(-2), d3.color(colors[b]).formatRgb());
      assert.equal(scale(0), d3.color('#F5F3EF').formatRgb());
      assert.equal(scale(2), d3.color(colors[a]).formatRgb());
      for (const value of [-2, -1, 0, 1, 2]) assert.equal(scale(value), reverse(-value));
    }
});
test('CSS palette matches specified season colors', () => {
  const css = readFileSync('style.css', 'utf8');
  ['djf', 'mam', 'jja', 'son'].forEach((key, i) =>
    assert.ok(css.toLowerCase().includes(`--season-${key}: ${colors[i].toLowerCase()}`)),
  );
});
