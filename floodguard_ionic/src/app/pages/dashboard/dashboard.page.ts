// ============================================================
// src/app/pages/dashboard/dashboard.page.ts
// FloodGuard ASEAN — Full Dashboard with Timeline Slider
// ============================================================
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
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
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
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

  // Toggles
  heatmapVisible   : boolean = true;
  showBoundaries   : boolean = true;

  // Animation/Timelapse state
  isAnimating       : boolean = false;
  animationSpeed    : string  = 'medium'; // 'slow', 'medium', 'fast'
  private animationInterval: any = null;
  private animationSpeeds   : any = {
    'slow'  : 2000,  // 2 seconds per year
    'medium': 1000,  // 1 second per year
    'fast'  : 500    // 0.5 second per year
  };

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
  private map               : any;
  private geojsonLayer      : any;
  private heatLayer         : any;
  private clickOverlayGroup : any; // Layer group for invisible interactive circles
  private currentPixels     : any[] = [];
  private yearLayers        : any   = {};
  private labelLayers       : any   = {}; // Store label layers for each year
  private cityLabel         : any   = null; // City-level label

  // Pending heatmap subscription
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

  // --- Search fix ---
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

  // --- Dynamic deforestation status from NDVI ---
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

  // --- Toggle heatmap visibility ---
  toggleHeatmap() {
    this.heatmapVisible = !this.heatmapVisible;
    if (!this.map) return;

    if (this.heatmapVisible) {
      this.renderHeatmap(this.activeLayer);
    } else {
      if (this.heatLayer) this.map.removeLayer(this.heatLayer);
      if (this.clickOverlayGroup) this.clickOverlayGroup.clearLayers();
    }
  }

  // --- Toggle boundaries visibility ---
  toggleBoundaries() {
    this.showBoundaries = !this.showBoundaries;
    if (!this.map) return;

    const currentGeoJsonLayer = this.yearLayers[this.selectedYear];
    if (currentGeoJsonLayer) {
      if (this.showBoundaries) {
        currentGeoJsonLayer.addTo(this.map);
      } else {
        this.map.removeLayer(currentGeoJsonLayer);
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

    // Initialize the invisible click overlay group
    this.clickOverlayGroup = L.layerGroup().addTo(this.map);

    const baseMaps = {
      "Standard View" : standardMap,
      "Elevation View": topoMap
    };
    L.control.layers(baseMaps, undefined, { position: 'topright' }).addTo(this.map);

    // Create the city-level label (Cebu City)
    this.createCityLabel();

    // Listen to zoom changes to show/hide labels
    this.map.on('zoomend', () => {
      const currentZoom = this.map.getZoom();

      // Show/hide city label (when zoomed out)
      if (this.cityLabel) {
        if (currentZoom < 13) {
          if (!this.map.hasLayer(this.cityLabel)) {
            this.cityLabel.addTo(this.map);
          }
        } else {
          if (this.map.hasLayer(this.cityLabel)) {
            this.map.removeLayer(this.cityLabel);
          }
        }
      }

      // Show/hide barangay labels (when zoomed in)
      Object.values(this.labelLayers).forEach((labelLayer: any) => {
        if (currentZoom >= 13) {
          if (!this.map.hasLayer(labelLayer)) {
            labelLayer.addTo(this.map);
          }
        } else {
          if (this.map.hasLayer(labelLayer)) {
            this.map.removeLayer(labelLayer);
          }
        }
      });
    });

    this.loadYearSnapshot(this.selectedYear);
  }

  // --- Create city-level label (Cebu City) ---
  private createCityLabel(): void {
    // Position at the center of the map view
    const cityCenter = L.latLng(10.380, 123.870);

    const marker = L.marker(cityCenter, {
      icon: L.icon({
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        iconSize: [1, 1],
        className: 'fg-invisible-marker'
      })
    });

    const tooltip = L.tooltip({
      permanent: true,
      direction: 'center',
      className: 'fg-city-tooltip'
    });

    marker.bindTooltip(tooltip);
    tooltip.setContent('Cebu City');

    this.cityLabel = L.layerGroup([marker]);
  }

  // --- Get color based on NDVI value (vegetation health) ---
  // Green (healthy) → Yellow (moderate) → Red (deforested)
  getNDVIColor(ndvi: number | null | undefined): string {
    if (ndvi === null || ndvi === undefined) return '#999';
    if (ndvi >= 0.40) return '#27ae60'; // Green — Healthy forest
    if (ndvi >= 0.30) return '#f1c40f'; // Yellow — Moderate vegetation
    if (ndvi >= 0.20) return '#e67e22'; // Orange — Some deforestation
    return '#e74c3c'; // Red — Severe deforestation
  }

  // --- Get color based on Flood Risk value ---
  // Green (low risk) → Yellow (moderate) → Red (high risk)
  getFloodRiskLevelColor(floodRisk: number | null | undefined): string {
    if (floodRisk === null || floodRisk === undefined) return '#999';
    if (floodRisk < 0.40) return '#27ae60'; // Green — Low risk
    if (floodRisk < 0.60) return '#f1c40f'; // Yellow — Moderate risk
    if (floodRisk < 0.75) return '#e67e22'; // Orange — High risk
    return '#e74c3c'; // Red — Critical risk
  }

  // --- Load year snapshot for MAP slider ---
  // Now dynamically colors based on NDVI or Flood Risk depending on activeLayer
  loadYearSnapshot(year: number) {
    this.isSliderLoading = true;
    this.selectedYear    = year;
    
    // Remove old layers
    Object.values(this.yearLayers).forEach((layer: any) => {
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });
    
    // Remove old labels
    Object.values(this.labelLayers).forEach((labelLayer: any) => {
      if (this.map.hasLayer(labelLayer)) this.map.removeLayer(labelLayer);
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
                
                // Choose color based on active layer (NDVI or Flood Risk)
                let fillColor = '#999';
                if (entry) {
                  if (this.activeLayer === 'ndvi') {
                    fillColor = this.getNDVIColor(entry.ndvi);
                  } else {
                    fillColor = this.getFloodRiskLevelColor(entry.flood_risk);
                  }
                }
                
                return {
                  fillColor  : fillColor,
                  fillOpacity: 0.7,
                  color      : '#333',
                  weight     : 1
                };
              },
              onEachFeature: (feature: any, layer: any) => {
                const name  = feature.properties.barangay;
                const entry = lookup[name];
                const ndvi  = entry?.ndvi?.toFixed(4) || 'N/A';
                const risk  = entry?.flood_risk?.toFixed(4) || 'N/A';
                
                layer.bindPopup(`
                  <strong>${name}</strong><br/>
                  Year: <b>${year}${this.partialYears.includes(year) ? ' (partial)' : ''}</b><br/>
                  <span style="color:${this.getFloodRiskLevelColor(entry?.flood_risk)}">🌊 Flood Risk: ${risk}</span><br/>
                  <span style="color:${this.getNDVIColor(entry?.ndvi)}">🌳 NDVI: ${ndvi}</span>
                `, { autoPan: false });

                layer.on('click', (e: any) => {
                  L.DomEvent.stopPropagation(e);
                  this.loadBarangayChart(name);
                  this.loadBarangayHeatmap(name);
                });

                layer.on('mouseover', function(this: any) {
                  this.setStyle({ weight: 2, fillOpacity: 0.9 });
                });
                layer.on('mouseout', function(this: any) {
                  this.setStyle({ weight: 1, fillOpacity: 0.7 });
                });
              }
            });

            // Respect boundary toggle when adding the new layer
            if (this.showBoundaries) {
              layer.addTo(this.map);
            }

            // Create and add labels
            const labelLayer = this.createBarangayLabels(geojson, lookup);
            
            // Only add labels if zoom level is appropriate
            if (this.map.getZoom() >= 13) {
              labelLayer.addTo(this.map);
            }

            // Show/hide city label based on zoom
            if (this.cityLabel) {
              if (this.map.getZoom() < 13) {
                if (!this.map.hasLayer(this.cityLabel)) {
                  this.cityLabel.addTo(this.map);
                }
              } else {
                if (this.map.hasLayer(this.cityLabel)) {
                  this.map.removeLayer(this.cityLabel);
                }
              }
            }

            this.yearLayers[year]  = layer;
            this.labelLayers[year] = labelLayer;
            this.isSliderLoading   = false;
          }
        });
      },
      error: () => { this.isSliderLoading = false; }
    });
  }

  // --- Create barangay label markers ---
  private createBarangayLabels(geojson: any, lookup: any): any {
    const labelGroup = L.layerGroup();

    geojson.features.forEach((feature: any) => {
      const name = feature.properties.barangay;

      // Get the center of the polygon
      const geoJsonLayer = L.geoJSON(feature);
      const bounds = geoJsonLayer.getBounds();
      const center = bounds.getCenter();

      // Create a point marker at the center (invisible, just for positioning)
      const pointMarker = L.marker(center, {
        icon: L.icon({
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          iconSize: [1, 1],
          className: 'fg-invisible-marker'
        })
      });

      // Add a permanent tooltip with the barangay name
      const tooltip = L.tooltip({
        permanent: true,
        direction: 'center',
        className: 'fg-barangay-tooltip'
      });

      pointMarker.bindTooltip(tooltip);
      tooltip.setContent(name);

      labelGroup.addLayer(pointMarker);
    });

    return labelGroup;
  }

  // --- Map year slider change ---
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
    if (this.heatmapSub) {
      this.heatmapSub.unsubscribe();
      this.heatmapSub = null;
    }

    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    if (this.clickOverlayGroup) {
      this.clickOverlayGroup.clearLayers();
    }

    this.currentPixels    = [];
    this.selectedBarangay = barangayName;

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

  // --- Render heatmap dots and invisible overlay ---
  renderHeatmap(layerType: string) {
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    if (this.clickOverlayGroup) {
      this.clickOverlayGroup.clearLayers();
    }

    if (!this.currentPixels.length) return;

    // --- Custom gradients ---
    // NDVI: dark green (healthy/low intensity) → red (barren/high intensity)
    const ndviGradient  = { 0.0: 'darkgreen', 0.3: 'yellow', 0.6: 'orange', 1.0: 'red' };
    // Flood: cyan (low risk) → purple (high risk)
    const floodGradient = { 0.2: 'cyan', 0.5: 'blue', 0.8: 'darkblue', 1.0: 'purple' };

    // --- NDVI: compute data-driven max from positive pixels only ---
    // We do NOT use a hardcoded ceiling like 0.8 because real pixel values may
    // cluster in 0.2–0.5, making everything look barren against a 0.8 scale.
    // Instead, find the actual max positive NDVI in this dataset, then use that
    // as the "fully healthy" anchor. Combined with max:1.0 on the heatLayer,
    // the gradient is still globally absolute but calibrated to real data range.
    const positiveNdviPixels = this.currentPixels
      .map((p: any) => (p.ndvi !== null && p.ndvi !== undefined) ? p.ndvi : 0)
      .filter((v: number) => v > 0);

    // Healthy anchor: use the 90th-percentile positive NDVI value so a few
    // outlier high pixels don't compress everything else toward "barren".
    // Falls back to 0.5 if there are no positive pixels at all.
    let ndviHealthyMax = 0.5;
    if (positiveNdviPixels.length > 0) {
      const sorted = [...positiveNdviPixels].sort((a, b) => a - b);
      const p90idx = Math.floor(sorted.length * 0.90);
      ndviHealthyMax = sorted[p90idx] ?? sorted[sorted.length - 1];
      // Enforce a minimum floor so the scale never collapses on sparse data
      ndviHealthyMax = Math.max(ndviHealthyMax, 0.3);
    }

    const heatData = this.currentPixels.map((p: any) => {
      let intensity = 0;

      if (layerType === 'ndvi') {
        const rawNdvi = (p.ndvi !== null && p.ndvi !== undefined) ? p.ndvi : 0;

        if (rawNdvi < 0) {
          // Water / cloud pixels: 0 intensity → dark green end, not red
          intensity = 0;
        } else {
          // Remap [0 … ndviHealthyMax] → intensity [1.0 … 0.0]
          // Anything at or above the healthy anchor maps to 0 (fully green).
          // Anything at 0 maps to 1.0 (fully red / barren).
          const clampedNdvi = Math.min(rawNdvi, ndviHealthyMax);
          intensity = 1.0 - (clampedNdvi / ndviHealthyMax);
          intensity = Math.max(0, Math.min(1.0, intensity));
        }

      } else if (layerType === 'flood') {
        // Backend may send flood risk as 0–100 (percentage) or 0.0–1.0.
        // Normalise to 0.0–1.0 regardless.
        let rawFlood = (p.flood !== null && p.flood !== undefined) ? p.flood : 0;
        if (rawFlood > 1.0) {
          rawFlood = rawFlood / 100.0;
        }
        intensity = Math.max(0, Math.min(1.0, rawFlood));
      }

      return [p.lat, p.lon, intensity];
    });

    const activeGradient = layerType === 'flood' ? floodGradient : ndviGradient;

    this.heatLayer = (L as any).heatLayer(heatData, {
      radius    : 20,
      blur      : 15,
      minOpacity: 0.6,
      maxZoom   : 16,
      // FIX: lock the gradient to an absolute global scale of 1.0.
      // Without this, Leaflet.heat autoscales to the highest value in the
      // current dataset, making every barangay look identically "severe".
      max       : 1.0,
      gradient  : activeGradient
    });

    if (this.heatmapVisible) {
      this.heatLayer.addTo(this.map);

      // Create invisible clickable overlay for pixel-level popups
      for (const p of this.currentPixels) {
        const circle = L.circleMarker([p.lat, p.lon], {
          radius     : 12,
          opacity    : 0,
          fillOpacity: 0,
          interactive: true
        });

        circle.bindPopup(`
          <strong>${this.selectedBarangay}</strong><br/>
          Year: <b>${this.sliderYear}</b><br/>
          NDVI: <b>${p.ndvi !== undefined && p.ndvi !== null ? p.ndvi.toFixed(4) : 'N/A'}</b><br/>
          Flood Risk: <b>${p.flood !== undefined && p.flood !== null ? p.flood.toFixed(4) : 'N/A'}</b><br/>
          Elevation: <b>${p.elev !== undefined && p.elev !== null ? p.elev + ' m' : 'N/A'}</b>
        `);

        this.clickOverlayGroup.addLayer(circle);
      }
    }
  }

  // --- Switch layer ---
  // Also refreshes map colors when switching between NDVI and Flood Risk
  switchLayer(layer: string) {
    this.activeLayer = layer;
    
    // Refresh heatmap for selected barangay
    if (this.selectedBarangay) {
      this.renderHeatmap(layer);
    }
    
    // Refresh map colors for current year
    if (this.map && this.yearLayers[this.selectedYear]) {
      this.loadYearSnapshot(this.selectedYear);
    }
  }

  // --- Table sorting ---
  sortTable(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn    = column;
      this.sortDirection = 'asc';
    }

    this.filteredBarangays.sort((a: any, b: any) => {
      let valA = a[column];
      let valB = b[column];

      if (typeof valA === 'string' && !isNaN(parseFloat(valA))) {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
      }

      if (valA == null) valA = '';
      if (valB == null) valB = '';

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
    if (this.clickOverlayGroup) {
      this.clickOverlayGroup.clearLayers();
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

  // ============================================================
  // TIMELAPSE ANIMATION METHODS
  // ============================================================

  // --- Play animation: cycle through years from 2010 to 2026 ---
  playAnimation() {
    if (this.isAnimating) return; // Already playing

    this.isAnimating = true;
    
    // Reset to 2010 if at the end
    if (this.sliderYear >= 2026) {
      this.sliderYear = 2010;
    }

    const speed = this.animationSpeeds[this.animationSpeed as keyof typeof this.animationSpeeds] || 1000;

    this.animationInterval = setInterval(() => {
      if (this.sliderYear < 2026) {
        this.sliderYear += 1;
        this.loadYearSnapshot(this.sliderYear);
        
        // Also update heatmap if a barangay is selected
        if (this.selectedBarangay) {
          this.loadBarangayHeatmap(this.selectedBarangay);
        }
      } else {
        // Loop back to start
        this.sliderYear = 2010;
        this.loadYearSnapshot(this.sliderYear);
        if (this.selectedBarangay) {
          this.loadBarangayHeatmap(this.selectedBarangay);
        }
      }
    }, speed);
  }

  // --- Pause animation ---
  pauseAnimation() {
    if (!this.isAnimating) return;
    
    this.isAnimating = false;
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  // --- Stop animation and reset to 2010 ---
  stopAnimation() {
    this.isAnimating = false;
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    
    this.sliderYear = 2010;
    this.loadYearSnapshot(2010);
    if (this.selectedBarangay) {
      this.loadBarangayHeatmap(this.selectedBarangay);
    }
  }

  // --- Change animation speed ---
  changeAnimationSpeed(speed: string) {
    const wasAnimating = this.isAnimating;
    
    // Pause current animation if running
    if (this.isAnimating) {
      this.pauseAnimation();
    }
    
    this.animationSpeed = speed;
    
    // Resume with new speed if it was animating
    if (wasAnimating) {
      this.playAnimation();
    }
  }

  // --- Clean up animation on component destroy ---
  ngOnDestroy() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    if (this.heatmapSub) {
      this.heatmapSub.unsubscribe();
    }
  }
}