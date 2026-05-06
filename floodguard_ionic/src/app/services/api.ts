// ============================================================
// src/app/services/api.service.ts
// FloodGuard ASEAN — Django API Connection
// ============================================================

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // Your Django backend URL
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
}