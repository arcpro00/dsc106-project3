import {createState} from './state.js';
import {loadMetadata, loadRegions, loadGeography, loadGrid} from './data.js';
import {GLOBAL_BOUNDS, contained, validateBounds, regionLabel} from './geo.js';
import {createMap} from './map.js';
import {createRankingChart} from './ranking.js';
const $ = id => document.getElementById(id);
const store = createState({bounds: {...GLOBAL_BOUNDS}, seasonA: 'DJF', seasonB: 'JJA', rankDirection: 'descending', layer: 'warming_rate', mapSeason: 'DJF', followSeason: true, year: 2000, selectedRegionId: null, overlayOpacity: .55, colors: {land: '#d8dfd3', ocean: '#dcecf5', coastline: '#596a6e', selection: '#242424'}, threshold: 0, search: ''});
let map, ranking, regions, requestId = 0;
function setState(patch) {
  const next = {...store.get(), ...patch};
  if (next.followSeason) patch.mapSeason = next.seasonA;
  const selected = regions.find(region => region.id === next.selectedRegionId);
  if (selected && !contained(selected, next.bounds)) patch.selectedRegionId = null;
  store.set(patch);
}
function selectRegion(id) { setState({selectedRegionId: id}); }
function updateSelection(state) {
  const selected = regions.find(region => region.id === state.selectedRegionId);
  $('clear-selection').hidden = !selected;
  const container = $('selection-detail');
  container.replaceChildren();
  const icon = document.createElement('span'); icon.className = 'selection-icon'; icon.textContent = '⌖'; container.append(icon);
  if (!selected) {
    const p = document.createElement('p'); p.textContent = 'Select a ranked region or a map cell to inspect its seasonal rates.'; container.append(p); return;
  }
  const detail = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = `${regionLabel(selected)} · ${selected.id}`; detail.append(title);
  const list = document.createElement('dl');
  for (const [season, rate] of Object.entries(selected.rates)) {
    const item = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = season; dd.textContent = rate === null ? 'No data' : `${rate.toFixed(3)}`; item.append(dt, dd); list.append(item);
  }
  detail.append(list);
  const note = document.createElement('p'); note.textContent = 'Seasonal warming rates · °C/decade · 1950–2014'; detail.append(note); container.append(detail);
}
async function render(state) {
  const token = ++requestId;
  $('seasonA').value = state.seasonA; $('seasonB').value = state.seasonB;
  $('mapSeason').value = state.mapSeason; $('mapSeason').disabled = state.followSeason;
  $('year').disabled = state.layer === 'warming_rate';
  $('rank-caption').textContent = `${state.seasonA} − ${state.seasonB} · signed difference in °C/decade · 1950–2014`;
  $('map-caption').textContent = state.layer === 'warming_rate' ? `${state.mapSeason} warming rate · fixed 1950–2014 trend` : `${state.mapSeason} ${state.layer === 'anomaly' ? 'temperature anomaly (1951–1980 baseline)' : 'mean temperature'} · ${state.year}`;
  $('legend-unit').textContent = state.layer === 'warming_rate' ? '°C / decade' : '°C';
  ranking.update({...state, regions});
  updateSelection(state);
  $('status').textContent = 'Loading map layer…'; $('error').hidden = true;
  $('map').setAttribute('aria-busy', 'true');
  try {
    const grid = await loadGrid({variable: state.layer, season: state.mapSeason, year: state.year});
    if (token !== requestId) return;
    const coarse = map.update({...state, layerGrid: grid, selectedRegion: regions.find(r => r.id === state.selectedRegionId)});
    $('resolution').textContent = coarse ? '5° weighted overview' : '1° × 1.25° native cells';
    $('status').textContent = 'Historical model simulation · 65 years · global coverage';
    $('map').setAttribute('aria-busy', 'false');
  } catch (error) {
    if (token !== requestId) return;
    $('error').hidden = false; $('error').textContent = `${error.message} Refresh the page to retry.`;
    $('status').textContent = 'Map layer unavailable.';
    $('map').setAttribute('aria-busy', 'false');
  }
}
function bindControls(metadata) {
  for (let year = metadata.yearRange[0]; year <= metadata.yearRange[1]; year++) $('year').add(new Option(year, year));
  $('year').value = 2000;
  for (const id of ['seasonA', 'seasonB', 'layer', 'mapSeason', 'rankDirection']) $(id).addEventListener('change', event => setState({[id]: event.target.value}));
  $('year').addEventListener('change', event => setState({year: Number(event.target.value)}));
  $('follow').addEventListener('change', event => setState({followSeason: event.target.checked}));
  $('swap').addEventListener('click', () => { const {seasonA, seasonB} = store.get(); setState({seasonA: seasonB, seasonB: seasonA}); });
  $('opacity').addEventListener('input', event => setState({overlayOpacity: Number(event.target.value)}));
  for (const color of ['land', 'ocean', 'coastline', 'selection']) $(color).addEventListener('input', event => setState({colors: {...store.get().colors, [color]: event.target.value}}));
  $('search').addEventListener('input', event => setState({search: event.target.value}));
  $('threshold').addEventListener('input', event => { if (event.target.validity.valid && event.target.value !== '') setState({threshold: Number(event.target.value)}); });
  $('clear-selection').addEventListener('click', () => setState({selectedRegionId: null}));
  $('bounds-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const bounds = Object.fromEntries(Object.keys(GLOBAL_BOUNDS).map(key => [key, Number($(key).value)]));
      validateBounds(bounds); $('bounds-error').hidden = true; setState({bounds});
    } catch (error) { $('bounds-error').textContent = error.message; $('bounds-error').hidden = false; }
  });
  $('reset').addEventListener('click', () => { for (const [key, value] of Object.entries(GLOBAL_BOUNDS)) $(key).value = value; $('bounds-error').hidden = true; setState({bounds: {...GLOBAL_BOUNDS}}); });
}
async function init() {
  try {
    const [metadata, regionData, geography] = await Promise.all([loadMetadata(), loadRegions(), loadGeography()]);
    regions = regionData;
    map = createMap({svg: $('map'), legend: $('legend'), geography, metadata, onRegionSelect: selectRegion});
    ranking = createRankingChart({viewport: $('rank-viewport'), svg: $('ranking'), axis: $('rank-axis'), onSelectRegion: selectRegion, onSummary: ({rows, excluded}) => {
      $('region-count').textContent = `${rows.length.toLocaleString()} of 2,592 regions · ${excluded} excluded for missing rates · fully contained blocks`;
      $('empty').hidden = rows.length > 0;
    }});
    bindControls(metadata); store.subscribe(render); await render(store.get());
  } catch (error) { $('status').textContent = 'Unable to start explorer.'; $('error').hidden = false; $('error').textContent = `${error.message} Serve this folder with a local HTTP server; opening index.html directly cannot load data.`; }
}
init();
