# ============================================================
# nlp/views.py
# FloodGuard ASEAN — API Endpoints
# ============================================================

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