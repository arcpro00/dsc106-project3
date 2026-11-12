export function periodFor(mode, end = 2014) {
  return mode === 'full'
    ? { start: 1950, end: 2014 }
    : {
        start: Math.max(1979, Math.min(2014, Math.round(end))) - 29,
        end: Math.max(1979, Math.min(2014, Math.round(end))),
      };
}
export function fitTrend(years, values, period) {
  const points = years.flatMap((year, i) =>
    year >= period.start &&
    year <= period.end &&
    typeof values[i] === 'number' &&
    Number.isFinite(values[i])
      ? [[year, values[i]]]
      : [],
  );
  if (points.length < 20) return null;
  const t = points.reduce((s, p) => s + p[0], 0) / points.length,
    y = points.reduce((s, p) => s + p[1], 0) / points.length;
  const denominator = points.reduce((s, p) => s + (p[0] - t) ** 2, 0);
  if (!denominator) return null;
  const slope = points.reduce((s, p) => s + (p[0] - t) * (p[1] - y), 0) / denominator;
  return {
    rate: slope * 10,
    startValue: y + slope * (period.start - t),
    endValue: y + slope * (period.end - t),
  };
}
export function createTrends(bundle) {
  const cache = new Map(),
    domains = new Map();
  const getRates = (season, period) => {
    const key = `${season}:${period.start}:${period.end}`;
    if (!cache.has(key))
      cache.set(
        key,
        Float64Array.from(
          bundle.anomalies[season],
          (values) => fitTrend(bundle.years, values, period)?.rate ?? NaN,
        ),
      );
    return cache.get(key);
  };
  return {
    getRates,
    getDomain(a, b) {
      const key = [a, b].sort().join(':');
      if (!domains.has(key)) {
        let extent = 0.001;
        for (const period of [
          periodFor('full'),
          ...Array.from({ length: 36 }, (_, i) => periodFor('moving', 1979 + i)),
        ]) {
          const aa = getRates(a, period),
            bb = getRates(b, period);
          aa.forEach((value, i) => {
            if (Number.isFinite(value - bb[i]))
              extent = Math.max(extent, Math.abs(value - bb[i]));
          });
        }
        domains.set(key, [-extent, extent]);
      }
      return domains.get(key);
    },
  };
}
