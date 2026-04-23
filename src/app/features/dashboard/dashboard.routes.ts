import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/guards/auth.guard';
import { inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'admin',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () =>
          import('./admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'funcionario',
        canActivate: [roleGuard(['FUNCIONARIO'])],
        loadComponent: () =>
          import('./funcionario-dashboard/funcionario-dashboard.component').then(
            (m) => m.FuncionarioDashboardComponent,
          ),
      },
      {
        path: 'cliente',
        canActivate: [roleGuard(['CLIENTE'])],
        loadComponent: () =>
          import('./cliente-dashboard/cliente-dashboard.component').then(
            (m) => m.ClienteDashboardComponent,
          ),
      },
      {
        path: '',
        loadComponent: () =>
          import('./admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
        canMatch: [() => inject(AuthService).getUserRole() === 'ADMIN'],
      },
      {
        path: '',
        loadComponent: () =>
          import('./funcionario-dashboard/funcionario-dashboard.component').then(
            (m) => m.FuncionarioDashboardComponent,
          ),
        canMatch: [() => inject(AuthService).getUserRole() === 'FUNCIONARIO'],
      },
      { path: '', redirectTo: 'cliente', pathMatch: 'full' },
    ],
  },
];
