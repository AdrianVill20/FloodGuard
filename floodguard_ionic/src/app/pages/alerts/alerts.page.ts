import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService, FloodAlert, UrgencyLevel } from '../../services/api';

type AlertFilter = 'ALL' | UrgencyLevel;
type SortMode = 'urgency' | 'time' | 'location';

@Component({
  selector: 'app-alerts',
  templateUrl: './alerts.page.html',
  styleUrls: ['./alerts.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class AlertsPage implements OnInit {
  alerts: FloodAlert[] = [];
  filter: AlertFilter = 'ALL';
  sortMode: SortMode = 'urgency';
  query = '';

  private urgencyRank: Record<UrgencyLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getAlerts().subscribe((alerts) => this.alerts = alerts);
  }

  get filteredAlerts(): FloodAlert[] {
    const query = this.query.trim().toLowerCase();
    return this.alerts
      .filter((alert) => this.filter === 'ALL' || alert.urgency === this.filter)
      .filter((alert) => !query || [alert.rawInput, alert.location, alert.city, alert.language, alert.synthesizedOutput].some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (this.sortMode === 'urgency') return this.urgencyRank[b.urgency] - this.urgencyRank[a.urgency];
        if (this.sortMode === 'location') return a.location.localeCompare(b.location);
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }

  setFilter(filter: AlertFilter) {
    this.filter = filter;
  }

  setSortMode(sortMode: SortMode) {
    this.sortMode = sortMode;
  }

  getTime(timestamp: string): string {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(new Date(timestamp));
  }
}
