import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export type UrgencyLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FloodAlert {
  id: string;
  rawInput: string;
  message: string;
  location: string;
  city: string;
  urgency: UrgencyLevel;
  language: 'Cebuano' | 'Tagalog' | 'English';
  synthesizedOutput: string;
  alert: string;
  timestamp: string;
  status: 'Pending Review' | 'Verified' | 'Broadcasted' | 'Dismissed';
  coordinates: [number, number];
}

export interface TrendPoint {
  month: string;
  ndviLoss: number;
  floodReports: number;
}

export interface MapFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      barangay: string;
      city: string;
      ndvi_score: number;
      flood_risk_index: number;
      risk_level: RiskLevel;
      flood_depth_m: number;
      flood_timing: string;
      evacuation_center: string;
    };
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  }>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  ping(): Observable<any> {
    return this.http.get(`${this.baseUrl}/ping/`);
  }

  classifyMessage(message: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/classify/`, { message });
  }

  classifyBatch(messages: string[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/classify/batch/`, { messages });
  }

  getAlerts(): Observable<FloodAlert[]> {
    return of(MOCK_ALERTS);
  }

  getMapData(): Observable<MapFeatureCollection> {
    return of(MOCK_MAP_DATA);
  }

  getTrendData(): Observable<TrendPoint[]> {
    return of(MOCK_TRENDS);
  }
}

export const MOCK_ALERTS: FloodAlert[] = [
  {
    id: 'FG-001',
    rawInput: 'Baha na sa Lahug! Hapit na ang tubig sa among balay. Tabang!',
    message: 'Baha na sa Lahug! Hapit na ang tubig sa among balay. Tabang!',
    location: 'Lahug',
    city: 'Cebu City',
    urgency: 'HIGH',
    language: 'Cebuano',
    synthesizedOutput: 'FLOOD ALERT: Severe flooding expected in Lahug. Evacuate immediately to Lahug Elementary School.',
    alert: 'FLOOD ALERT: Severe flooding expected in Lahug. Evacuate immediately to Lahug Elementary School.',
    timestamp: '2026-05-10T09:38:00+08:00',
    status: 'Pending Review',
    coordinates: [10.3349, 123.899],
  },
  {
    id: 'FG-002',
    rawInput: 'Grabe ang ulan sa Talamban, naa nay baha sa kalsada.',
    message: 'Grabe ang ulan sa Talamban, naa nay baha sa kalsada.',
    location: 'Talamban',
    city: 'Cebu City',
    urgency: 'MEDIUM',
    language: 'Cebuano',
    synthesizedOutput: 'FLOOD WARNING: Water rising in Talamban. Prepare for possible evacuation.',
    alert: 'FLOOD WARNING: Water rising in Talamban. Prepare for possible evacuation.',
    timestamp: '2026-05-10T09:21:00+08:00',
    status: 'Verified',
    coordinates: [10.3702, 123.9142],
  },
  {
    id: 'FG-003',
    rawInput: 'Mataas ang tubig sa Mabolo papunta sa highway.',
    message: 'Mataas ang tubig sa Mabolo papunta sa highway.',
    location: 'Mabolo',
    city: 'Cebu City',
    urgency: 'HIGH',
    language: 'Tagalog',
    synthesizedOutput: 'BABALA SA BAHA: Malubhang pagbaha sa Mabolo. Lumikas agad sa Cebu City Sports Complex.',
    alert: 'BABALA SA BAHA: Malubhang pagbaha sa Mabolo. Lumikas agad sa Cebu City Sports Complex.',
    timestamp: '2026-05-10T09:12:00+08:00',
    status: 'Broadcasted',
    coordinates: [10.3245, 123.9149],
  },
  {
    id: 'FG-004',
    rawInput: 'Light flooding possible near Busay after continuous rain.',
    message: 'Light flooding possible near Busay after continuous rain.',
    location: 'Busay',
    city: 'Cebu City',
    urgency: 'LOW',
    language: 'English',
    synthesizedOutput: 'ADVISORY: Light flooding possible in Busay. Stay alert and monitor local updates.',
    alert: 'ADVISORY: Light flooding possible in Busay. Stay alert and monitor local updates.',
    timestamp: '2026-05-10T08:48:00+08:00',
    status: 'Verified',
    coordinates: [10.3713, 123.8855],
  },
];

const MOCK_TRENDS: TrendPoint[] = [
  { month: 'Dec', ndviLoss: 18, floodReports: 12 },
  { month: 'Jan', ndviLoss: 22, floodReports: 19 },
  { month: 'Feb', ndviLoss: 31, floodReports: 28 },
  { month: 'Mar', ndviLoss: 37, floodReports: 35 },
  { month: 'Apr', ndviLoss: 44, floodReports: 47 },
  { month: 'May', ndviLoss: 52, floodReports: 61 },
];

const MOCK_MAP_DATA: MapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { barangay: 'Mabolo', city: 'Cebu City', ndvi_score: 0.31, flood_risk_index: 88, risk_level: 'HIGH', flood_depth_m: 3.8, flood_timing: '~2 hours', evacuation_center: 'Cebu City Sports Complex' }, geometry: { type: 'Polygon', coordinates: [[[32, 31], [56, 26], [62, 47], [45, 61], [24, 52], [20, 39], [32, 31]]] } },
    { type: 'Feature', properties: { barangay: 'Lahug', city: 'Cebu City', ndvi_score: 0.28, flood_risk_index: 92, risk_level: 'CRITICAL', flood_depth_m: 3.4, flood_timing: '~90 min', evacuation_center: 'Lahug Elementary School' }, geometry: { type: 'Polygon', coordinates: [[[8, 36], [30, 22], [42, 36], [25, 61], [7, 70], [2, 51], [8, 36]]] } },
    { type: 'Feature', properties: { barangay: 'Talamban', city: 'Cebu City', ndvi_score: 0.43, flood_risk_index: 64, risk_level: 'MEDIUM', flood_depth_m: 1.5, flood_timing: '~4 hours', evacuation_center: 'Talamban Gym' }, geometry: { type: 'Polygon', coordinates: [[[57, 18], [96, 21], [98, 47], [78, 58], [61, 47], [57, 18]]] } },
    { type: 'Feature', properties: { barangay: 'Busay', city: 'Cebu City', ndvi_score: 0.69, flood_risk_index: 28, risk_level: 'LOW', flood_depth_m: 0.4, flood_timing: '~8 hours', evacuation_center: 'Busay Barangay Hall' }, geometry: { type: 'Polygon', coordinates: [[[28, 62], [62, 49], [83, 65], [71, 92], [28, 91], [16, 75], [28, 62]]] } },
  ],
};
