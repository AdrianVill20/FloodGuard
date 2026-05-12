# ============================================================
# nlp/urls.py
# FloodGuard ASEAN — NLP URL Routing
# ============================================================

from django.urls import path
from . import views

urlpatterns = [
    path('ping/',                           views.ping,                  name='ping'),
    path('classify/',                       views.classify,              name='classify'),
    path('classify/batch/',                 views.classify_batch,        name='classify_batch'),
    path('barangays/',                      views.get_barangays,         name='barangays'),
    path('barangays/map/',                  views.get_barangay_map,      name='barangay_map'),
    path('barangays/pixels/<str:barangay_name>/',
         views.get_barangay_pixels,         name='barangay_pixels'),
    path('barangays/timeseries/<str:barangay_name>/',
         views.get_barangay_timeseries,     name='barangay_timeseries'),
    path('barangays/timeseries/all/<int:year>/',
         views.get_year_snapshot,           name='year_snapshot'),
]