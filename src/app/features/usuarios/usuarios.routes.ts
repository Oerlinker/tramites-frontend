import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';

export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard(['ADMIN'])],
    loadComponent: () => import('./usuarios.component').then(m => m.UsuariosComponent)
  }
];
