# Climate Seasonality Explorer

A buildless D3/SVG explorer of GFDL-ESM4 historical temperatures and seasonal warming. Open the repository with VS Code Live Server, or run:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000`. Opening `index.html` using `file://` will not work because browsers restrict JSON fetches. D3 7.9.0 is vendored; fonts fall back to system fonts when offline.

## Behavior

- Compare any two of DJF, MAM, JJA, SON. Ranking uses **signed A − B warming rates over 1950–2014**, ordered descending by default, with a symmetric global season-pair scale.
- Enter geographic bounds on 5° boundaries. Both views use the same extent; ranking includes fully contained blocks. Antimeridian-crossing custom extents are rejected.
- Click a chart row or map cell to select a 5° region without changing the viewport. Apply bounds outside the selection to clear it. All four seasonal rates are shown below the map.
- The map offers warming rate, temperature, and anomaly. Temperature/anomaly use the selected year; trend maps ignore year. Follow season A or choose an independent map season.
- Map color domains are fixed across all seasons/years and geographic filters. Land, ocean, coastlines, selection color, and climate opacity are independently configurable. Missing cells are transparent.
- Broad extents use area-weighted 5° display cells. Extents of 3,600 square degrees or less use native 1° × 1.25° cells. Rankings always use the original 5° block aggregation.
- Ranking retains all eligible records but renders only the scroll window plus a buffer. Rows support Enter/Space selection and pointer tooltips.

## Separation of concerns

| File | Responsibility |
| --- | --- |
| `src/main.js` | Application orchestration, control binding, linked selection, stale-request protection |
| `src/state.js` | Shared state and subscriptions |
| `src/data.js` | Relative asset URLs, schema checks, bounded promise fetch cache |
| `src/geo.js` | Pure coordinate, bounds, ranking, and display aggregation functions |
| `src/map.js` | D3 projection, geographic/climate layers, legend, map selection |
| `src/ranking.js` | D3 diverging bars, fixed axis, virtual rows, chart selection |
| `src/tooltip.js` | Safe shared tooltip DOM utility |
| `scripts/export_climate_json.py` | Offline source validation, climate export, Natural Earth conversion |

The map and ranking do not import one another. All changes travel through shared application state. Only the data loader fetches climate assets. There is no runtime Python, backend, bundler, or Node dependency.

## Re-export data

The source `cmip6_processed.nc` and `110m_physical/` shapefiles must be available locally. Install offline preprocessing dependencies with `uv sync`, then:

```sh
uv run python scripts/export_climate_json.py
```

The script validates dimensions, seasons, year range, units, and coordinates; normalizes longitude to ascending −179.375°…179.375°; and exports 526 compact JSON files (~181 MB total). Rates are rounded to five decimals, temperature/anomaly to three, after full-precision weighted aggregation. Non-finite values become JSON null. All 2,592 regions have deterministic IDs and explicit `[west,east,south,north]` bounds. Files contain no precomputed season-pair differences.

`data/metadata.json` defines the schema, grid, provenance, periods, units, and stable color domains. `data/regions.json` contains four seasonal rates per region. `data/warming_rate/SEASON.json` and `data/{temperature,anomaly}/SEASON/YEAR.json` contain row-major 51,840-value native grids. The browser fetches only the selected grid and keeps at most 16 cached promises.

Natural Earth land and coastline GeoJSON are generated from the supplied 1:110m shapefiles. No country border layer is included because the supplied physical dataset does not include national boundaries.

## Validation

```sh
uv run python -m unittest discover -s tests -p 'test_*.py'
node --test tests/geo.test.mjs
```

Python checks every JSON payload and independently verifies sampled regional means and native coordinate alignment against NetCDF. Node checks signed ordering, zero differences, missing data, bounds, search, thresholds, and display aggregation. Node is only needed for these development checks.

## GitHub Pages

Set **Settings → Pages → Source → GitHub Actions**. The included workflow deploys pushes to `main`, or can be run manually. If your default branch differs, update `.github/workflows/pages.yml`.

The workflow stages only `index.html`, `style.css`, `src/`, `data/`, `geography/`, and `vendor/`, excluding NetCDF, raw shapefiles, virtual environments, scripts, and preprocessing dependencies. All application assets use relative URLs, so repository subpaths work. Commit the generated static data before deploying. The uncompressed export totals ~181 MB; the largest JSON asset is under 0.5 MB. No remote push or deployment is performed by the implementation itself.
