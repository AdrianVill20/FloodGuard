# ============================================================
# nlp/urls.py
# FloodGuard ASEAN — NLP URL Routing
# ============================================================

from django.urls import path
from . import views

urlpatterns = [
    path('ping/',             views.ping,           name='ping'),
    path('classify/',         views.classify,        name='classify'),
    path('classify/batch/',   views.classify_batch,  name='classify_batch'),
    path('report/',           views.report,          name='report'),
    path('alerts/',           views.alerts,          name='alerts'),
    path('map-data/',         views.map_data,        name='map_data'),
]
