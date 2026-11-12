"""Independent verification of regional anomaly exports, baseline, and trends."""
import json
from pathlib import Path
import unittest
import numpy as np
import xarray as xr

ROOT = Path(__file__).resolve().parents[1]


class AnomalyHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = xr.open_dataset(ROOT / 'cmip6_processed.nc', engine='h5netcdf')
        cls.rates = {r['id']: r['rates'] for r in json.loads((ROOT / 'data/regions.json').read_text())['regions']}

    def test_every_payload_and_regional_trend(self):
        files = list((ROOT / 'data/timeseries').glob('*.json'))
        self.assertEqual(len(files), 144)
        for path in files:
            payload = json.loads(path.read_text(), parse_constant=lambda x: self.fail(f'Invalid number {x}'))
            self.assertEqual(payload['years'], list(range(1950, 2015)))
            self.assertEqual(payload['baseline'], [1951, 1980])
            self.assertEqual(len(payload['regions']), 72)
            season = payload['season']
            for region, series in payload['regions'].items():
                self.assertEqual(len(series), 65)
                self.assertTrue(region.startswith(f"r{payload['band']}_c"))
                # All source data in this dataset are finite; allow rounded series tolerance.
                self.assertLess(abs(np.mean(series[1:31])), .00051)
                slope = np.polyfit(np.arange(1950, 2015), series, 1)[0] * 10
                self.assertAlmostEqual(slope, self.rates[region][season], delta=.0002)

    def test_independent_area_weighting_and_longitude(self):
        lon = ((self.source.lon.values+180) % 360)-180
        for band, col in [(0, 0), (17, 24), (30, 60), (35, 71)]:
            lat_mask = (self.source.lat.values >= -90+band*5) & (self.source.lat.values < -85+band*5)
            lon_mask = (lon >= -180+col*5) & (lon < -175+col*5)
            for season in ['DJF', 'MAM', 'JJA', 'SON']:
                payload = json.loads((ROOT / f'data/timeseries/{season}_band_{band:02d}.json').read_text())
                series = payload['regions'][f'r{band}_c{col}']
                for year in [1950, 1951, 1980, 2000, 2014]:
                    block = self.source.anomaly.sel(season=season, year=year).values[lat_mask][:, lon_mask]
                    weights = np.broadcast_to(np.cos(np.deg2rad(self.source.lat.values[lat_mask]))[:, None], block.shape)
                    valid = np.isfinite(block)
                    expected = np.sum(block[valid]*weights[valid])/weights[valid].sum()
                    self.assertAlmostEqual(series[year-1950], expected, delta=.000501)


if __name__ == '__main__':
    unittest.main()
