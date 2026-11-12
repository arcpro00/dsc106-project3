import { contained, finite, regionLabel } from './geo.js';

const derivedCache = new WeakMap();
const eligibleCache = new WeakMap();
const byId = (a, b) => a.id.localeCompare(b.id);
export const signedDescending = (a, b) => b.difference - a.difference || byId(a, b);
export function deriveDifferences(regions, seasonA, seasonB) {
  let cache = derivedCache.get(regions);
  if (!cache) {
    cache = new Map();
    derivedCache.set(regions, cache);
  }
  const key = `${seasonA}:${seasonB}`;
  if (!cache.has(key))
    cache.set(
      key,
      regions
        .flatMap((region) => {
          const a = region.rates[seasonA],
            b = region.rates[seasonB];
          return finite(a) && finite(b) ? [{ ...region, difference: a - b }] : [];
        })
        .sort(signedDescending),
    );
  return cache.get(key);
}
export function getEligibleRegions(global, state) {
  const search = (state.search ?? '').trim().toLowerCase();
  let cache = eligibleCache.get(global);
  if (!cache) {
    cache = new Map();
    eligibleCache.set(global, cache);
  }
  const key = JSON.stringify([state.bounds, search]);
  if (cache.has(key)) return cache.get(key);
  const eligible = global.filter(
    (region) =>
      (!state.bounds || contained(region, state.bounds)) &&
      (!search || `${region.id} ${regionLabel(region)}`.toLowerCase().includes(search)),
  );
  cache.set(key, eligible);
  if (cache.size > 16) cache.delete(cache.keys().next().value);
  return eligible;
}
export function presetRegions(eligible, preset = 'all') {
  if (preset === 'all') return eligible;
  const candidates = eligible.filter((region) =>
    preset === 'topPositive'
      ? region.difference > 0
      : preset === 'topNegative'
        ? region.difference < 0
        : true,
  );
  const comparator =
    preset === 'topPositive'
      ? signedDescending
      : preset === 'topNegative'
        ? (a, b) => a.difference - b.difference || byId(a, b)
        : preset === 'largestAbs'
          ? (a, b) => Math.abs(b.difference) - Math.abs(a.difference) || byId(a, b)
          : (a, b) => Math.abs(a.difference) - Math.abs(b.difference) || byId(a, b);
  return [...candidates].sort(comparator).slice(0, Math.ceil(candidates.length * 0.1));
}
export function getFilteredRegions(eligible, state) {
  const range = state.histogramRange;
  return presetRegions(eligible, state.preset)
    .filter(
      (region) =>
        (!range || (region.difference >= range[0] && region.difference <= range[1])) &&
        Math.abs(region.difference) >= (state.threshold ?? 0),
    )
    .sort(
      state.rankDirection === 'ascending'
        ? (a, b) => a.difference - b.difference || byId(a, b)
        : signedDescending,
    );
}
export function selectPopulation(regions, state) {
  const global = deriveDifferences(regions, state.seasonA, state.seasonB);
  const eligible = getEligibleRegions(global, state);
  const matching = getFilteredRegions(eligible, state);
  const scoped = regions.filter(
    (region) =>
      (!state.bounds || contained(region, state.bounds)) &&
      (!(state.search ?? '').trim() ||
        `${region.id} ${regionLabel(region)}`
          .toLowerCase()
          .includes(state.search.trim().toLowerCase())),
  );
  return {
    global,
    eligible,
    matching,
    matchingRegionIds: new Set(matching.map((region) => region.id)),
    excluded: scoped.length - eligible.length,
  };
}
export function globalStanding(global, id) {
  const index = global.findIndex((region) => region.id === id);
  if (index < 0) return null;
  return {
    rank: index + 1,
    total: global.length,
    percentile:
      global.length === 1
        ? 100
        : (100 * (global.length - 1 - index)) / (global.length - 1),
  };
}
export function histogramDomain(eligible) {
  const extent = Math.max(
    0.001,
    ...eligible.map((region) => Math.abs(region.difference)),
  );
  return [-extent, extent];
}
export function filterDescription(state) {
  const names = {
    all: 'All differences',
    topPositive: 'Top 10% of positive differences',
    topNegative: 'Top 10% of negative differences',
    largestAbs: 'Top 10% by absolute difference (both signs)',
    nearZero: 'Bottom 10% by absolute difference',
  };
  const descriptions = [names[state.preset] ?? names.all];
  if (state.histogramRange)
    descriptions.push(
      `range ${state.histogramRange.map((value) => value.toFixed(4)).join(' to ')} °C/decade`,
    );
  if (state.threshold > 0) descriptions.push(`|difference| ≥ ${state.threshold}`);
  if (state.search.trim()) descriptions.push(`search “${state.search.trim()}”`);
  return descriptions.join(' · ');
}

export function reconcileHistogramRange(range, eligible) {
  if (!range || !eligible.length) return null;
  const domain = histogramDomain(eligible);
  const min = Math.max(range[0], domain[0]),
    max = Math.min(range[1], domain[1]);
  return min <= max ? [min, max] : null;
}
