import {
  geographyLines,
  summarizeAreaGeography,
  formatRegionLocation,
} from './geography-context.js';
import { selectedIndices, areaSeries } from './area-selection.js';
import { createState } from './state.js';
import {
  loadMetadata,
  loadRegions,
  loadGeography,
  loadRegionalAnomalies,
  loadGlobalAnomalies,
  loadRegionGeography,
} from './data.js';
import { createTrends, periodFor } from './trends.js';
import { createMap } from './map.js';
import { createTemporalChart } from './temporal-chart.js';
import { seasonName, seasonColor } from './seasons.js';
import { regionLabel } from './geo.js';
const $ = (id) => document.getElementById(id);
const store = createState({
  seasonA: 'DJF',
  seasonB: 'JJA',
  periodMode: 'full',
  windowEndYear: 2014,
  windowYears: 30,
  selectedRegionId: null,
  selectedBounds: null,
  overlayOpacity: Number($('opacity').value),
  colors: Object.fromEntries(
    ['land', 'ocean', 'coastline', 'selection'].map((key) => [
      key,
      getComputedStyle(document.documentElement).getPropertyValue(`--map-${key}`).trim(),
    ]),
  ),
});
async function init() {
  try {
    const [metadata, regions, geography, bundle, global, geographyById] =
      await Promise.all([
        loadMetadata(),
        loadRegions(),
        loadGeography(),
        loadRegionalAnomalies(),
        loadGlobalAnomalies(),
        loadRegionGeography().catch(() => ({})),
      ]);
    if (
      bundle.regionIds.length !== regions.length ||
      bundle.regionIds.some((id, i) => id !== regions[i].id) ||
      bundle.years.length !== 65
    )
      throw Error('Regional bundle ordering or dimensions are invalid.');
    for (const [key, value] of Object.entries(store.get().colors)) $(key).value = value;
    $('window-first').textContent =
      `${bundle.years[0]}–${bundle.years[0] + store.get().windowYears - 1}`;
    $('window-last').textContent =
      `${bundle.years.at(-1) - store.get().windowYears + 1}–${bundle.years.at(-1)}`;
    const trends = createTrends(bundle);
    const map = createMap({
      svg: $('map'),
      legend: $('legend'),
      geography,
      regions,
      geographyById,
      onRegionSelect: (id) => store.set({ selectedRegionId: id, selectedBounds: null }),
      onAreaSelect: (bounds) =>
        store.set({ selectedRegionId: null, selectedBounds: bounds }),
    });
    const chart = createTemporalChart({ svg: $('temporal') });
    function render(s) {
      const period = periodFor(s.periodMode, s.windowEndYear);
      $('period-label').textContent =
        `Analysis period: ${period.start}–${period.end} (${period.end - period.start + 1} years)`;
      $('full-period').checked = s.periodMode === 'full';
      $('end-year').value = s.windowEndYear;
      $('end-year').disabled = s.periodMode === 'full';
      $('end-year').setAttribute(
        'aria-valuetext',
        `${s.windowEndYear}; moving window ${s.windowEndYear - 29}–${s.windowEndYear}; active period ${period.start}–${period.end}`,
      );
      $('end-value').textContent = s.windowEndYear;
      for (const id of ['seasonA', 'seasonB']) {
        $(id).value = s[id];
        $(id).style.setProperty('--season-color', seasonColor(s[id]));
        for (const option of $(id).options) {
          option.style.setProperty('--option-season-color', seasonColor(option.value));
        }
        for (const option of $(id).options)
          option.disabled = option.value === s[id === 'seasonA' ? 'seasonB' : 'seasonA'];
      }
      const ratesA = trends.getRates(s.seasonA, period),
        ratesB = trends.getRates(s.seasonB, period);
      map.update({
        ...s,
        period,
        ratesA,
        ratesB,
        colorDomain: trends.getDomain(s.seasonA, s.seasonB),
      });
      const index = bundle.regionIds.indexOf(s.selectedRegionId);
      const indices = s.selectedBounds ? selectedIndices(regions, s.selectedBounds) : [];
      const areaBounds = s.selectedBounds
        ? [
            s.selectedBounds.lonMin,
            s.selectedBounds.lonMax,
            s.selectedBounds.latMin,
            s.selectedBounds.latMax,
          ]
        : null;
      const areaGeography = indices.length
        ? summarizeAreaGeography(geographyById, regions, indices, areaBounds)
        : null;
      $('context').textContent = indices.length
        ? `Selected area · ${formatRegionLocation(areaGeography, areaBounds)}`
        : index >= 0
          ? `Selected region · ${formatRegionLocation(geographyById[s.selectedRegionId], regions[index].bounds)}`
          : 'Global overview';
      $('context-detail').textContent = indices.length
        ? `${indices.length} complete 5° blocks · ${regionLabel({ bounds: areaBounds })}`
        : index >= 0
          ? `${s.selectedRegionId} · ${regionLabel(regions[index])}`
          : 'Select an area on the map to inspect its seasonal history.';
      $('clear-selection').hidden = index < 0 && !indices.length;
      const location = $('geographic-context');
      location.replaceChildren();
      const lines =
        index >= 0
          ? geographyLines(geographyById[s.selectedRegionId], regions[index].bounds)
          : indices.length
            ? geographyLines(
                summarizeAreaGeography(geographyById, regions, indices, [
                  s.selectedBounds.lonMin,
                  s.selectedBounds.lonMax,
                  s.selectedBounds.latMin,
                  s.selectedBounds.latMax,
                ]),
                [
                  s.selectedBounds.lonMin,
                  s.selectedBounds.lonMax,
                  s.selectedBounds.latMin,
                  s.selectedBounds.latMax,
                ],
              ).map((line) => line.replaceAll('of block', 'of selected area'))
            : ['Global context: area-weighted native-cell anomalies.'];
      for (const line of lines) {
        const p = document.createElement('p');
        p.textContent = line;
        location.append(p);
      }
      if (index >= 0) {
        const difference = ratesA[index] - ratesB[index];
        const ordered = regions
          .map((r, i) => ({ id: r.id, value: ratesA[i] - ratesB[i] }))
          .filter((r) => Number.isFinite(r.value))
          .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
        const rank = ordered.findIndex((r) => r.id === s.selectedRegionId) + 1;
        const p = document.createElement('p');
        p.textContent = `Global signed rank ${rank} of ${ordered.length}; ${((100 * (ordered.length - rank)) / Math.max(1, ordered.length - 1)).toFixed(1)}th percentile in this period. Positive means ${seasonName(s.seasonA)} warms faster; negative means ${seasonName(s.seasonB)} warms faster.`;
        location.append(p);
        const rates = document.createElement('p');
        rates.textContent =
          metadata.seasons
            .map(
              (season) =>
                `${seasonName(season)}: ${trends.getRates(season, period)[index].toFixed(4)}`,
            )
            .join(' · ') + ' °C/decade';
        location.append(rates);
      }
      const seriesA = indices.length
        ? areaSeries(bundle, regions, indices, s.seasonA)
        : index < 0
          ? global.anomalies[s.seasonA]
          : bundle.anomalies[s.seasonA][index];
      const seriesB = indices.length
        ? areaSeries(bundle, regions, indices, s.seasonB)
        : index < 0
          ? global.anomalies[s.seasonB]
          : bundle.anomalies[s.seasonB][index];
      const fits = chart.update({
        years: bundle.years,
        seriesA,
        seriesB,
        seasonA: s.seasonA,
        seasonB: s.seasonB,
        period,
      });
      $('summary').textContent = fits.every(Boolean)
        ? `${seasonName(s.seasonA)}: ${fits[0].rate.toFixed(4)} · ${seasonName(s.seasonB)}: ${fits[1].rate.toFixed(4)} · A − B: ${window.d3.format('+.4f')(fits[0].rate - fits[1].rate)} °C/decade`
        : 'Insufficient observations to fit trends.';
      $('legend-caption').textContent =
        `Negative: ${seasonName(s.seasonB)} warms faster · Positive: ${seasonName(s.seasonA)} warms faster. Scale fixed across all periods for this pair.`;
      $('status').textContent = 'CMIP6 · GFDL-ESM4 historical simulation';
    }
    for (const id of ['seasonA', 'seasonB'])
      $(id).addEventListener('change', (e) => store.set({ [id]: e.target.value }));
    $('full-period').addEventListener('change', (e) => {
      cancelAnimationFrame(frame);
      store.set({ periodMode: e.target.checked ? 'full' : 'moving' });
    });
    let frame;
    $('end-year').addEventListener('input', (e) => {
      const end = Number(e.target.value);
      $('end-value').textContent = end;
      $('period-label').textContent = `Analysis period: ${end - 29}–${end} (30 years)`;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        store.set({ windowEndYear: end, periodMode: 'moving' }),
      );
    });
    $('clear-selection').addEventListener('click', () =>
      store.set({ selectedRegionId: null, selectedBounds: null }),
    );
    $('opacity').addEventListener('input', (e) =>
      store.set({ overlayOpacity: Number(e.target.value) }),
    );
    for (const key of ['land', 'ocean', 'coastline', 'selection'])
      $(key).addEventListener('input', (e) =>
        store.set({ colors: { ...store.get().colors, [key]: e.target.value } }),
      );
    $('zoom-in').addEventListener('click', () => map.zoomBy(1.5));
    $('zoom-out').addEventListener('click', () => map.zoomBy(1 / 1.5));
    $('zoom-reset').addEventListener('click', () => map.resetZoom());
    store.subscribe(render);
    render(store.get());
  } catch (error) {
    $('status').textContent =
      `Unable to load explorer: ${error.message} Refresh to retry. Serve the site through HTTP.`;
  }
}
init();
