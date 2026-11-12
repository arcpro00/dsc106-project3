import json
import sys
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from export_region_geography import area, load
from shapely.geometry import box

class GeographyTests(unittest.TestCase):
    def test_equal_area_polar_and_optional_layer(self):
        ratio = area(box(0,85,5,90))/area(box(0,0,5,5))
        self.assertLess(ratio,.1)
        self.assertGreater(ratio,0)
        self.assertIsNone(load(None))
        self.assertAlmostEqual(area(box(175,0,180,5)),area(box(-180,0,-175,5)),delta=1)

    def test_metadata(self):
        data=json.loads(Path('data/region_geography.json').read_text())
        self.assertIn('6933',data['area_method'])
        self.assertEqual(len(data['regions']),2592)
        self.assertNotIn('Example territory',json.dumps(data))
        for r in data['regions'].values():
            self.assertTrue(np.isfinite(r['land_fraction']))
            self.assertGreaterEqual(r['land_fraction'],0)
            self.assertLessEqual(r['land_fraction'],1)
        self.assertTrue(any(0<r['land_fraction']<1 for r in data['regions'].values()))

if __name__=='__main__':unittest.main()
