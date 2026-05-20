from django.db import models
from django.contrib.auth.models import User


class Report(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    DISASTER_TYPES = [
        ('flooding', 'Flooding'),
        ('storm', 'Storm'),
        ('landslide', 'Landslide'),
        ('tree_damage', 'Tree Damage'),
        ('fire', 'Fire'),
        ('earthquake', 'Earthquake'),
        ('unknown', 'Unknown'),
    ]

    report_text = models.TextField()
    detected_barangay = models.CharField(max_length=100, blank=True, null=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='low')
    disaster_type = models.CharField(max_length=20, choices=DISASTER_TYPES, default='flooding')
    confidence = models.FloatField(default=0.0)
    keywords = models.JSONField(default=list, blank=True)
    matched_entities = models.JSONField(default=list, blank=True)
    reported_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-reported_at']

    def __str__(self):
        return f"Report: {self.detected_barangay or 'Unknown'} - {self.severity}"
