"""Export 65-year area-weighted regional anomaly histories in 4 × 36 band files."""
import argparse
from pathlib import Path
import numpy as np
from export_climate_json import load_source, values, write, SEASONS


def band_means(array, latitudes):
    """Input: year × 5 latitude rows × 288 longitude columns; output: year × 72 blocks."""
    blocks = array.reshape(array.shape[0], 5, 72, 4)
    weight = np.cos(np.deg2rad(latitudes))[None, :, None, None]
    valid = np.isfinite(blocks)
    numerator = np.where(valid, blocks * weight, 0).sum(axis=(1, 3))
    denominator = np.where(valid, np.broadcast_to(weight, blocks.shape), 0).sum(axis=(1, 3))
    return np.divide(numerator, denominator, out=np.full_like(numerator, np.nan, dtype=float), where=denominator > 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('cmip6_processed.nc'))
    parser.add_argument('--output', type=Path, default=Path('data/timeseries'))
    args = parser.parse_args()
    ds = load_source(args.source)
    years = ds.year.values.astype(int).tolist()
    for season in SEASONS:
        array = ds.anomaly.sel(season=season).values
        for band in range(36):
            start = band * 5
            means = band_means(array[:, start:start+5, :], ds.lat.values[start:start+5])
            payload = dict(schemaVersion=1, variable='anomaly', season=season, band=band, baseline=[1951, 1980], years=years,
                           regions={f'r{band}_c{col}': values(means[:, col], 3) for col in range(72)})
            write(args.output / f'{season}_band_{band:02d}.json', payload)
    files = list(args.output.glob('*.json'))
    print(f'Exported {len(files)} anomaly history files ({sum(p.stat().st_size for p in files)/1e6:.2f} MB).')


if __name__ == '__main__':
    main()

# Bundles share the exact regional aggregation used by the band exports above.
def export_bundles():
    ds = load_source(Path('cmip6_processed.nc'))
    ids = [f'r{r}_c{c}' for r in range(36) for c in range(72)]
    common = dict(schemaVersion=1, years=ds.year.values.astype(int).tolist(), seasons=SEASONS, baseline=[1951, 1980], units='degC', weighting='cos(latitude), finite cells only')
    anomalies, global_series = {}, {}
    for season in SEASONS:
        array = ds.anomaly.sel(season=season).values
        blocks = [band_means(array[:, r*5:r*5+5], ds.lat.values[r*5:r*5+5]) for r in range(36)]
        anomalies[season] = [values(block[:, c], 3) for block in blocks for c in range(72)]
        weights = np.broadcast_to(np.cos(np.deg2rad(ds.lat.values))[None, :, None], array.shape)
        valid = np.isfinite(array)
        means = np.where(valid, array*weights, 0).sum(axis=(1, 2))/np.where(valid, weights, 0).sum(axis=(1, 2))
        global_series[season] = values(means, 5)
    write(Path('data/regional_anomalies.json'), dict(**common, regionIds=ids, anomalies=anomalies))
    write(Path('data/global_anomalies.json'), dict(**common, anomalies=global_series))


if __name__ == '__main__':
    export_bundles()
