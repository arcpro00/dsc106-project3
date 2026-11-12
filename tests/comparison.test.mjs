import test from 'node:test';
import assert from 'node:assert/strict';
import {differenceGrid} from '../src/comparison.js';
import {seasonName} from '../src/seasons.js';

test('map comparison preserves sign, masks missing data, and has a symmetric global domain', () => {
  const a = {season: 'DJF', values: [.5, -.2, null, .1]};
  const b = {season: 'JJA', values: [.2, .4, .2, Infinity]};
  const grid = differenceGrid(a, b);
  assert.ok(Math.abs(grid.values[0] - .3) < 1e-12);
  assert.ok(Math.abs(grid.values[1] + .6) < 1e-12);
  assert.deepEqual(grid.values.slice(2), [null, null]);
  assert.equal(grid.domain[0], -grid.domain[1]);
  assert.ok(grid.domain[1] >= .6);
  const swapped = differenceGrid(b, a);
  assert.equal(swapped.values[0], -grid.values[0]);
  assert.equal(swapped.values[1], -grid.values[1]);
  assert.deepEqual(swapped.domain, grid.domain);
});

test('same-season comparison is zero with a valid zero-centered scale', () => {
  const a = {season: 'MAM', values: [.4, -.2, null]};
  const result = differenceGrid(a, a);
  assert.deepEqual(result.values, [0, 0, null]);
  assert.deepEqual(result.domain, [-.1, .1]);
  assert.throws(() => differenceGrid(a, {values: []}));
});

test('all source season codes have conventional display names', () => {
  assert.deepEqual(['MAM', 'JJA', 'SON', 'DJF'].map(seasonName), ['Spring', 'Summer', 'Fall', 'Winter']);
});

test('coarse map preserves signed area-weighted aggregation', async () => {
  const {displayCells, GLOBAL_BOUNDS} = await import('../src/geo.js');
  const metadata = {grid: {latCount: 5, lonCount: 4, latStart: -89.5}};
  const a = {season: 'DJF', values: Array.from({length: 20}, (_, i) => i % 2 ? 1 : -1)};
  const b = {season: 'JJA', values: Array(20).fill(0)};
  const grid = differenceGrid(a, b);
  assert.ok(grid.values.some(value => value === -1));
  assert.ok(grid.values.some(value => value === 1));
  const result = displayCells(grid, metadata, GLOBAL_BOUNDS);
  assert.equal(result.cells[0].value, 0);
});
