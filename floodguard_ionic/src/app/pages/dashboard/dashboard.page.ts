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
import 'leaflet.heat';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class DashboardPage implements OnInit, AfterViewInit {
  // --- State ---
  barangays        : any[]   = [];
  filteredBarangays: any[]   = [];
  searchQuery      : string  = '';
  isLoading        : boolean = false;
  summary          : any     = { HIGH: 0, MODERATE: 0, LOW: 0 };
  selectedTab      : string  = 'map';
  activeLayer      : string  = 'flood';
  selectedBarangay : string  = '';
  selectedYear     : number  = 2020;
  sliderYear       : number  = 2020;
  isSliderLoading  : boolean = false;

  // Table slider state
  tableYear           : number  = 2020;
  isTableSliderLoading: boolean = false;
  private tableYearLookup: any  = {};

  // Task 2: Heatmap toggle
  heatmapVisible   : boolean = true;

  // Table sorting
  sortColumn       : string  = 'barangay';
  sortDirection    : string  = 'asc'; // 'asc' or 'desc'

  // Chart data
  chartData        : any     = null;
  showChart        : boolean = false;

  // Reports
  reports          : any[]   = [];
  reportLoading    : boolean = false;

  // Map
  private map          : any;
  private geojsonLayer : any;
  private heatLayer    : any;
  private currentPixels: any[] = [];
  private yearLayers   : any   = {};

  // Pending heatmap subscription — cancel if slider moves again quickly
  private heatmapSub   : any   = null;

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

  ionViewWillEnter() {
    this.loadBarangays();
  }

  handleRefresh(event: any) {
    this.loadBarangays();
    this.loadReports();
    setTimeout(() => event.target.complete(), 1500);
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
        this.loadTableYearSnapshot(this.tableYear);
      },
      error: () => { this.isLoading = false; }
    });
  }

  // --- Load year snapshot data for the TABLE slider ---
  loadTableYearSnapshot(year: number) {
    this.isTableSliderLoading = true;
    this.api.getYearSnapshot(year).subscribe({
      next: (response: any) => {
        this.tableYearLookup = {};
        response.data.forEach((entry: any) => {
          this.tableYearLookup[entry.barangay] = entry;
        });
        this.barangays = this.barangays.map((b: any) => {
          const snapshot = this.tableYearLookup[b.barangay];
          return {
            ...b,
            ndvi      : snapshot ? snapshot.ndvi       : null,
            risk_level: snapshot ? snapshot.risk_level : b.risk_level,
            flood_risk: snapshot ? snapshot.flood_risk : b.flood_risk,
          };
        });
        this.applySearch();
        this.isTableSliderLoading = false;
      },
      error: () => { this.isTableSliderLoading = false; }
    });
  }

  // --- Table slider change handler ---
  onTableSliderChange(event: any) {
    this.tableYear = parseInt(event.detail.value);
    this.loadTableYearSnapshot(this.tableYear);
  }

  // --- Task 1: Search fix ---
  applySearch() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredBarangays = this.barangays;
      return;
    }
    this.filteredBarangays = this.barangays.filter(b =>
      b.barangay.toLowerCase().includes(query) ||
      b.risk_level.toLowerCase().includes(query)
    );
  }

  searchBarangays(event: any) {
    this.searchQuery = (event.target?.value ?? event.detail?.value ?? '').toLowerCase().trim();
    this.applySearch();
  }

  // --- Task 3: Dynamic deforestation status from NDVI ---
  getDeforestationStatus(ndvi: number | null | undefined): string {
    if (ndvi === null || ndvi === undefined) return 'Unknown';
    if (ndvi < 0.2)  return 'Severely Deforested';
    if (ndvi < 0.4)  return 'Mildly Deforested';
    return 'Healthy';
  }

  getDeforestationChipClass(ndvi: number | null | undefined): string {
    if (ndvi === null || ndvi === undefined) return '';
    if (ndvi < 0.2)  return 'fg-chip--danger';
    if (ndvi < 0.4)  return 'fg-chip--warning';
    return 'fg-chip--success';
  }

  // --- Task 2: Toggle heatmap visibility ---
  toggleHeatmap() {
    this.heatmapVisible = !this.heatmapVisible;
    if (!this.map) return;
    
    // If heatmap not yet rendered but we're turning it on, render it
    if (this.heatmapVisible && !this.heatLayer && this.currentPixels.length > 0) {
      this.renderHeatmap(this.activeLayer);
      return;
    }
    
    // If heatmap exists, add or remove it
    if (this.heatLayer) {
      if (this.heatmapVisible) {
        this.heatLayer.addTo(this.map);
      } else {
        this.map.removeLayer(this.heatLayer);
      }
    }
  }

  // --- Click barangay from list → show on map ---
  selectBarangayFromList(barangay: any) {
    this.loadBarangayChart(barangay.barangay);
    this.selectedBarangay = barangay.barangay;
    this.selectedTab      = 'map';
    setTimeout(() => {
      if (!this.map) this.initMap();
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
              // Pass the current sliderYear so the heatmap reflects the selected year
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

    const standardMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });

    const topoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri'
    });

    this.map = L.map('flood-map', {
      center: [10.3157, 123.8854],
      zoom  : 12,
      layers: [standardMap]
    });

    const baseMaps = {
      "Standard View" : standardMap,
      "Elevation View": topoMap
    };
    L.control.layers(baseMaps, undefined, { position: 'topright' }).addTo(this.map);

    this.map.on('click', (e: any) => this.handleMapClick(e));

    this.loadYearSnapshot(this.selectedYear);
  }

  // --- Heatmap Click Handler ---
  handleMapClick(e: any) {
    if (!this.heatmapVisible || !this.currentPixels || this.currentPixels.length === 0) return;

    let closestPixel = null;
    let minDistance  = Infinity;

    for (const p of this.currentPixels) {
      const pixelLatLng = L.latLng(p.lat, p.lon);
      const dist        = this.map.distance(e.latlng, pixelLatLng);
      if (dist < minDistance) {
        minDistance  = dist;
        closestPixel = p;
      }
    }

    if (closestPixel && minDistance < 60) {
      const clampedNdvi = closestPixel.ndvi !== null ? Math.max(0, closestPixel.ndvi) : 0;
      const value       = this.activeLayer === 'flood'
        ? closestPixel.flood
        : (closestPixel.ndvi !== null ? 1 - clampedNdvi : 0);

      L.popup()
        .setLatLng([closestPixel.lat, closestPixel.lon])
        .setContent(`
          <strong>${this.selectedBarangay}</strong><br/>
          Year: <b>${this.sliderYear}</b><br/>
          ${this.activeLayer === 'flood' ? 'Flood Risk' : 'NDVI Risk'}: ${value.toFixed(4)}<br/>
          NDVI: ${closestPixel.ndvi !== undefined && closestPixel.ndvi !== null ? closestPixel.ndvi.toFixed(4) : 'N/A'}
        `)
        .openOn(this.map);
    }
  }

  // --- Load year snapshot for MAP slider ---
  loadYearSnapshot(year: number) {
    this.isSliderLoading = true;
    this.selectedYear    = year;
    Object.values(this.yearLayers).forEach((layer: any) => {
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });
    this.api.getYearSnapshot(year).subscribe({
      next: (response: any) => {
        const data = response.data;
        this.api.getBarangayMap().subscribe({
          next: (geojson: any) => {
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
            this.yearLayers[year] = layer;
            this.isSliderLoading  = false;
          }
        });
      },
      error: () => { this.isSliderLoading = false; }
    });
  }

  // --- Map year slider change ---
  // Updates sliderYear, reloads the choropleth snapshot AND re-fetches heatmap
  // pixels for the currently selected barangay so dots update reactively.
  onSliderChange(event: any) {
    const year      = parseInt(event.detail.value);
    this.sliderYear = year;
    this.loadYearSnapshot(year);
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
      const years    = data.years;
      const ndviVals = data.ndvi.map((d: any) => d.value || 0);
      const riskVals = data.flood_risk.map((d: any) => d.value || 0);
      const n        = years.length;
      const xPos = (i: number) => pad.left + (i / (n - 1)) * chartW;
      const yPos = (v: number) => pad.top  + (1 - v) * chartH;
      ctx.strokeStyle = '#eee';
      ctx.lineWidth   = 1;
      [0, 0.25, 0.5, 0.75, 1].forEach(v => {
        ctx.beginPath();
        ctx.moveTo(pad.left, yPos(v));
        ctx.lineTo(pad.left + chartW, yPos(v));
        ctx.stroke();
        ctx.fillStyle = '#999';
        ctx.font      = '10px Arial';
        ctx.fillText(v.toFixed(2), 2, yPos(v) + 4);
      });
      ctx.fillStyle = '#666';
      ctx.font      = '10px Arial';
      years.forEach((yr: number, i: number) => {
        const partial = data.ndvi[i]?.partial;
        ctx.fillText(yr + (partial ? '*' : ''), xPos(i) - 10, h - 5);
      });
      ctx.beginPath();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth   = 2.5;
      riskVals.forEach((v: number, i: number) => {
        i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v));
      });
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = '#27ae60';
      ctx.lineWidth   = 2.5;
      ndviVals.forEach((v: number, i: number) => {
        i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v));
      });
      ctx.stroke();
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

  // --- Load heatmap pixels for a barangay at the current sliderYear ---
  loadBarangayHeatmap(barangayName: string) {
    // Cancel any in-flight request
    if (this.heatmapSub) {
      this.heatmapSub.unsubscribe();
      this.heatmapSub = null;
    }

    // Clear existing heat layer immediately so the map doesn't show stale data
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }
    this.currentPixels    = [];
    this.selectedBarangay = barangayName;

    // Request pixels for the currently active slider year
    this.heatmapSub = this.api.getBarangayPixels(barangayName, this.sliderYear).subscribe({
      next: (response: any) => {
        this.currentPixels = response.pixels;
        this.renderHeatmap(this.activeLayer);
        this.heatmapSub = null;
      },
      error: (err: any) => {
        console.error('Heatmap load error:', err);
        this.heatmapSub = null;
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

    const heatData = this.currentPixels.map((p: any) => {
      const clampedNdvi = p.ndvi !== null ? Math.max(0, p.ndvi) : 0;
      const value       = layerType === 'flood'
        ? p.flood
        : (p.ndvi !== null ? 1 - clampedNdvi : 0);
      return [p.lat, p.lon, value];
    });

    this.heatLayer = (L as any).heatLayer(heatData, {
      radius    : 20,
      blur      : 15,
      minOpacity: 0.6,
      maxZoom   : 16,
      gradient  : {
        0.00: '#27ae60',
        0.30: '#2ecc71',
        0.45: '#f1c40f',
        0.60: '#e67e22',
        0.75: '#e74c3c',
        1.00: '#e74c3c'
      }
    });

    if (this.heatmapVisible) {
      this.heatLayer.addTo(this.map);
    }
  }

  // --- Switch layer ---
  switchLayer(layer: string) {
    this.activeLayer = layer;
    if (this.selectedBarangay) this.renderHeatmap(layer);
  }

  // --- Table sorting ---
  sortTable(column: string) {
    // Toggle direction if clicking same column
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    // Sort the filtered barangays
    this.filteredBarangays.sort((a: any, b: any) => {
      let valA = a[column];
      let valB = b[column];

      // Handle numeric strings and numbers
      if (typeof valA === 'string' && !isNaN(parseFloat(valA))) {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
      }

      // Handle null/undefined
      if (valA == null) valA = '';
      if (valB == null) valB = '';

      // Case-insensitive string comparison
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (this.sortDirection === 'asc') {
        return valA < valB ? -1 : valA > valB ? 1 : 0;
      } else {
        return valA > valB ? -1 : valA < valB ? 1 : 0;
      }
    });
  }

  // --- Get sort indicator ---
  getSortIndicator(column: string): string {
    if (this.sortColumn !== column) return '';
    return this.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  // --- Reset map ---
  resetMap() {
    this.selectedBarangay = '';
    this.currentPixels    = [];
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }
    this.map.setView([10.3157, 123.8854], 12);
  }

  // --- Risk color helper ---
  getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'HIGH'    : return '#e74c3c';
      case 'MODERATE': return '#e67e22';
      case 'LOW'     : return '#27ae60';
      default        : return '#95a5a6';
    }
  }

  // --- Switch tab ---
  switchTab(tab: string) {
    this.selectedTab = tab;
    if (tab === 'map') {
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 300);
    }
  }

  // --- Color helper for heatmap ---
  getHeatColor(value: number): string {
    if (value >= 0.75) return '#e74c3c';
    if (value >= 0.60) return '#e67e22';
    if (value >= 0.45) return '#f1c40f';
    if (value >= 0.30) return '#2ecc71';
    return '#27ae60';
  }

  // --- Urgency color helper ---
  getUrgencyColor(urgency: string): string {
    if (urgency === 'HIGH')   return 'danger';
    if (urgency === 'MEDIUM') return 'warning';
    return 'success';
  }

  // --- Risk badge color helper ---
  getRiskBadgeColor(risk: string): string {
    if (risk === 'HIGH')     return 'danger';
    if (risk === 'MODERATE') return 'warning';
    return 'success';
  }
}