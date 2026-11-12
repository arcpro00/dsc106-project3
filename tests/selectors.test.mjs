import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDifferences, selectPopulation, presetRegions, globalStanding, reconcileHistogramRange} from '../src/selectors.js';
import {GLOBAL_BOUNDS, geographicBrushBounds, regionIdAt} from '../src/geo.js';
const state = {seasonA: 'DJF', seasonB: 'JJA', preset: 'all', bounds: GLOBAL_BOUNDS, search: '', threshold: 0, histogramRange: null, rankDirection: 'descending'};
const fixtures = [-8, -5, -2, -1, 0, 0, 1, 2, 5, 8, null].map((value, index) => ({id: `r0_c${String(index).padStart(2, '0')}`, bounds: [-180+index*5, -175+index*5, -90, -85], rates: {DJF: value, JJA: 0, MAM: 0, SON: 0}}));
const ids = rows => rows.map(row => row.id);

test('presets use the correct pre-preset denominators and retain signs', () => {
  const all = selectPopulation(fixtures, state);
  assert.equal(all.eligible.length, 10); assert.equal(all.excluded, 1);
  assert.deepEqual(ids(selectPopulation(fixtures, {...state, preset: 'topPositive'}).matching), ['r0_c09']);
  assert.deepEqual(ids(selectPopulation(fixtures, {...state, preset: 'topNegative'}).matching), ['r0_c00']);
  assert.deepEqual(ids(selectPopulation(fixtures, {...state, preset: 'largestAbs'}).matching), ['r0_c00']);
  assert.deepEqual(ids(selectPopulation(fixtures, {...state, preset: 'nearZero'}).matching), ['r0_c04']);
  const positiveOnly = all.eligible.filter(row => row.difference > 0);
  assert.equal(presetRegions(positiveOnly, 'topNegative').length, 0);
  assert.equal(presetRegions([], 'nearZero').length, 0);
  assert.equal(presetRegions(positiveOnly.slice(0, 1), 'largestAbs').length, 1);
  const larger = Array.from({length: 25}, (_, index) => ({id: `p${index}`, difference: index+1}));
  assert.equal(presetRegions(larger, 'topPositive').length, 3);
});

test('preset, histogram, threshold, bounds, and search intersect consistently', () => {
  const filtered = selectPopulation(fixtures, {...state, preset: 'topPositive', histogramRange: [-2, 2]});
  assert.equal(filtered.matching.length, 0); assert.equal(filtered.eligible.length, 10);
  assert.deepEqual(filtered.eligible, selectPopulation(fixtures, state).eligible);
  const both = selectPopulation(fixtures, {...state, histogramRange: [-2, 2]});
  assert.ok(both.matching.some(row => row.difference < 0)); assert.ok(both.matching.some(row => row.difference > 0));
  const positive = selectPopulation(fixtures, {...state, histogramRange: [.1, 2]});
  assert.deepEqual(positive.matching.map(row => row.difference), [2, 1]);
  assert.deepEqual([...positive.matchingRegionIds], ids(positive.matching));
  const bounds = {lonMin: -180, lonMax: -170, latMin: -90, latMax: -85};
  assert.equal(selectPopulation(fixtures, {...state, bounds}).eligible.length, 2);
  assert.equal(selectPopulation(fixtures, {...state, search: 'r0_c09'}).eligible.length, 1);
  assert.equal(selectPopulation(fixtures, {...state, bounds, search: 'r0_c09'}).matching.length, 0);
  const noRange = selectPopulation(fixtures, {...state, preset: 'topPositive'});
  assert.equal(noRange.matching.length, 1);
});

test('swapping seasons reverses signs and global ranks remain independent of filters', () => {
  const global = deriveDifferences(fixtures, 'DJF', 'JJA');
  const reversed = new Map(deriveDifferences(fixtures, 'JJA', 'DJF').map(row => [row.id, row.difference]));
  assert.ok(global.every(row => reversed.get(row.id) === -row.difference));
  assert.deepEqual(globalStanding(global, 'r0_c09'), {rank: 1, total: 10, percentile: 100});
  assert.deepEqual(globalStanding(global, 'r0_c00'), {rank: 10, total: 10, percentile: 0});
  const filtered = selectPopulation(fixtures, {...state, preset: 'topNegative'});
  assert.deepEqual(globalStanding(filtered.global, 'r0_c09'), globalStanding(global, 'r0_c09'));
  assert.ok(global.findIndex(row => row.id === 'r0_c04') < global.findIndex(row => row.id === 'r0_c05'));
  assert.equal(globalStanding(global, 'missing'), null);
  assert.strictEqual(deriveDifferences(fixtures, 'DJF', 'JJA'), global);
});

test('geographic brush uses inverted latitude and inward 5-degree snapping at seams', () => {
  // A rectangular equirectangular view with one pixel per degree.
  const invert = ([x, y]) => [x-180, 90-y];
  assert.deepEqual(geographicBrushBounds([[0, 0], [360, 180]], invert), GLOBAL_BOUNDS);
  assert.deepEqual(geographicBrushBounds([[1, 1], [11, 11]], invert), {lonMin: -175, lonMax: -170, latMin: 80, latMax: 85});
  assert.deepEqual(geographicBrushBounds([[350, 170], [360, 180]], invert), {lonMin: 170, lonMax: 180, latMin: -90, latMax: -80});
  assert.equal(geographicBrushBounds(null, invert), null);
  assert.equal(regionIdAt(-180, -90), 'r0_c0');
  assert.equal(regionIdAt(180, 90), 'r35_c71');
  assert.equal(regionIdAt(-175, -85), 'r1_c1');
  assert.equal(regionIdAt(181, 0), null);
});


test('eligible-population changes preserve, clamp, or clear histogram ranges', () => {
  const eligible = [{difference: -2}, {difference: 3}];
  assert.deepEqual(reconcileHistogramRange([-1, 1], eligible), [-1, 1]);
  assert.deepEqual(reconcileHistogramRange([-5, 1], eligible), [-3, 1]);
  assert.equal(reconcileHistogramRange([4, 5], eligible), null);
  assert.equal(reconcileHistogramRange([-1, 1], []), null);
});
