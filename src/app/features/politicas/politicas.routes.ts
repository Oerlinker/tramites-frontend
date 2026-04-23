import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/guards/auth.guard';

export const POLITICAS_ROUTES: Routes = [
  {
    path: 'compartido/:token',
    loadComponent: () => import('./politica-ver/politica-ver.component').then(m => m.PoliticaVerComponent)
  },
  {
    path: '',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    children: [
      {
        path: '',
        loadComponent: () => import('./politicas-list/politicas-list.component').then(m => m.PoliticasListComponent)
      },
      {
        path: 'nueva',
        loadComponent: () => import('./politica-diagramador/politica-diagramador.component').then(m => m.PoliticaDiagramadorComponent)
      },
      {
        path: 'editar/:id',
        loadComponent: () => import('./politica-diagramador/politica-diagramador.component').then(m => m.PoliticaDiagramadorComponent)
      },
      {
        path: 'ver/:id',
        loadComponent: () => import('./politica-ver/politica-ver.component').then(m => m.PoliticaVerComponent)
      },
      {
        path: 'colaborar/:id',
        canActivate: [authGuard, roleGuard(['ADMIN'])],
        loadComponent: () => import('./politica-diagramador/politica-diagramador.component')
          .then(m => m.PoliticaDiagramadorComponent)
      }
    ]
  }
];
