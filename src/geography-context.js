import { regionLabel } from './geo.js';
export const GEOGRAPHY_THRESHOLDS = { dominant: 0.7, substantial: 0.1, ocean: 0.1 };
export const getRegionGeography = (lookup, id) => lookup?.[id] ?? null;
export const formatGeographicBounds = (bounds) => regionLabel({ bounds });
export function summarizeLandCover(fraction) {
  if (!Number.isFinite(fraction)) return 'Land coverage unavailable';
  return `${Math.round(fraction * 100)}% land · ${fraction < 0.1 ? 'Mostly ocean' : fraction > 0.9 ? 'Mostly land' : 'Mixed land/ocean'}`;
}
export function formatRegionLocation(geo, bounds) {
  if (!geo) return formatGeographicBounds(bounds);
  const countries = geo.countries ?? [];
  if (countries[0]?.fraction >= GEOGRAPHY_THRESHOLDS.dominant) return countries[0].name;
  const substantial = countries.filter(
    (c) => c.fraction >= GEOGRAPHY_THRESHOLDS.substantial,
  );
  if (substantial.length >= 2)
    return substantial
      .slice(0, 2)
      .map((c) => c.name)
      .join(' / ');
  if (geo.land_fraction < 0.1 && !substantial.length) return 'Open ocean region';
  if (geo.land_fraction > 0.1 && geo.land_fraction < 0.9) return 'Coastal region';
  return countries.length
    ? `Overlaps ${countries[0].name}`
    : formatGeographicBounds(bounds);
}
export function geographyLines(geo, bounds) {
  if (!geo) return [formatGeographicBounds(bounds), 'Geographic attribution unavailable'];
  const lines = [
    formatRegionLocation(geo, bounds),
    formatGeographicBounds(bounds),
    geo.latitude_band,
    summarizeLandCover(geo.land_fraction),
  ];
  for (const [key, label] of [
    ['countries', 'Countries/territories'],
    ['admin1', 'Subdivisions'],
  ]) {
    const values = geo[key] ?? [];
    if (values.length)
      lines.push(
        `${label}: ${values
          .slice(0, 3)
          .map((c) => `${c.name} (${(c.fraction * 100).toFixed(1)}% of block)`)
          .join(', ')}${values.length > 3 ? ` · +${values.length - 3} more` : ''}`,
      );
  }
  return lines;
}

// Combine precomputed overlaps using the same area weights as selected histories.
export function summarizeAreaGeography(lookup, regions, indices, bounds) {
  if (!indices.length || indices.some((i) => !lookup[regions[i].id])) return null;
  const countries = new Map(),
    admin1 = new Map();
  let total = 0,
    land = 0;
  const bands = new Set();
  for (const i of indices) {
    const region = regions[i],
      geo = lookup[region.id],
      b = region.bounds;
    const weight =
      (b[1] - b[0]) *
      (Math.sin((b[3] * Math.PI) / 180) - Math.sin((b[2] * Math.PI) / 180));
    total += weight;
    land += weight * geo.land_fraction;
    bands.add(geo.latitude_band);
    for (const [entries, map] of [
      [geo.countries, countries],
      [geo.admin1, admin1],
    ])
      for (const entry of entries) {
        const key = `${entry.country ?? ''}:${entry.name}`;
        const accumulated = map.get(key) ?? { ...entry, fraction: 0 };
        accumulated.fraction += weight * entry.fraction;
        map.set(key, accumulated);
      }
  }
  const shares = (map) =>
    [...map.values()]
      .map((entry) => ({ ...entry, fraction: entry.fraction / total }))
      .sort((a, b) => b.fraction - a.fraction || a.name.localeCompare(b.name));
  return {
    bounds,
    land_fraction: land / total,
    countries: shares(countries),
    admin1: shares(admin1),
    latitude_band: [...bands].join(' / '),
  };
}
