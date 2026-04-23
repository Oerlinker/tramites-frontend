import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const TRAMITES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./tramite-seguimiento/tramite-seguimiento.component').then(m => m.TramiteSeguimientoComponent)
      },
      {
        path: 'iniciar',
        loadComponent: () => import('./tramite-iniciar/tramite-iniciar.component').then(m => m.TramiteIniciarComponent)
      }
    ]
  }
];
