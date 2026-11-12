# Seasonal warming through time

Static HTML/CSS/vanilla JavaScript with D3 7.9.0 SVG rendering. Serve with VS Code Live Server or `python3 -m http.server 8000`.

Exactly two analytical views are active: a regional trend-difference map and a persistent seasonal anomaly chart. Select seasons, click a 5° region, and move the end-year slider through inclusive 30-year windows (1979 = 1950–1979; 2014 = 1985–2014). Full-period mode starts at 1950–2014 and preserves the last moving-window endpoint. Dragging the slider activates moving mode. Without a selected region, the temporal chart explicitly shows global area-weighted context.

Map fills, map tooltips and chart fits use one OLS implementation on the same regional histories. Slopes are °C/decade. The map domain spans all 36 moving windows plus the full period for the chosen pair, so it never rescales as the slider moves. Anomaly histories remain visible for all 65 years; shading and thick fitted segments show the analysis window. The difference in slopes is distinct from the vertical separation of anomalies. Season names use Northern Hemisphere month conventions everywhere.

## Modules

- `src/main.js`: shared state and two-view coordination; requestAnimationFrame slider scheduling.
- `src/trends.js`: pure period/OLS helpers, cached regional rate arrays, pair-wide color domains.
- `src/map.js`: D3 geographic paths, regional fills, selection, tooltip and legend.
- `src/temporal-chart.js`: D3 histories, shaded period and fitted trend segments.
- `src/data.js`: cached relative asset loading, including compatibility loaders.
- `src/state.js`, `src/geo.js`, `src/seasons.js`, `src/tooltip.js`: shared utilities.

Legacy ranking, histogram, selectors and detail modules remain on disk for compatibility/tests but are not imported by the active application. Geographic brushing/filtering is removed from this workflow; the legacy snapping helper now rejects sub-cell brushes safely.

## Export

Run `uv run python scripts/export_climate_json.py` for base assets and geography, then `uv run python scripts/export_exploration_data.py` for regional bands and the new regional/global anomaly bundles. The latter reads the original NetCDF, uses cosine-latitude weights and finite-value masks, and exports all four seasons and 65 years in stable region order. Regional anomalies are rounded to three decimals; global anomalies to five. Global means are calculated over native cells, not unweighted regional means. The current source has complete finite coverage for every season/year.

The map loads `data/regional_anomalies.json` once rather than fetching native annual grids or band files on slider changes. The chart uses this same bundle plus `data/global_anomalies.json` for its startup context.

## Validation and measured limits

Run `node --test tests/*.test.mjs` and `uv run python -m unittest discover -s tests -p 'test_*.py'`.

Measured maximum full-period discrepancy from legacy regional rates: **0.000074668 °C/decade**, below the explicit 0.0002 tolerance, consistent with anomaly rounding. Every regional seasonal slope is finite for all supported windows. All 260 global anomalies were independently checked against native-cell weighting within 0.0000051 °C.

A local Node measurement took ~238 ms to build the initial Winter/Summer pair domain and slope cache; retrieving all 36 cached seasonal pairs took ~0.04 ms. These measure numerical work, not browser rendering, network transfer or mobile performance.

Browser checks remain manual: desktop/mobile labels, mouse/touch/keyboard slider, rapid slider movement, selection persistence, global context reset, stable legend endpoints and fitted segments. No live deployment or browser performance claim is made.

## GitHub Pages

The existing Actions workflow stages `index.html`, `style.css`, `src`, `data`, `geography`, and `vendor`, including both new bundles. Configure Pages to use GitHub Actions. Relative module/asset URLs support repository subpaths. No backend or Node build is needed. No push or deployment is performed automatically by local implementation work.
