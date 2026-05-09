import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService, FloodAlert, MapFeatureCollection } from '../../services/api';

type MapLayer = 'risk' | 'ndvi' | 'alerts';

@Component({
  selector: 'app-flood-map',
  templateUrl: './flood-map.page.html',
  styleUrls: ['./flood-map.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class FloodMapPage implements OnInit {
  activeLayer: MapLayer = 'risk';
  selectedBarangay = 0;
  selectedAlert?: FloodAlert;
  mapData?: MapFeatureCollection;
  alerts: FloodAlert[] = [];
  mapTiles = this.buildTiles();

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMapData().subscribe((mapData) => this.mapData = mapData);
    this.api.getAlerts().subscribe((alerts) => {
      this.alerts = alerts;
      this.selectedAlert = alerts[0];
    });
  }

  setLayer(layer: MapLayer) {
    this.activeLayer = layer;
  }

  selectFeature(index: number) {
    this.selectedBarangay = index;
  }

  selectAlert(alert: FloodAlert) {
    this.selectedAlert = alert;
  }

  get selectedFeature() {
    return this.mapData?.features[this.selectedBarangay];
  }

  getPolygonClass(feature: MapFeatureCollection['features'][number]): string {
    if (this.activeLayer === 'ndvi') {
      if (feature.properties.ndvi_score >= 0.6) return 'ndvi-high';
      if (feature.properties.ndvi_score >= 0.4) return 'ndvi-mid';
      return 'ndvi-low';
    }
    return feature.properties.risk_level.toLowerCase();
  }

  getMarkerPosition(alert: FloodAlert) {
    const positions: Record<string, { left: string; top: string }> = {
      Lahug: { left: '34%', top: '45%' },
      Talamban: { left: '68%', top: '33%' },
      Mabolo: { left: '52%', top: '52%' },
      Busay: { left: '49%', top: '70%' },
    };
    return positions[alert.location] ?? { left: '50%', top: '50%' };
  }

  private buildTiles() {
    const zoom = 13;
    const centerX = 6915;
    const centerY = 3859;
    const tiles = [];

    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col++) {
        tiles.push({
          src: `https://tile.openstreetmap.org/${zoom}/${centerX + col}/${centerY + row}.png`,
          left: `${(col + 1) * 33.3333}%`,
          top: `${(row + 1) * 33.3333}%`,
        });
      }
    }

    return tiles;
  }
}
