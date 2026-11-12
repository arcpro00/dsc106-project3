import {selectPopulation} from '../src/selectors.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLOBAL_BOUNDS, validateBounds, contained, displayCells} from '../src/geo.js';
const regions = JSON.parse(readFileSync(new URL('../data/regions.json', import.meta.url))).regions;
const rankedRegions = (regions, state) => { const p = selectPopulation(regions, state); return {rows: p.matching, excluded: p.excluded}; };
const state = {bounds: GLOBAL_BOUNDS, seasonA: 'DJF', seasonB: 'JJA', rankDirection: 'descending', threshold: 0, search: ''};
test('all regions rank once in signed order, including equal season comparison', () => {
  const {rows} = rankedRegions(regions, state);
  assert.equal(rows.length, 2592);
  assert.equal(new Set(rows.map(d => d.id)).size, 2592);
  assert.ok(rows.every((d, i) => !i || rows[i-1].difference >= d.difference));
  assert.ok(rows.some(d => d.difference > 0)); assert.ok(rows.some(d => d.difference < 0));
  const swapped = rankedRegions(regions, {...state, seasonA: state.seasonB, seasonB: state.seasonA}).rows;
  const swappedById = new Map(swapped.map(row => [row.id, row.difference]));
  assert.ok(rows.every(row => swappedById.get(row.id) === -row.difference));
  assert.ok(rankedRegions(regions, {...state, seasonB: 'DJF'}).rows.every(d => d.difference === 0));
  const ascending = rankedRegions(regions, {...state, rankDirection: 'ascending'}).rows;
  assert.ok(ascending.every((d, i) => !i || ascending[i-1].difference <= d.difference));
});
test('bounds are contained, aligned, validated, and reject crossing', () => {
  const bounds = {lonMin: -180, lonMax: -175, latMin: -90, latMax: -85};
  assert.equal(rankedRegions(regions, {...state, bounds}).rows.length, 1);
  assert.ok(contained(regions[0], bounds));
  assert.throws(() => validateBounds({...bounds, lonMin: 170, lonMax: -170}));
  assert.throws(() => validateBounds({...bounds, latMin: -89}));
  assert.throws(() => validateBounds({...bounds, latMin: NaN}));
});
test('null rates excluded, search and thresholds compose', () => {
  const missing = {...regions[0], rates: {DJF: null, JJA: 1}};
  assert.equal(rankedRegions([missing], state).excluded, 1);
  assert.equal(rankedRegions(regions, {...state, search: 'r0_c0'}).rows[0].id, 'r0_c0');
  assert.ok(rankedRegions(regions, {...state, threshold: .2}).rows.every(d => Math.abs(d.difference) >= .2));
});
test('map aggregation ignores missing cells, preserves area weights and extent', () => {
  const metadata = JSON.parse(readFileSync(new URL('../data/metadata.json', import.meta.url)));
  const grid = {values: Array(51840).fill(2)};
  grid.values[0] = null;
  const result = displayCells(grid, metadata, GLOBAL_BOUNDS);
  assert.equal(result.coarse, true); assert.equal(result.cells.length, 2592);
  assert.ok(result.cells.every(d => Math.abs(d.value-2)<1e-12));
  const bounds = {lonMin: -180, lonMax: -175, latMin: -90, latMax: -85};
  const native = displayCells(grid, metadata, bounds);
  assert.equal(native.cells.length, 20); assert.equal(native.cells[0].value, null);
});
