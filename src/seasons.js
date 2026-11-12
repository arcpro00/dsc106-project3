// Names follow Northern Hemisphere meteorological seasons; source keys stay unchanged.
export const SEASON_NAMES = { DJF: 'Winter', MAM: 'Spring', JJA: 'Summer', SON: 'Fall' };
export const seasonName = (season) => SEASON_NAMES[season] ?? season;
