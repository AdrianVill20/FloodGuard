// ============================================================
// src/app/pages/dashboard/dashboard.page.ts
// FloodGuard ASEAN — LGU Dashboard with Sub-Barangay Heatmap
// ============================================================

import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class DashboardPage implements OnInit, AfterViewInit {

  barangays    : any[]    = [];
  isLoading    : boolean  = false;
  summary      : any      = { HIGH: 0, MODERATE: 0, LOW: 0 };
  selectedTab  : string   = 'map';
  activeLayer  : string   = 'flood'; // 'flood' or 'ndvi'
  selectedBarangay: string = '';

  reports      : any[]    = [];
  reportLoading: boolean  = false;

  private map         : any;
  private geojsonLayer: any;
  private heatLayer   : any;
  private currentPixels: any[] = [];

  sampleMessages = [
    "Baha na sa Lahug tabang!",
    "Mataas ang tubig sa Talisay papataas pa",
    "Ulan na sa Busay gamay pa",
    "Naiipit kami sa Ermita baha emergency",
    "Water rising in Lapu-Lapu road flooded",
    "Ambon sa Talamban basa ang dalan",
  ];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadBarangays();
    this.loadReports();
  }

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 500);
  }

  // --- Load barangay list ---
  loadBarangays() {
    this.isLoading = true;
    this.api.getBarangays().subscribe({
      next: (response: any) => {
        this.barangays = response.data.sort(
          (a: any, b: any) => b.flood_risk - a.flood_risk
        );
        this.summary   = response.summary;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  // --- Load citizen reports ---
  loadReports() {
    this.reportLoading = true;
    this.api.classifyBatch(this.sampleMessages).subscribe({
      next: (response: any) => {
        this.reports       = response.data;
        this.reportLoading = false;
      },
      error: () => { this.reportLoading = false; }
    });
  }

  // --- Initialize Leaflet map ---
  initMap() {
    if (this.map) return;

    this.map = L.map('flood-map', {
      center: [10.3157, 123.8854],
      zoom  : 12
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Load GeoJSON barangay polygons
    this.api.getBarangayMap().subscribe({
      next: (geojson: any) => {
        this.geojsonLayer = L.geoJSON(geojson, {
          style: (feature: any) => this.getBarangayStyle(feature),
          onEachFeature: (feature: any, layer: any) => {
            const p = feature.properties;
            layer.bindPopup(`
              <strong>${p.barangay}</strong><br/>
              Risk: <b style="color:${this.getRiskColor(p.risk_level)}">${p.risk_level}</b><br/>
              Flood Risk Index: ${p.flood_risk?.toFixed(4)}<br/>
              NDVI 2020: ${p.ndvi_2020?.toFixed(4)}<br/>
              Elevation: ${p.elevation_m?.toFixed(0)}m<br/>
              Deforested: ${p.deforested ? '⚠️ Yes' : '✅ No'}
            `);

            // Click → load sub-barangay heatmap
            layer.on('click', () => {
              this.loadBarangayHeatmap(p.barangay);
              this.map.fitBounds(layer.getBounds(), { padding: [20, 20] });
            });

            layer.on('mouseover', () => layer.openPopup());
          }
        }).addTo(this.map);
      }
    });
  }

  // --- Load sub-barangay heatmap on click ---
  loadBarangayHeatmap(barangayName: string) {
    this.selectedBarangay = barangayName;

    // Remove existing heatmap
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    this.api.getBarangayPixels(barangayName).subscribe({
      next: (response: any) => {
        this.currentPixels = response.pixels;
        this.renderHeatmap(this.activeLayer);
      },
      error: (err: any) => console.error('Pixel load error:', err)
    });
  }

  // --- Render heatmap based on active layer ---
  renderHeatmap(layerType: string) {
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    if (!this.currentPixels.length) return;

    const points = this.currentPixels.map((p: any) => {
      const intensity = layerType === 'flood'
        ? p.flood
        : (p.ndvi !== null ? 1 - p.ndvi : 0); // invert NDVI (low NDVI = high risk)
      return [p.lat, p.lon, intensity];
    });

    // Use Leaflet circle markers as heatmap fallback
    // (works without leaflet.heat plugin)
    const group = L.layerGroup();

    this.currentPixels.forEach((p: any) => {
      const value = layerType === 'flood'
        ? p.flood
        : (p.ndvi !== null ? 1 - p.ndvi : 0);

      const color = this.getHeatColor(value);

      L.circleMarker([p.lat, p.lon], {
        radius     : 6,
        fillColor  : color,
        fillOpacity: 0.75,
        color      : 'transparent',
        weight     : 0
      }).bindPopup(`
        <strong>${this.selectedBarangay}</strong><br/>
        ${layerType === 'flood' ? 'Flood Risk' : 'NDVI Risk'}: ${value.toFixed(4)}<br/>
        Elevation: ${p.elev?.toFixed(0)}m<br/>
        NDVI: ${p.ndvi?.toFixed(4)}
      `).addTo(group);
    });

    this.heatLayer = group;
    group.addTo(this.map);
  }

  // --- Switch between flood and NDVI layer ---
  switchLayer(layer: string) {
    this.activeLayer = layer;
    if (this.selectedBarangay) {
      this.renderHeatmap(layer);
    }
  }

  // --- Reset map to full Cebu City view ---
  resetMap() {
    this.selectedBarangay = '';
    this.currentPixels    = [];
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }
    this.map.setView([10.3157, 123.8854], 12);
  }

  // --- Color helpers ---
  getHeatColor(value: number): string {
    if (value >= 0.75) return '#e74c3c';
    if (value >= 0.60) return '#e67e22';
    if (value >= 0.45) return '#f1c40f';
    if (value >= 0.30) return '#2ecc71';
    return '#27ae60';
  }

  getBarangayStyle(feature: any) {
    const risk = feature.properties.risk_level;
    return {
      fillColor  : this.getRiskColor(risk),
      fillOpacity: 0.5,
      color      : '#333',
      weight     : 1
    };
  }

  getRiskColor(risk: string): string {
    if (risk === 'HIGH')     return '#e74c3c';
    if (risk === 'MODERATE') return '#f39c12';
    return '#27ae60';
  }

  getUrgencyColor(urgency: string): string {
    if (urgency === 'HIGH')   return 'danger';
    if (urgency === 'MEDIUM') return 'warning';
    return 'success';
  }

  getRiskBadgeColor(risk: string): string {
    if (risk === 'HIGH')     return 'danger';
    if (risk === 'MODERATE') return 'warning';
    return 'success';
  }

  switchTab(tab: string) {
    this.selectedTab = tab;
    if (tab === 'map') {
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 300);
    }
  }
}