// ============================================================
// src/app/pages/dashboard/dashboard.page.ts
// FloodGuard ASEAN — Full Dashboard with Timeline Slider
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

  // --- State ---
  barangays       : any[]   = [];
  filteredBarangays: any[]   = [];  // ADD THIS
  searchQuery      : string  = '';  // ADD THIS
  isLoading       : boolean = false;
  summary         : any     = { HIGH: 0, MODERATE: 0, LOW: 0 };
  selectedTab     : string  = 'map';
  activeLayer     : string  = 'flood';
  selectedBarangay: string  = '';
  selectedYear    : number  = 2020;
  sliderYear      : number  = 2020;
  isSliderLoading : boolean = false;

  // Chart data
  chartData       : any     = null;
  showChart       : boolean = false;

  // Reports
  reports         : any[]   = [];
  reportLoading   : boolean = false;

  // Map
  private map         : any;
  private geojsonLayer: any;
  private heatLayer   : any;
  private currentPixels: any[] = [];
  private yearLayers  : any   = {};

  // Year slider config
  years        = [2010, 2011, 2012, 2013, 2014, 2015, 2016,
                  2017, 2018, 2019, 2020, 2021, 2022, 2023,
                  2024, 2025, 2026];
  partialYears = [2026];

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
        this.filteredBarangays = this.barangays; // ADD THIS
        this.summary           = response.summary;
        this.isLoading         = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  // --- Search barangays ---
  searchBarangays(event: any) {
    const query = event.detail.value?.toLowerCase().trim() || '';
    this.searchQuery = query;

    if (!query) {
      this.filteredBarangays = this.barangays;
      return;
    }

    this.filteredBarangays = this.barangays.filter(b =>
      b.barangay.toLowerCase().includes(query) ||
      b.risk_level.toLowerCase().includes(query)
    );
  }

  // --- Click barangay from list → show on map ---
  selectBarangayFromList(barangay: any) {
    // Step 1: Load chart data first (no map needed)
    this.loadBarangayChart(barangay.barangay);
    this.selectedBarangay = barangay.barangay;

    // Step 2: Switch to map tab
    this.selectedTab = 'map';

    // Step 3: Wait for map DOM to fully appear then interact
    setTimeout(() => {
      if (!this.map) {
        this.initMap();
      }

      this.map.invalidateSize();

      setTimeout(() => {
        this.api.getBarangayMap().subscribe({
          next: (geojson: any) => {
            const feature = geojson.features.find(
              (f: any) => f.properties.barangay === barangay.barangay
            );

            if (!feature) {
              console.warn('Feature not found:', barangay.barangay);
              return;
            }

            const tempLayer = L.geoJSON(feature);
            const bounds    = tempLayer.getBounds();

            this.map.invalidateSize();
            this.map.fitBounds(bounds, { padding: [40, 40] });

            // Blue highlight
            const highlight = L.geoJSON(feature, {
              style: {
                fillColor  : '#1a56a0',
                fillOpacity: 0.5,
                color      : '#1a56a0',
                weight     : 3
              }
            }).addTo(this.map);

            setTimeout(() => {
              this.map.removeLayer(highlight);
              this.loadBarangayHeatmap(barangay.barangay);
            }, 2000);
          }
        });
      }, 800);
    }, 800);
  } 
  // --- Load reports ---
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

  // --- Init map ---
  initMap() {
    if (this.map) return;

    this.map = L.map('flood-map', {
      center: [10.3157, 123.8854],
      zoom  : 12
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.loadYearSnapshot(this.selectedYear);
  }

  // --- Load year snapshot for slider ---
  loadYearSnapshot(year: number) {
    this.isSliderLoading = true;
    this.selectedYear    = year;

    // Remove existing year layer
    if (this.yearLayers[year]) {
      this.map.removeLayer(this.yearLayers[year]);
    }

    // Remove all year layers first
    Object.values(this.yearLayers).forEach((layer: any) => {
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });

    this.api.getYearSnapshot(year).subscribe({
      next: (response: any) => {
        const data = response.data;

        // Also load GeoJSON boundaries
        this.api.getBarangayMap().subscribe({
          next: (geojson: any) => {

            // Create lookup from snapshot
            const lookup: any = {};
            data.forEach((b: any) => { lookup[b.barangay] = b; });

            const layer = L.geoJSON(geojson, {
              style: (feature: any) => {
                const name  = feature.properties.barangay;
                const entry = lookup[name];
                const risk  = entry ? entry.risk_level : 'LOW';
                return {
                  fillColor  : this.getRiskColor(risk),
                  fillOpacity: 0.6,
                  color      : '#333',
                  weight     : 1
                };
              },
              onEachFeature: (feature: any, layer: any) => {
                const name  = feature.properties.barangay;
                const entry = lookup[name];
                layer.bindPopup(`
                  <strong>${name}</strong><br/>
                  Year: <b>${year}${this.partialYears.includes(year) ? ' (partial)' : ''}</b><br/>
                  Risk: <b style="color:${this.getRiskColor(entry?.risk_level)}">${entry?.risk_level || 'N/A'}</b><br/>
                  Flood Risk Index: ${entry?.flood_risk?.toFixed(4) || 'N/A'}<br/>
                  NDVI: ${entry?.ndvi?.toFixed(4) || 'N/A'}
                `, { autoPan: false });

                layer.on('click', () => {
                  this.loadBarangayChart(name);
                  this.loadBarangayHeatmap(name);
                  this.map.fitBounds(layer.getBounds(), { padding: [20, 20] });
                });

                layer.on('mouseover', function(this: any) {
                  this.setStyle({ weight: 2, fillOpacity: 0.8 });
                });

                layer.on('mouseout', function(this: any) {
                  this.setStyle({ weight: 1, fillOpacity: 0.6 });
                });
              }
            }).addTo(this.map);

            this.yearLayers[year]  = layer;
            this.isSliderLoading   = false;
          }
        });
      },
      error: () => { this.isSliderLoading = false; }
    });
  }

  // --- Year slider change ---
  onSliderChange(event: any) {
    const year = parseInt(event.detail.value);
    this.sliderYear = year;
    this.loadYearSnapshot(year);

    // Reload heatmap for new year if barangay selected
    if (this.selectedBarangay) {
      this.loadBarangayHeatmap(this.selectedBarangay);
    }
  }

  // --- Load time series chart for barangay ---
  loadBarangayChart(barangayName: string) {
    this.selectedBarangay = barangayName;
    this.showChart        = false;

    this.api.getBarangayTimeseries(barangayName).subscribe({
      next: (response: any) => {
        this.chartData = response;
        this.showChart = true;
        this.drawChart(response);
      },
      error: (err: any) => console.error(err)
    });
  }

  // --- Draw SVG chart ---
  drawChart(data: any) {
    setTimeout(() => {
      const canvas = document.getElementById('timeseries-chart') as HTMLCanvasElement;
      if (!canvas) return;

      const ctx    = canvas.getContext('2d');
      if (!ctx) return;

      const w      = canvas.width  = canvas.offsetWidth;
      const h      = canvas.height = 200;
      const pad    = { top: 20, right: 20, bottom: 30, left: 40 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top  - pad.bottom;

      ctx.clearRect(0, 0, w, h);

      const years     = data.years;
      const ndviVals  = data.ndvi.map((d: any) => d.value || 0);
      const riskVals  = data.flood_risk.map((d: any) => d.value || 0);
      const n         = years.length;

      const xPos = (i: number) => pad.left + (i / (n - 1)) * chartW;
      const yPos = (v: number) => pad.top  + (1 - v) * chartH;

      // Grid lines
      ctx.strokeStyle = '#eee';
      ctx.lineWidth   = 1;
      [0, 0.25, 0.5, 0.75, 1].forEach(v => {
        ctx.beginPath();
        ctx.moveTo(pad.left, yPos(v));
        ctx.lineTo(pad.left + chartW, yPos(v));
        ctx.stroke();
        ctx.fillStyle   = '#999';
        ctx.font        = '10px Arial';
        ctx.fillText(v.toFixed(2), 2, yPos(v) + 4);
      });

      // X axis labels
      ctx.fillStyle = '#666';
      ctx.font      = '10px Arial';
      years.forEach((yr: number, i: number) => {
        const partial = data.ndvi[i]?.partial;
        ctx.fillText(
          yr + (partial ? '*' : ''),
          xPos(i) - 10, h - 5
        );
      });

      // Draw flood risk line (red)
      ctx.beginPath();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth   = 2.5;
      riskVals.forEach((v: number, i: number) => {
        i === 0
          ? ctx.moveTo(xPos(i), yPos(v))
          : ctx.lineTo(xPos(i), yPos(v));
      });
      ctx.stroke();

      // Draw NDVI line (green)
      ctx.beginPath();
      ctx.strokeStyle = '#27ae60';
      ctx.lineWidth   = 2.5;
      ndviVals.forEach((v: number, i: number) => {
        i === 0
          ? ctx.moveTo(xPos(i), yPos(v))
          : ctx.lineTo(xPos(i), yPos(v));
      });
      ctx.stroke();

      // Dots
      riskVals.forEach((v: number, i: number) => {
        ctx.beginPath();
        ctx.arc(xPos(i), yPos(v), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
      });

      ndviVals.forEach((v: number, i: number) => {
        ctx.beginPath();
        ctx.arc(xPos(i), yPos(v), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#27ae60';
        ctx.fill();
      });

    }, 100);
  }

  // --- Load heatmap pixels ---
  loadBarangayHeatmap(barangayName: string) {
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    this.api.getBarangayPixels(barangayName).subscribe({
      next: (response: any) => {
        this.currentPixels = response.pixels;
        this.renderHeatmap(this.activeLayer);
      }
    });
  }

  // --- Render heatmap dots ---
  renderHeatmap(layerType: string) {
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }
    if (!this.currentPixels.length) return;

    const group = L.layerGroup();
    this.currentPixels.forEach((p: any) => {
      const value = layerType === 'flood'
        ? p.flood
        : (p.ndvi !== null ? 1 - p.ndvi : 0);

      L.circleMarker([p.lat, p.lon], {
        radius     : 6,
        fillColor  : this.getHeatColor(value),
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

  // --- Switch layer ---
  switchLayer(layer: string) {
    this.activeLayer = layer;
    if (this.selectedBarangay) this.renderHeatmap(layer);
  }

  // --- Reset map ---
  resetMap() {
    this.selectedBarangay = '';
    this.currentPixels    = [];
    this.showChart        = false;
    this.chartData        = null;
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