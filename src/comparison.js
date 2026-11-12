import { finite } from './geo.js';

// Keep signed subtraction and its full-global color domain independent of either view.
export function differenceGrid(a, b) {
  if (a.values.length !== b.values.length)
    throw new Error('Season grids must have matching dimensions.');
  let extent = 0;
  const values = a.values.map((value, index) => {
    const other = b.values[index];
    if (!finite(value) || !finite(other)) return null;
    const difference = value - other;
    extent = Math.max(extent, Math.abs(difference));
    return difference;
  });
  return {
    variable: 'warming_rate_difference',
    seasonA: a.season,
    seasonB: b.season,
    values,
    domain: [-(extent || 0.1), extent || 0.1],
  };
}
