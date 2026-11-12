import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRegionLocation, summarizeLandCover } from '../src/geography-context.js';
import { selectedIndices, areaSeries } from '../src/area-selection.js';
import { geographicBrushBounds } from '../src/geo.js';
import { readFileSync } from 'node:fs';
test('geographic labels distinguish ocean, coast, borders, dominance and missing metadata', () => {
  const bounds = [0, 5, 0, 5];
  assert.equal(
    formatRegionLocation({ land_fraction: 0, countries: [] }, bounds),
    'Open ocean region',
  );
  assert.equal(
    formatRegionLocation({ land_fraction: 0.5, countries: [] }, bounds),
    'Coastal region',
  );
  assert.equal(
    formatRegionLocation(
      {
        land_fraction: 1,
        countries: [
          { name: 'A', fraction: 0.5 },
          { name: 'B', fraction: 0.5 },
        ],
      },
      bounds,
    ),
    'A / B',
  );
  assert.equal(
    formatRegionLocation(
      { land_fraction: 1, countries: [{ name: 'A', fraction: 0.9 }] },
      bounds,
    ),
    'A',
  );
  assert.ok(formatRegionLocation(null, bounds).includes('0°'));
  assert.equal(summarizeLandCover(undefined), 'Land coverage unavailable');
});
test('brush coordinates invert zoom then latitude; area histories use block areas', () => {
  const invert = ([x, y]) => [(x - 100) / 2 - 180, 90 - (y - 50) / 2];
  assert.deepEqual(
    geographicBrushBounds(
      [
        [100, 50],
        [120, 70],
      ],
      invert,
    ),
    { lonMin: -180, lonMax: -170, latMin: 80, latMax: 90 },
  );
  assert.equal(
    geographicBrushBounds(
      [
        [101, 51],
        [102, 52],
      ],
      invert,
    ),
    null,
  );
  const regions = [{ bounds: [0, 5, 0, 5] }, { bounds: [0, 5, 80, 85] }];
  assert.deepEqual(
    selectedIndices(regions, { lonMin: 0, lonMax: 5, latMin: 0, latMax: 5 }),
    [0],
  );
  const values = areaSeries(
    { years: [1950], anomalies: { DJF: [[0], [10]] } },
    regions,
    [0, 1],
    'DJF',
  );
  assert.ok(values[0] > 0 && values[0] < 2);
});
test('all exported metadata IDs and fractions are valid', () => {
  const geo = JSON.parse(readFileSync('data/region_geography.json'));
  const regions = JSON.parse(readFileSync('data/regions.json')).regions;
  assert.equal(Object.keys(geo.regions).length, 2592);
  for (const region of regions) {
    const g = geo.regions[region.id];
    assert.deepEqual(g.bounds, region.bounds);
    assert.ok(g.land_fraction >= 0 && g.land_fraction <= 1);
    for (const share of [...g.countries, ...g.admin1])
      assert.ok(share.fraction >= 0 && share.fraction <= 1);
  }
  assert.ok(
    Object.values(geo.regions).some(
      (g) => g.land_fraction === 0 && g.countries.length === 0,
    ),
  );
  assert.ok(
    Object.values(geo.regions).some(
      (g) => g.land_fraction > 0.99 && g.countries.some((c) => c.name === 'Canada'),
    ),
  );
  assert.ok(
    Object.values(geo.regions).some(
      (g) => g.countries.filter((c) => c.fraction > 0.1).length >= 2,
    ),
  );
});

test('zoom-in centers the brushed geographic bounds and clamps scale', async () => {
  const { zoomTarget } = await import('../src/area-selection.js');
  const bounds = { lonMin: 10, lonMax: 20, latMin: 30, latMax: 40 };
  const project = ([lon, lat]) => [lon * 2, lat * 3];
  const target = zoomTarget(bounds, project, 3);
  const point = project([15, 35]);
  assert.equal(target.x + target.k * point[0], 480);
  assert.equal(target.y + target.k * point[1], 244);
  assert.equal(zoomTarget(bounds, project, 30).k, 12);
});

test('moving an area preserves dimensions, snaps to grid and stays within world bounds', async () => {
  const { moveAreaBounds } = await import('../src/area-selection.js');
  const bounds = { lonMin: 0, lonMax: 20, latMin: 0, latMax: 10 };
  assert.deepEqual(moveAreaBounds(bounds, 12, 27), {
    lonMin: 10,
    lonMax: 30,
    latMin: 15,
    latMax: 25,
  });
  assert.deepEqual(moveAreaBounds(bounds, 179, 95), {
    lonMin: 160,
    lonMax: 180,
    latMin: 80,
    latMax: 90,
  });
});
