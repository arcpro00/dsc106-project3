import {differenceGrid} from './comparison.js';
const root = new URL('../', import.meta.url);
const cache = new Map();
function fetchJSON(path) {
  if (!cache.has(path)) {
    const request = fetch(new URL(path, root)).then(response => {
      if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
      return response.json();
    }).catch(error => { cache.delete(path); throw error; });
    cache.set(path, request);
    // Bound memory while preserving concurrent request deduplication.
    if (cache.size > 16) cache.delete(cache.keys().next().value);
  }
  return cache.get(path);
}
export const loadMetadata = () => fetchJSON('data/metadata.json');
export const loadRegions = () => fetchJSON('data/regions.json').then(d => d.regions);
export const loadGeography = () => Promise.all(['land', 'coastlines'].map(name => fetchJSON(`geography/${name}.geojson`))).then(([land, coastlines]) => ({land, coastlines}));
export function loadGrid({variable, season, year}) {
  return fetchJSON(`data/${variable}/${season}${variable === 'warming_rate' ? '' : `/${year}`}.json`).then(grid => {
    if (grid.values.length !== 51840 || grid.variable !== variable || grid.season !== season || (variable !== 'warming_rate' && grid.year !== year)) throw new Error('Climate grid does not match the expected schema.');
    return grid;
  });
}

const comparisons = new Map();
export function loadComparisonGrid(seasonA, seasonB) {
  const key = `${seasonA}:${seasonB}`;
  if (!comparisons.has(key)) {
    const request = Promise.all([
      loadGrid({variable: 'warming_rate', season: seasonA}),
      loadGrid({variable: 'warming_rate', season: seasonB})
    ]).then(([a, b]) => differenceGrid(a, b)).catch(error => { comparisons.delete(key); throw error; });
    comparisons.set(key, request);
    if (comparisons.size > 6) comparisons.delete(comparisons.keys().next().value);
  }
  return comparisons.get(key);
}

export function loadRegionTimeSeries(id, season) {
  const match = /^r(\d+)_c(\d+)$/.exec(id);
  if (!match || Number(match[1]) > 35 || Number(match[2]) > 71) return Promise.reject(new Error('Invalid region ID.'));
  const band = Number(match[1]);
  return fetchJSON(`data/timeseries/${season}_band_${String(band).padStart(2, '0')}.json`).then(payload => {
    const values = payload.regions[id];
    if (payload.season !== season || payload.band !== band || payload.years.length !== 65 || !values || values.length !== 65) throw new Error('Invalid regional anomaly history.');
    return {season, years: payload.years, values};
  });
}

export const loadRegionalAnomalies = () => fetchJSON('data/regional_anomalies.json');
export const loadGlobalAnomalies = () => fetchJSON('data/global_anomalies.json');
