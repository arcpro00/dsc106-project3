"""Offline Natural Earth attribution. Fractions are of whole grid-block area."""
import argparse
import json
from pathlib import Path
import geopandas as gpd
from shapely import make_valid, box
from shapely.ops import transform, unary_union
from pyproj import Transformer
from export_climate_json import write

DIAGNOSTICS = []
PROJECT = Transformer.from_crs(4326, 6933, always_xy=True).transform

def area(geometry):
    return transform(PROJECT, geometry).area

def load(path):
    if not path or not path.exists():
        DIAGNOSTICS.append(f'Optional layer missing: {path}')
        return None
    frame = gpd.read_file(path)
    if frame.crs is None:
        raise ValueError(f'Unknown CRS: {path}')
    frame = frame.to_crs(4326)
    invalid = int((~frame.is_valid).sum())
    skipped = int((frame.geometry.isna() | frame.geometry.is_empty).sum())
    DIAGNOSTICS.append(f'{path}: repaired {invalid} invalid geometries; skipped {skipped} empty/null geometries')
    frame.geometry = frame.geometry.map(lambda geometry: make_valid(geometry) if geometry is not None else None)
    return frame[~frame.geometry.is_empty & frame.geometry.notna()].reset_index(drop=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--countries', type=Path, default=Path('110m_cultural/ne_110m_admin_0_countries.shp'))
    parser.add_argument('--admin1', type=Path, default=Path('110m_cultural/ne_110m_admin_1_states_provinces.shp'))
    parser.add_argument('--land', type=Path, default=Path('110m_physical/ne_110m_land.shp'))
    parser.add_argument('--output', type=Path, default=Path('data/region_geography.json'))
    args = parser.parse_args()
    countries, admin1, land = [load(path) for path in [args.countries, args.admin1, args.land]]
    if land is None:
        raise ValueError('Land polygons are required for coverage calculation')
    warnings = ['Admin-1 coverage is limited to the countries represented in the local layer.']
    result = {}
    for region in json.loads(Path('data/regions.json').read_text())['regions']:
        w,e,s,n = region['bounds']; polygon = box(w,s,e,n); total = area(polygon)
        def overlaps(frame, country=False):
            records = []
            intersections = []
            if frame is None:
                return records
            for index in frame.sindex.query(polygon, predicate='intersects'):
                row = frame.iloc[index]; intersection = polygon.intersection(row.geometry)
                fraction = area(intersection)/total
                if fraction <= 1e-8:
                    continue
                if not -1e-7 <= fraction <= 1+1e-7:
                    raise ValueError(f'Invalid coverage {region["id"]}: {fraction}')
                record = dict(name=str(row['ADMIN' if country else 'name']), fraction=round(min(1,max(0,fraction)),6))
                if country:
                    code = row['ISO_A3']; record['iso_a3'] = code if isinstance(code,str) and code != '-99' else None
                else:
                    record['country'] = str(row['admin'])
                records.append(record); intersections.append(intersection)
            if intersections and sum(area(g) for g in intersections)-area(unary_union(intersections)) > total*1e-6:
                warnings.append(f'{region["id"]}: overlapping administrative geometry; shares are not a partition')
            return sorted(records,key=lambda r:(-r['fraction'],r['name']))
        pieces = [polygon.intersection(land.iloc[i].geometry) for i in land.sindex.query(polygon,predicate='intersects')]
        fraction = area(unary_union(pieces))/total if pieces else 0
        if not -1e-7 <= fraction <= 1+1e-7:
            raise ValueError(f'Invalid land fraction {fraction}')
        latitude = (s+n)/2
        band = 'tropical' if abs(latitude)<23.5 else 'mid-latitude' if abs(latitude)<66.5 else 'polar'
        result[region['id']] = dict(center=[(w+e)/2,latitude], bounds=region['bounds'],latitude_band=f'{"Northern" if latitude>=0 else "Southern"} {band} latitude',land_fraction=round(min(1,max(0,fraction)),6),countries=overlaps(countries,True),admin1=overlaps(admin1))
    write(args.output,dict(schema_version=1,source='Local Natural Earth 1:110m',area_method='WGS84 / NSIDC EASE-Grid 2.0 Global equal-area (EPSG:6933); intersections in EPSG:4326',coverage_basis='Fraction of entire block; inland lakes follow physical land layer',sources=dict(countries=str(args.countries),admin1=str(args.admin1),land=str(args.land)),admin1_coverage=[] if admin1 is None else sorted(admin1.admin.unique().tolist()),warnings=warnings,geometry_diagnostics=DIAGNOSTICS,regions=result))
    print(f'Exported {len(result)} records; {len(warnings)} coverage warnings.')

if __name__ == '__main__':
    main()
