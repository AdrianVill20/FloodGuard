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
# ENDPOINT 6: Get pixel data for sub-barangay heatmap
# GET /api/barangays/pixels/<barangay_name>/
# ----------------------------------------------------------
@api_view(['GET'])
def get_barangay_pixels(request, barangay_name):
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

        return Response({
            "status"  : "success",
            "barangay": matched_key,
            "total"   : len(pixels),
            "pixels"  : pixels
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )