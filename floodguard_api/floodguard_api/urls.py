# ============================================================
# floodguard_api/urls.py
# FloodGuard ASEAN — Main URL Config
# ============================================================

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/',  admin.site.urls),
    path('api/',    include('nlp.urls')),
]