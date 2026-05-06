// ============================================================
// src/app/pages/report/report.page.ts
// ============================================================

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  styleUrls: ['./report.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class ReportPage {

  message  : string  = '';
  isLoading: boolean = false;
  result   : any     = null;
  errorMsg : string  = '';

  constructor(private api: ApiService) {}

  submitReport() {
    if (!this.message.trim()) {
      this.errorMsg = 'Please enter a message.';
      return;
    }
    this.isLoading = true;
    this.result    = null;
    this.errorMsg  = '';

    this.api.classifyMessage(this.message).subscribe({
      next: (response) => {
        this.result    = response.data;
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg  = 'Could not connect to server. Is Django running?';
        this.isLoading = false;
      }
    });
  }

  getUrgencyColor(): string {
    if (!this.result) return 'primary';
    if (this.result.urgency === 'HIGH')   return 'danger';
    if (this.result.urgency === 'MEDIUM') return 'warning';
    return 'success';
  }

  clearForm() {
    this.message = '';
    this.result  = null;
    this.errorMsg = '';
  }
}