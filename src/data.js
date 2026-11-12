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
