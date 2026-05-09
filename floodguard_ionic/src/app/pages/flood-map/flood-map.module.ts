import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FloodMapPage } from './flood-map.page';

@NgModule({
  imports: [
    FloodMapPage,
    RouterModule.forChild([{ path: '', component: FloodMapPage }]),
  ],
})
export class FloodMapPageModule {}
