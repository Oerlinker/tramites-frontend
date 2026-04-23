import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const ANALITICA_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./analitica.component').then(m => m.AnaliticaComponent)
  }
];
