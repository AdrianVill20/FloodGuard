// ============================================================
// src/app/services/api.ts
// FloodGuard ASEAN — Django API Connection
// ============================================================

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  // Health check
  ping(): Observable<any> {
    return this.http.get(`${this.baseUrl}/ping/`);
  }

  // Classify single message
  classifyMessage(message: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/classify/`, { message });
  }

  // Classify batch messages
  classifyBatch(messages: string[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/classify/batch/`, { messages });
  }

  // Get all barangay flood risk data
  getBarangays(): Observable<any> {
    return this.http.get(`${this.baseUrl}/barangays/`);
  }

  // Get barangay GeoJSON for map
  getBarangayMap(): Observable<any> {
    return this.http.get(`${this.baseUrl}/barangays/map/`);
  }

  // Get pixel data for sub-barangay heatmap for a specific year
  // URL: /api/barangays/pixels/<barangay_name>/<year>/
  getBarangayPixels(barangayName: string, year: number): Observable<any> {
    const encoded = encodeURIComponent(barangayName);
    return this.http.get(`${this.baseUrl}/barangays/pixels/${encoded}/${year}/`);
  }

  // Get time series for one barangay
  getBarangayTimeseries(barangayName: string): Observable<any> {
    const encoded = encodeURIComponent(barangayName);
    return this.http.get(`${this.baseUrl}/barangays/timeseries/${encoded}/`);
  }

  // Get all barangays snapshot for a specific year (map slider)
  getYearSnapshot(year: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/barangays/timeseries/all/${year}/`);
  }
}