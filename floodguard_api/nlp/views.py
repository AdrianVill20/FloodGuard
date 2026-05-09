from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .classifier import classify_message
from .models import AlertReport


MOCK_ALERTS = [
    {
        "id": "FG-001",
        "rawInput": "Baha na sa Lahug! Hapit na ang tubig sa among balay. Tabang!",
        "message": "Baha na sa Lahug! Hapit na ang tubig sa among balay. Tabang!",
        "location": "Lahug",
        "city": "Cebu City",
        "urgency": "HIGH",
        "language": "Cebuano",
        "synthesizedOutput": "FLOOD ALERT: Severe flooding expected in Lahug. Evacuate immediately.",
        "alert": "FLOOD ALERT: Severe flooding expected in Lahug. Evacuate immediately.",
        "timestamp": "2026-05-10T09:38:00+08:00",
        "status": "Pending Review",
        "coordinates": [10.3349, 123.899],
    },
    {
        "id": "FG-002",
        "rawInput": "Grabe ang ulan sa Talamban, naa nay baha sa kalsada.",
        "message": "Grabe ang ulan sa Talamban, naa nay baha sa kalsada.",
        "location": "Talamban",
        "city": "Cebu City",
        "urgency": "MEDIUM",
        "language": "Cebuano",
        "synthesizedOutput": "FLOOD WARNING: Water rising in Talamban. Prepare for possible evacuation.",
        "alert": "FLOOD WARNING: Water rising in Talamban. Prepare for possible evacuation.",
        "timestamp": "2026-05-10T09:21:00+08:00",
        "status": "Verified",
        "coordinates": [10.3702, 123.9142],
    },
]

MOCK_MAP_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "barangay": "Mabolo",
                "city": "Cebu City",
                "ndvi_score": 0.31,
                "flood_risk_index": 88,
                "risk_level": "HIGH",
                "flood_depth_m": 3.8,
                "flood_timing": "~2 hours",
                "evacuation_center": "Cebu City Sports Complex",
            },
            "geometry": {"type": "Polygon", "coordinates": [[[123.90, 10.32], [123.92, 10.32], [123.92, 10.34], [123.90, 10.34], [123.90, 10.32]]]},
        }
    ],
}


@api_view(['GET'])
def ping(request):
    return Response({"status": "ok", "message": "FloodGuard ASEAN NLP API is running", "version": "1.0"})


@api_view(['POST'])
def classify(request):
    message = request.data.get('message', '').strip()
    if not message:
        return Response({"error": "No message provided"}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"status": "success", "data": classify_message(message)})


@api_view(['POST'])
def classify_batch(request):
    messages = request.data.get('messages', [])
    if not messages:
        return Response({"error": "No messages provided"}, status=status.HTTP_400_BAD_REQUEST)

    results = [classify_message(msg) for msg in messages]
    return Response({
        "status": "success",
        "total": len(results),
        "summary": {
            "HIGH": sum(1 for item in results if item['urgency'] == 'HIGH'),
            "MEDIUM": sum(1 for item in results if item['urgency'] == 'MEDIUM'),
            "LOW": sum(1 for item in results if item['urgency'] == 'LOW'),
        },
        "data": results,
    })


@api_view(['POST'])
def report(request):
    message = request.data.get('message', '').strip()
    if not message:
        return Response({"error": "No message provided"}, status=status.HTTP_400_BAD_REQUEST)

    result = classify_message(message)
    coordinates = request.data.get('coordinates') or [None, None]
    record = AlertReport.objects.create(
        raw_input=message,
        detected_location=result.get('location') or '',
        urgency=result['urgency'],
        language=result['language'],
        synthesized_output=result['alert'],
        latitude=coordinates[0],
        longitude=coordinates[1],
    )
    return Response({"status": "success", "data": serialize_report(record)}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def alerts(request):
    records = AlertReport.objects.all()[:100]
    if not records:
        return Response(MOCK_ALERTS)
    return Response([serialize_report(record) for record in records])


@api_view(['GET'])
def map_data(request):
    geojson_path = Path(settings.BASE_DIR) / 'data' / 'cebu_barangay_risk.geojson'
    if geojson_path.exists():
        import json
        with geojson_path.open('r', encoding='utf-8') as geojson_file:
            return Response(json.load(geojson_file))
    return Response(MOCK_MAP_DATA)


def serialize_report(record):
    location = record.detected_location or 'Unknown'
    return {
        "id": f"FG-{record.created_at:%y%m}-{record.id:03d}",
        "rawInput": record.raw_input,
        "message": record.raw_input,
        "location": location,
        "city": "Cebu City",
        "urgency": record.urgency,
        "language": record.language,
        "synthesizedOutput": record.synthesized_output,
        "alert": record.synthesized_output,
        "timestamp": record.created_at.isoformat(),
        "status": record.status,
        "coordinates": [record.latitude, record.longitude],
    }
