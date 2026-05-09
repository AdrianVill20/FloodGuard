"""
Weekly Earth Engine ETL for FloodGuard ASEAN.

Loads Cebu barangay boundaries from a Google Earth Engine asset, calculates
2010/2020 dry-season NDVI change, derives flood risk, and writes GeoJSON for
GET /api/map-data.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Cebu barangay NDVI flood-risk GeoJSON.")
    parser.add_argument("--project", required=True, help="Google Earth Engine project ID.")
    parser.add_argument("--asset", required=True, help="GEE FeatureCollection asset ID.")
    parser.add_argument("--output", default="data/cebu_barangay_risk.geojson", help="Output GeoJSON path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    import ee

    ee.Initialize(project=args.project)
    barangays = ee.FeatureCollection(args.asset)
    province_boundary = barangays.geometry()

    dem = ee.Image("USGS/SRTMGL1_003").clip(province_boundary)
    land_mask = dem.gt(2)
    slope = ee.Terrain.slope(dem).rename("slope_degrees")

    landsat_2020 = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(province_boundary)
        .filterDate("2019-11-01", "2020-04-30")
        .filter(ee.Filter.lt("CLOUD_COVER", 15))
        .median()
        .clip(province_boundary)
    )
    ndvi_2020 = landsat_2020.normalizedDifference(["SR_B5", "SR_B4"]).rename("NDVI_2020").updateMask(land_mask)

    landsat_2010 = (
        ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
        .filterBounds(province_boundary)
        .filterDate("2009-11-01", "2010-04-30")
        .filter(ee.Filter.lt("CLOUD_COVER", 20))
        .median()
        .clip(province_boundary)
    )
    ndvi_2010 = landsat_2010.normalizedDifference(["SR_B4", "SR_B3"]).rename("NDVI_2010").updateMask(land_mask)
    ndvi_change = ndvi_2010.subtract(ndvi_2020).rename("NDVI_Change")
    deforested_area = ndvi_change.gt(0.15).multiply(ee.Image.pixelArea()).rename("deforested_area_m2")
    analysis_img = ndvi_2010.addBands(ndvi_2020).addBands(ndvi_change).addBands(deforested_area).addBands(slope)

    features = []
    muni_list = barangays.aggregate_array("muni_name").distinct().sort().getInfo()
    for municipality in muni_list:
        stats = analysis_img.reduceRegions(
            collection=barangays.filter(ee.Filter.eq("muni_name", municipality)),
            reducer=ee.Reducer.mean().combine(ee.Reducer.sum(), sharedInputs=True),
            scale=30,
            tileScale=4,
        ).getInfo()
        for feature in stats["features"]:
            props = feature["properties"]
            ndvi_score = round(props.get("NDVI_2020_mean") or 0, 4)
            ndvi_loss = max(props.get("NDVI_Change_mean") or 0, 0)
            deforested_ha = (props.get("deforested_area_m2_sum") or 0) / 10_000
            risk_index = calculate_risk_index(ndvi_score, ndvi_loss, deforested_ha, props.get("slope_degrees_mean") or 0)
            feature["properties"].update({
                "barangay": props.get("brgy_name", "Unknown"),
                "city": props.get("muni_name", municipality),
                "ndvi_score": ndvi_score,
                "ndvi_change": round(ndvi_loss, 4),
                "deforested_ha": round(deforested_ha, 2),
                "flood_risk_index": risk_index,
                "risk_level": risk_level(risk_index),
            })
            features.append(feature)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    print(f"Wrote {len(features)} enriched barangays to {output}")


def calculate_risk_index(ndvi_score: float, ndvi_loss: float, deforested_ha: float, slope_degrees: float) -> int:
    return round(
        max(0, min(1, 1 - ndvi_score)) * 45
        + max(0, min(1, ndvi_loss / 0.35)) * 30
        + max(0, min(1, deforested_ha / 75)) * 15
        + max(0, min(1, slope_degrees / 35)) * 10
    )


def risk_level(index: int) -> str:
    if index >= 85:
        return "CRITICAL"
    if index >= 65:
        return "HIGH"
    if index >= 40:
        return "MEDIUM"
    return "LOW"


if __name__ == "__main__":
    main()
