import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadRegionTimeSeries, loadComparisonGrid} from '../src/data.js';

test('time series are lazy, cached by band/season, and fetched using module-relative URLs', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    return {ok: true, json: async () => JSON.parse(await readFile(url, 'utf8'))};
  };
  try {
    assert.equal(requests.length, 0);
    const [a, b] = await Promise.all([loadRegionTimeSeries('r17_c24', 'DJF'), loadRegionTimeSeries('r17_c25', 'DJF')]);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].pathname.endsWith('/data/timeseries/DJF_band_17.json'));
    assert.equal(a.years.length, 65); assert.equal(b.values.length, 65);
    await loadRegionTimeSeries('r17_c24', 'JJA');
    assert.equal(requests.length, 2);
    await loadRegionTimeSeries('r17_c24', 'DJF');
    assert.equal(requests.length, 2);
    await assert.rejects(loadRegionTimeSeries('r36_c0', 'DJF'));
    assert.equal(requests.length, 2);
    const [grid, duplicate] = await Promise.all([loadComparisonGrid('DJF', 'JJA'), loadComparisonGrid('DJF', 'JJA')]);
    assert.strictEqual(grid, duplicate); assert.equal(requests.length, 4);
    assert.equal(grid.values.length, 51840);
    await loadComparisonGrid('DJF', 'JJA');
    assert.equal(requests.length, 4);
  } finally { globalThis.fetch = originalFetch; }
});
