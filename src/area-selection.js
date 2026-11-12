import { contained } from './geo.js';
export function selectedIndices(regions, bounds) {
  return regions.flatMap((r, i) => (contained(r, bounds) ? [i] : []));
}
export function blockWeight(bounds) {
  return (
    (bounds[1] - bounds[0]) *
    (Math.sin((bounds[3] * Math.PI) / 180) - Math.sin((bounds[2] * Math.PI) / 180))
  );
}
export function areaSeries(bundle, regions, indices, season) {
  return bundle.years.map((_, year) => {
    let sum = 0,
      weights = 0;
    for (const index of indices) {
      const value = bundle.anomalies[season][index][year];
      if (typeof value === 'number' && Number.isFinite(value)) {
        const weight = blockWeight(regions[index].bounds);
        sum += weight * value;
        weights += weight;
      }
    }
    return weights ? sum / weights : null;
  });
}

export function zoomTarget(bounds, project, scale, center = [480, 244]) {
  const point = project([
    (bounds.lonMin + bounds.lonMax) / 2,
    (bounds.latMin + bounds.latMax) / 2,
  ]);
  return {
    k: Math.max(1, Math.min(12, scale)),
    x: center[0] - Math.max(1, Math.min(12, scale)) * point[0],
    y: center[1] - Math.max(1, Math.min(12, scale)) * point[1],
  };
}

export function moveAreaBounds(bounds, west, north) {
  const width = bounds.lonMax - bounds.lonMin,
    height = bounds.latMax - bounds.latMin;
  const lonMin = Math.max(-180, Math.min(180 - width, Math.round(west / 5) * 5));
  const latMax = Math.max(-90 + height, Math.min(90, Math.round(north / 5) * 5));
  return { lonMin, lonMax: lonMin + width, latMin: latMax - height, latMax };
}
