import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardPage } from './dashboard.page';

@NgModule({
  imports: [
    DashboardPage,
    RouterModule.forChild([{ path: '', component: DashboardPage }])
  ]
})
export class DashboardPageModule {}