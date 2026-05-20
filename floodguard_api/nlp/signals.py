# ============================================================
# nlp/signals.py
# FloodGuard ASEAN — Django Signals
# ============================================================

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Report


@receiver(post_save, sender=Report)
def on_report_created(sender, instance, created, **kwargs):
    """
    Signal handler triggered when a new report is created.
    Can be used for notifications, webhooks, or other async tasks in the future.
    """
    if created:
        # Log report creation
        print(f"[REPORT] New report created: {instance.id} - {instance.detected_barangay} ({instance.severity})")
        # Future: send notifications, trigger alerts, etc.
