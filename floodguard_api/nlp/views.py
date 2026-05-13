# ============================================================
# nlp/views.py
# FloodGuard ASEAN — API Endpoints
# ============================================================
import json
import os
from django.conf import settings

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .classifier import classify_message

# ----------------------------------------------------------
# ENDPOINT 1: Health Check
# GET /api/ping
# ----------------------------------------------------------
@api_view(['GET'])
def ping(request):
    return Response({
        "status" : "ok",
        "message": "FloodGuard ASEAN NLP API is running",
        "version": "1.0"
    })

# ----------------------------------------------------------
# ENDPOINT 2: Classify single message
# POST /api/classify
# Body: { "message": "Baha na sa Lahug tabang" }
# ----------------------------------------------------------
@api_view(['POST'])
def classify(request):
    try:
        message = request.data.get('message', '').strip()

        if not message:
            return Response(
                {"error": "No message provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = classify_message(message)

        return Response({
            "status" : "success",
            "data"   : result
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ----------------------------------------------------------
# ENDPOINT 3: Batch classify multiple messages
# POST /api/classify/batch
# Body: { "messages": ["msg1", "msg2", ...] }
# ----------------------------------------------------------
@api_view(['POST'])
def classify_batch(request):
    try:
        messages = request.data.get('messages', [])

        if not messages:
            return Response(
                {"error": "No messages provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        results = [classify_message(msg) for msg in messages]

        high   = sum(1 for r in results if r['urgency'] == 'HIGH')
        medium = sum(1 for r in results if r['urgency'] == 'MEDIUM')
        low    = sum(1 for r in results if r['urgency'] == 'LOW')

        return Response({
            "status" : "success",
            "total"  : len(results),
            "summary": {
                "HIGH"  : high,
                "MEDIUM": medium,
                "LOW"   : low
            },
            "data": results
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    

# ----------------------------------------------------------
# ENDPOINT 4: Get all barangay flood risk data
# GET /api/barangays/
# ----------------------------------------------------------
@api_view(['GET'])
def get_barangays(request):
    try:
        json_path = os.path.join(
            settings.BASE_DIR, 'static', 'data',
            'cebu_barangay_flood_risk.json'
        )
        with open(json_path, 'r') as f:
            data = json.load(f)

        # Summary counts
        high     = sum(1 for b in data if b['risk_level'] == 'HIGH')
        moderate = sum(1 for b in data if b['risk_level'] == 'MODERATE')
        low      = sum(1 for b in data if b['risk_level'] == 'LOW')

        return Response({
            "status" : "success",
            "total"  : len(data),
            "summary": {
                "HIGH"    : high,
                "MODERATE": moderate,
                "LOW"     : low
            },
            "data": data
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ----------------------------------------------------------
# ENDPOINT 5: Get barangay GeoJSON for map
# GET /api/barangays/map/
# ----------------------------------------------------------
@api_view(['GET'])
def get_barangay_map(request):
    try:
        geojson_path = os.path.join(
            settings.BASE_DIR, 'static', 'data',
            'cebu_barangay_map.geojson'
        )
        with open(geojson_path, 'r') as f:
            data = json.load(f)

        return Response(data)

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
# ----------------------------------------------------------
# ENDPOINT 6: Get pixel data for sub-barangay heatmap (year-aware)
# GET /api/barangays/pixels/<barangay_name>/<year>/
# ----------------------------------------------------------
@api_view(['GET'])
def get_barangay_pixels(request, barangay_name, year):
    try:
        pixels_path = os.path.join(
            settings.BASE_DIR, 'static', 'data',
            'cebu_barangay_pixels.json'
        )
        with open(pixels_path, 'r') as f:
            all_pixels = json.load(f)

        # Find the barangay (case-insensitive)
        matched_key = None
        for key in all_pixels.keys():
            if key.lower() == barangay_name.lower():
                matched_key = key
                break

        if not matched_key:
            return Response(
                {"error": f"Barangay '{barangay_name}' not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        pixels = all_pixels[matched_key]

        # Load timeseries data to apply year-specific flood risk values
        try:
            timeseries_path = os.path.join(
                settings.BASE_DIR, 'static', 'data',
                'cebu_barangay_timeseries.json'
            )
            with open(timeseries_path, 'r') as f:
                timeseries_data = json.load(f)
            
            year_str = str(year)
            if matched_key in timeseries_data and year_str in timeseries_data[matched_key]:
                year_entry = timeseries_data[matched_key][year_str]
                year_flood_risk = year_entry.get('flood_risk')
                year_ndvi = year_entry.get('ndvi')
                
                # Apply year-specific values to pixels
                if year_flood_risk is not None or year_ndvi is not None:
                    pixels = [dict(p) for p in pixels]  # Deep copy to avoid modifying original
                    for pixel in pixels:
                        if year_flood_risk is not None:
                            pixel['flood'] = year_flood_risk
                        if year_ndvi is not None:
                            pixel['ndvi'] = year_ndvi
        except Exception as e:
            # If timeseries loading fails, just use static pixel data
            pass

        return Response({
            "status"  : "success",
            "barangay": matched_key,
            "year"    : year,
            "total"   : len(pixels),
            "pixels"  : pixels
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
# ----------------------------------------------------------
# ENDPOINT 7: Get time series data for a barangay
# GET /api/barangays/timeseries/<barangay_name>/
# ----------------------------------------------------------
@api_view(['GET'])
def get_barangay_timeseries(request, barangay_name):
    try:
        path = os.path.join(
            settings.BASE_DIR, 'static', 'data',
            'cebu_barangay_timeseries.json'
        )
        with open(path, 'r') as f:
            all_data = json.load(f)

        # Case-insensitive match
        matched_key = None
        for key in all_data.keys():
            if key.lower() == barangay_name.lower():
                matched_key = key
                break

        if not matched_key:
            return Response(
                {"error": f"Barangay '{barangay_name}' not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        data = all_data[matched_key]

        # Format for chart
        years      = sorted(data.keys())
        ndvi_series = []
        risk_series = []

        for year in years:
            ndvi_series.append({
                "year"   : int(year),
                "value"  : data[year]['ndvi'],
                "partial": data[year]['partial']
            })
            risk_series.append({
                "year"   : int(year),
                "value"  : data[year]['flood_risk'],
                "partial": data[year]['partial']
            })

        return Response({
            "status"    : "success",
            "barangay"  : matched_key,
            "ndvi"      : ndvi_series,
            "flood_risk": risk_series,
            "years"     : [int(y) for y in years],
            "note"      : "2026 data is partial (Jan-Apr only)"
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ----------------------------------------------------------
# ENDPOINT 8: Get all barangays time series (for map slider)
# GET /api/barangays/timeseries/all/<year>/
# ----------------------------------------------------------
@api_view(['GET'])
def get_year_snapshot(request, year):
    try:
        path = os.path.join(
            settings.BASE_DIR, 'static', 'data',
            'cebu_barangay_timeseries.json'
        )
        with open(path, 'r') as f:
            all_data = json.load(f)

        year_str  = str(year)
        snapshot  = []

        for barangay, years in all_data.items():
            if year_str in years:
                entry = years[year_str]
                flood = entry.get('flood_risk', None)

                if flood is not None:
                    if flood >= 0.70:
                        risk_level = "HIGH"
                    elif flood >= 0.50:
                        risk_level = "MODERATE"
                    else:
                        risk_level = "LOW"
                else:
                    risk_level = "UNKNOWN"

                snapshot.append({
                    "barangay"  : barangay,
                    "year"      : year,
                    "ndvi"      : entry.get('ndvi'),
                    "flood_risk": flood,
                    "risk_level": risk_level,
                    "partial"   : entry.get('partial', False)
                })

        return Response({
            "status"  : "success",
            "year"    : year,
            "total"   : len(snapshot),
            "data"    : snapshot
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )