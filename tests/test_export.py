"""Validate committed assets against independent source calculations."""
import json
import unittest
from pathlib import Path
import numpy as np
import xarray as xr

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    def invalid(value):
        raise ValueError(f'Non-standard JSON: {value}')
    return json.loads(path.read_text(), parse_constant=invalid)


class ExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = xr.open_dataset(ROOT / 'cmip6_processed.nc', engine='h5netcdf')
        cls.regions = read(ROOT / 'data/regions.json')['regions']

    def test_metadata_and_all_grids(self):
        metadata = read(ROOT / 'data/metadata.json')
        self.assertEqual(metadata['yearRange'], [1950, 2014])
        self.assertEqual(metadata['seasons'], ['DJF', 'MAM', 'JJA', 'SON'])
        files = [path for path in (ROOT / 'data').rglob('*.json') if 'timeseries' not in path.parts and path.name not in ('regional_anomalies.json', 'global_anomalies.json')]
        self.assertEqual(len(files), 526)
        for path in files:
            payload = read(path)
            if 'values' not in payload:
                continue
            self.assertEqual(len(payload['values']), 51840, str(path))
            self.assertEqual(payload['variable'], path.relative_to(ROOT / 'data').parts[0])
            if payload['variable'] == 'warming_rate':
                self.assertNotIn('year', payload)
            else:
                self.assertEqual(payload['year'], int(path.stem))
                self.assertEqual(payload['season'], path.parent.name)

    def test_partition_and_weighted_means(self):
        self.assertEqual(len(self.regions), 2592)
        self.assertEqual(len({r['id'] for r in self.regions}), 2592)
        longitude = ((self.source.lon.values + 180) % 360) - 180
        for row in range(36):
            for col in range(72):
                region = self.regions[row*72+col]
                self.assertEqual(region['id'], f'r{row}_c{col}')
                self.assertEqual(region['bounds'], [-180+col*5, -175+col*5, -90+row*5, -85+row*5])
        for index in [0, 71, 139, 1200, 2100, 2591]:
            region = self.regions[index]
            west, east, south, north = region['bounds']
            lat_mask = (self.source.lat >= south) & (self.source.lat < north)
            lon_mask = (longitude >= west) & (longitude < east)
            self.assertEqual(int(lat_mask.sum())*int(lon_mask.sum()), 20)
            for season in ['DJF', 'MAM', 'JJA', 'SON']:
                block = self.source.warming_rate.sel(season=season).values[lat_mask][:, lon_mask]
                weight = np.broadcast_to(np.cos(np.deg2rad(self.source.lat.values[lat_mask]))[:, None], block.shape)
                valid = np.isfinite(block)
                mean = np.sum(block[valid]*weight[valid])/np.sum(weight[valid])
                self.assertAlmostEqual(region['rates'][season], mean, delta=0.0000051)

    def test_grid_geographic_alignment(self):
        rng = np.random.default_rng(42)
        sorted_lon = np.argsort(((self.source.lon.values + 180) % 360) - 180)
        for variable, precision in [('warming_rate', 5), ('temperature', 3), ('anomaly', 3)]:
            for season in ['DJF', 'MAM', 'JJA', 'SON']:
                year = None if variable == 'warming_rate' else 2000
                path = ROOT / 'data' / variable / (f'{season}.json' if year is None else f'{season}/{year}.json')
                payload = read(path)
                selection = {'season': season}
                if year is not None:
                    selection['year'] = year
                original = self.source[variable].sel(**selection).values
                for _ in range(15):
                    row, col = int(rng.integers(180)), int(rng.integers(288))
                    self.assertAlmostEqual(payload['values'][row*288+col], float(original[row, sorted_lon[col]]), delta=10**(-precision)/2+1e-8)


if __name__ == '__main__':
    unittest.main()
