from django.apps import AppConfig


class NlpConfig(AppConfig):
    name = 'nlp'
    
    def ready(self):
        """Import signals when the app is ready"""
        import nlp.signals
