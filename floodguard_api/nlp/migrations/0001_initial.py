from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name='AlertReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('raw_input', models.TextField()),
                ('detected_location', models.CharField(blank=True, default='', max_length=120)),
                ('urgency', models.CharField(max_length=12)),
                ('language', models.CharField(max_length=32)),
                ('synthesized_output', models.TextField()),
                ('status', models.CharField(default='Pending Review', max_length=32)),
                ('latitude', models.FloatField(blank=True, null=True)),
                ('longitude', models.FloatField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
