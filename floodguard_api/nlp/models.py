from django.db import models


class AlertReport(models.Model):
    raw_input = models.TextField()
    detected_location = models.CharField(max_length=120, blank=True, default='')
    urgency = models.CharField(max_length=12)
    language = models.CharField(max_length=32)
    synthesized_output = models.TextField()
    status = models.CharField(max_length=32, default='Pending Review')
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.urgency} - {self.detected_location or "Unknown"}'
