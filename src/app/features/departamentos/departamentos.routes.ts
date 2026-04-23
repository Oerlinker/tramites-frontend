import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/guards/auth.guard';

export const DEPARTAMENTOS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadComponent: () => import('./departamentos.component').then(m => m.DepartamentosComponent)
  }
];
