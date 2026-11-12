// Names follow Northern Hemisphere meteorological seasons; source keys stay unchanged.
export const SEASON_NAMES = { DJF: 'Winter', MAM: 'Spring', JJA: 'Summer', SON: 'Fall' };
export const seasonName = (season) => SEASON_NAMES[season] ?? season;

// CSS owns presentation colors; D3 reads the same tokens as the controls.
export function seasonColor(season) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--season-${season.toLowerCase()}`)
    .trim();
}

export function seasonDifferenceScale(d3, seasonAColor, seasonBColor, domain) {
  return d3
    .scaleLinear()
    .domain([domain[0], 0, domain[1]])
    .range([seasonBColor, '#F5F3EF', seasonAColor])
    .interpolate(d3.interpolateRgb)
    .clamp(true);
}
