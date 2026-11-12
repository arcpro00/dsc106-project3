export const GLOBAL_BOUNDS = {lonMin: -180, lonMax: 180, latMin: -90, latMax: 90};
export const finite = value => typeof value === 'number' && Number.isFinite(value);
export function contained(region, bounds) {
  const [west, east, south, north] = region.bounds;
  return west >= bounds.lonMin && east <= bounds.lonMax && south >= bounds.latMin && north <= bounds.latMax;
}
export function validateBounds(bounds) {
  if (!Object.values(bounds).every(Number.isFinite)) throw new Error('Enter a number for each boundary.');
  if (bounds.latMin < -90 || bounds.latMax > 90 || bounds.latMin >= bounds.latMax) throw new Error('Latitude must increase from south to north within −90° to 90°.');
  if (bounds.lonMin < -180 || bounds.lonMax > 180 || bounds.lonMin >= bounds.lonMax) throw new Error('Longitude must increase from west to east within −180° to 180°. Antimeridian crossings are not supported.');
  if (Object.values(bounds).some(value => value % 5 !== 0)) throw new Error('Use 5° boundaries so both views cover the same complete regions.');
  return bounds;
}
export function coordinate(value, latitude = false) {
  return `${Math.abs(value)}°${value === 0 ? '' : latitude ? (value > 0 ? 'N' : 'S') : (value > 0 ? 'E' : 'W')}`;
}
export function regionLabel(region) {
  const [w, e, s, n] = region.bounds;
  return `${coordinate(s, true)}–${coordinate(n, true)} · ${coordinate(w)}–${coordinate(e)}`;
}
export function displayCells(grid, metadata, bounds) {
  const g = metadata.grid;
  const coarse = (bounds.lonMax - bounds.lonMin) * (bounds.latMax - bounds.latMin) > 3600;
  const rowStep = coarse ? 5 : 1, colStep = coarse ? 4 : 1;
  const cells = [];
  for (let row = 0; row < g.latCount; row += rowStep) {
    const south = -90 + row, north = south + rowStep;
    if (north <= bounds.latMin || south >= bounds.latMax) continue;
    for (let col = 0; col < g.lonCount; col += colStep) {
      const west = -180 + col * 1.25, east = west + colStep * 1.25;
      if (east <= bounds.lonMin || west >= bounds.lonMax) continue;
      let sum = 0, weights = 0;
      for (let r = row; r < row + rowStep; r++) {
        const weight = Math.cos((g.latStart + r) * Math.PI / 180);
        for (let c = col; c < col + colStep; c++) {
          const value = grid.values[r * g.lonCount + c];
          if (finite(value)) { sum += value * weight; weights += weight; }
        }
      }
      cells.push({id: `${row}:${col}`, bounds: [west, east, south, north], value: weights ? sum / weights : null});
    }
  }
  return {cells, coarse};
}

// Longitude is half-open at +180; pointer hits on the outside edge are clamped inward.
export function regionIdAt(lon, lat) {
  if (!finite(lon) || !finite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return `r${Math.min(35, Math.floor((lat + 90) / 5))}_c${Math.min(71, Math.floor((lon + 180) / 5))}`;
}
export function geographicBrushBounds(selection, invert) {
  if (!selection) return null;
  const [[x0, y0], [x1, y1]] = selection;
  const [west, north] = invert([x0, y0]), [east, south] = invert([x1, y1]);
  // Snap inward: a partially brushed block is excluded.
  const epsilon = 1e-7;
  const bounds = {
    lonMin: Math.max(-180, Math.ceil((west - epsilon) / 5) * 5),
    lonMax: Math.min(180, Math.floor((east + epsilon) / 5) * 5),
    latMin: Math.max(-90, Math.ceil((south - epsilon) / 5) * 5),
    latMax: Math.min(90, Math.floor((north + epsilon) / 5) * 5)
  };
  if (bounds.lonMin >= bounds.lonMax || bounds.latMin >= bounds.latMax) return null;
  return bounds;
}
