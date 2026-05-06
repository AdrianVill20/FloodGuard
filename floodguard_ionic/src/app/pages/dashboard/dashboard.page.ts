// ============================================================
// src/app/pages/dashboard/dashboard.page.ts
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class DashboardPage implements OnInit {

  reports  : any[]   = [];
  isLoading: boolean = false;
  summary  : any     = { HIGH: 0, MEDIUM: 0, LOW: 0 };

  // Sample reports for LGU dashboard demo
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
    this.loadDashboard();
  }

  loadDashboard() {
    this.isLoading = true;
    this.api.classifyBatch(this.sampleMessages).subscribe({
      next: (response) => {
        this.reports   = response.data;
        this.summary   = response.summary;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  getUrgencyColor(urgency: string): string {
    if (urgency === 'HIGH')   return 'danger';
    if (urgency === 'MEDIUM') return 'warning';
    return 'success';
  }
}