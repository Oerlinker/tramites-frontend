import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const PERFIL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./perfil.component').then(m => m.PerfilComponent)
  }
];
