import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
  },

  {
    path: 'politicas/compartido/:token',
    loadComponent: () => import('./features/politicas/politica-ver/politica-ver.component')
      .then(m => m.PoliticaVerComponent)
  },

  {
    path: 'politicas',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    loadChildren: () => import('./features/politicas/politicas.routes').then(m => m.POLITICAS_ROUTES)
  },

  {
    path: 'tramites',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    loadChildren: () => import('./features/tramites/tramites.routes').then(m => m.TRAMITES_ROUTES)
  },

  {
    path: 'monitor',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    loadChildren: () => import('./features/monitor/monitor.routes').then(m => m.MONITOR_ROUTES)
  },

  {
    path: 'departamentos',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    loadChildren: () => import('./features/departamentos/departamentos.routes').then(m => m.DEPARTAMENTOS_ROUTES)
  },

  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    loadChildren: () => import('./features/usuarios/usuarios.routes').then(m => m.USUARIOS_ROUTES)
  },

  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component')
      .then(m => m.LayoutComponent),
    loadChildren: () => import('./features/perfil/perfil.routes')
      .then(m => m.PERFIL_ROUTES)
  },

  {
    path: 'analitica',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    loadChildren: () => import('./features/analitica/analitica.routes').then(m => m.ANALITICA_ROUTES)
  },

  { path: '**', redirectTo: '/dashboard' }
];
