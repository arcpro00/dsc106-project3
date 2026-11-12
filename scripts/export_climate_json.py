"""Offline deterministic export. Run with the project's Python environment.

Climate precision: rates 5 decimals; temperature/anomaly 3 decimals.
Natural Earth SHP records are read directly (Polygon/PolyLine only).
"""
import argparse
import json
import struct
from pathlib import Path
import numpy as np
import xarray as xr

SEASONS = ['DJF', 'MAM', 'JJA', 'SON']


def write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, allow_nan=False, separators=(',', ':')))


def values(array, precision):
    return [round(float(x), precision) if np.isfinite(x) else None for x in array.ravel()]


def load_source(path):
    ds = xr.open_dataset(path, engine='h5netcdf')
    assert dict(ds.sizes) == dict(season=4, year=65, lat=180, lon=288), 'Unexpected dimensions'
    assert list(ds.season.values) == SEASONS, 'Unexpected seasons'
    assert np.array_equal(ds.year, np.arange(1950, 2015)), 'Unexpected years'
    assert np.allclose(ds.lat, np.arange(-89.5, 90, 1)), 'Latitude must ascend at 1 degree'
    ds = ds.assign_coords(lon=((ds.lon + 180) % 360) - 180).sortby('lon')
    assert np.allclose(ds.lon, np.arange(-179.375, 180, 1.25)), 'Unexpected longitude grid'
    for name, unit in [('temperature', 'degC'), ('anomaly', 'degC'), ('warming_rate', 'degC/decade')]:
        assert ds[name].attrs.get('units') == unit, f'Unexpected units for {name}'
        expected = ('season', 'lat', 'lon') if name == 'warming_rate' else ('season', 'year', 'lat', 'lon')
        assert ds[name].dims == expected, f'Unexpected dimension order for {name}'
    return ds


def regions(ds):
    records = []
    rates = ds.warming_rate.values
    for row in range(36):
        weight = np.cos(np.deg2rad(ds.lat.values[row*5:row*5+5]))[:, None]
        for col in range(72):
            block = rates[:, row*5:row*5+5, col*4:col*4+4]
            valid = np.isfinite(block)
            numerator = np.where(valid, block * weight, 0).sum(axis=(1, 2))
            denominator = np.where(valid, np.broadcast_to(weight, block.shape), 0).sum(axis=(1, 2))
            means = np.divide(numerator, denominator, out=np.full(4, np.nan), where=denominator > 0)
            records.append(dict(id=f'r{row}_c{col}', bounds=[-180+col*5, -175+col*5, -90+row*5, -85+row*5], rates=dict(zip(SEASONS, values(means, 5)))))
    return records


def export_geography(source, target):
    # Natural Earth ESRI polygons use clockwise outer rings, as D3 spherical paths expect.
    for basename, output in [('ne_110m_land', 'land'), ('ne_110m_coastline', 'coastlines')]:
        raw = (source / f'{basename}.shp').read_bytes()
        features, offset = [], 100
        while offset < len(raw):
            _, length = struct.unpack_from('>ii', raw, offset)
            record = raw[offset+8:offset+8+length*2]
            offset += 8+length*2
            shape, = struct.unpack_from('<i', record)
            if shape == 0:
                continue
            if shape not in (3, 5):
                raise ValueError(f'Unsupported SHP shape {shape}')
            parts, count = struct.unpack_from('<ii', record, 36)
            starts = list(struct.unpack_from(f'<{parts}i', record, 44)) + [count]
            coords = [list(struct.unpack_from('<dd', record, 44+4*parts+i*16)) for i in range(count)]
            rings = [coords[starts[i]:starts[i+1]] for i in range(parts)]
            geometry = dict(type='Polygon' if shape == 5 else 'MultiLineString', coordinates=rings)
            features.append(dict(type='Feature', properties={}, geometry=geometry))
        write(target / f'{output}.geojson', dict(type='FeatureCollection', features=features))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('cmip6_processed.nc'))
    parser.add_argument('--output', type=Path, default=Path('data'))
    parser.add_argument('--geography-source', type=Path, default=Path('110m_physical'))
    args = parser.parse_args()
    ds = load_source(args.source)
    metadata = dict(schemaVersion=1, model=ds.attrs['model'], member=ds.attrs['member'], yearRange=[1950, 2014], baseline=[1951, 1980], trendPeriod=[1950, 2014], seasons=SEASONS, grid=dict(latCount=180, lonCount=288, latStart=-89.5, latStep=1, lonStart=-179.375, lonStep=1.25, rowOrder='south-to-north', columnOrder='west-to-east'), blockSizeDegrees=5, units=dict(temperature='degC', anomaly='degC', warming_rate='degC/decade'))
    # Fixed global domains, spanning all seasons/years, prevent filter-dependent recoloring.
    metadata['domains'] = {}
    for variable in ['warming_rate', 'temperature', 'anomaly']:
        array = ds[variable].values
        lo, hi = float(np.nanmin(array)), float(np.nanmax(array))
        metadata['domains'][variable] = [lo, hi] if variable == 'temperature' else [-max(abs(lo), abs(hi)), max(abs(lo), abs(hi))]
    write(args.output / 'metadata.json', metadata)
    write(args.output / 'regions.json', dict(schemaVersion=1, regions=regions(ds)))
    for variable in ['warming_rate', 'temperature', 'anomaly']:
        for season in SEASONS:
            years = [None] if variable == 'warming_rate' else range(1950, 2015)
            for year in years:
                selection = dict(season=season)
                if year is not None:
                    selection['year'] = year
                flat = values(ds[variable].sel(**selection).values, 5 if year is None else 3)
                assert len(flat) == 51840
                payload = dict(schemaVersion=1, variable=variable, season=season, values=flat)
                if year is not None:
                    payload['year'] = year
                path = args.output / variable / (f'{season}.json' if year is None else f'{season}/{year}.json')
                write(path, payload)
    export_geography(args.geography_source, Path('geography'))
    files = list(args.output.rglob('*.json'))
    print(f'Exported {len(files)} JSON files, {sum(p.stat().st_size for p in files)/1e6:.1f} MB, and Natural Earth geography.')


if __name__ == '__main__':
    main()
