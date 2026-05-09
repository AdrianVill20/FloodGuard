import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AlertsPage } from './alerts.page';

@NgModule({
  imports: [
    AlertsPage,
    RouterModule.forChild([{ path: '', component: AlertsPage }]),
  ],
})
export class AlertsPageModule {}
