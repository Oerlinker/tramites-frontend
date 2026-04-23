import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/guards/auth.guard';

export const MONITOR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard, roleGuard(['ADMIN', 'FUNCIONARIO'])],
    loadComponent: () => import('./monitor.component').then(m => m.MonitorComponent)
  }
];
