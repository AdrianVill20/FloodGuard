from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'detected_barangay', 'severity', 'disaster_type', 'confidence', 'reported_at')
    list_filter = ('severity', 'disaster_type', 'reported_at')
    search_fields = ('report_text', 'detected_barangay', 'keywords')
    readonly_fields = ('reported_at', 'id')
    
    fieldsets = (
        ('Report Content', {
            'fields': ('id', 'report_text', 'detected_barangay')
        }),
        ('Analysis Results', {
            'fields': ('severity', 'disaster_type', 'confidence', 'keywords', 'matched_entities')
        }),
        ('Metadata', {
            'fields': ('user', 'reported_at')
        }),
    )
    
    def has_add_permission(self, request):
        # Prevent manual creation via admin (only via API)
        return False
