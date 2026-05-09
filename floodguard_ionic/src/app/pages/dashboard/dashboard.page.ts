import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService, FloodAlert, MapFeatureCollection, TrendPoint } from '../../services/api';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class DashboardPage implements OnInit {
  reports: FloodAlert[] = [];
  mapData?: MapFeatureCollection;
  trends: TrendPoint[] = [];
  activeAlerts = 0;
  highRiskBarangays = 0;
  averageNdvi = 0;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.api.getAlerts().subscribe((alerts) => {
      this.reports = alerts;
      this.activeAlerts = alerts.filter((alert) => alert.urgency === 'HIGH').length;
    });
    this.api.getMapData().subscribe((mapData) => {
      this.mapData = mapData;
      this.highRiskBarangays = mapData.features.filter((feature) =>
        ['HIGH', 'CRITICAL'].includes(feature.properties.risk_level)
      ).length;
      this.averageNdvi = mapData.features.reduce((sum, feature) => sum + feature.properties.ndvi_score, 0) / mapData.features.length;
    });
    this.api.getTrendData().subscribe((trends) => this.trends = trends);
  }

  getTrendPoints(key: 'ndviLoss' | 'floodReports'): string {
    if (!this.trends.length) return '';
    const max = Math.max(...this.trends.map((point) => Math.max(point.ndviLoss, point.floodReports)));
    return this.trends.map((point, index) => {
      const x = (index / (this.trends.length - 1)) * 300;
      const y = 116 - (point[key] / max) * 94;
      return `${x},${y}`;
    }).join(' ');
  }

  getActivityTime(timestamp: string): string {
    return new Intl.DateTimeFormat('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(new Date(timestamp));
  }
}
