import { Routes } from '@angular/router';

export const DOCUMENTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./lista-documentos/lista-documentos.component')
      .then(m => m.ListaDocumentosComponent)
  },
  {
    path: 'upload',
    loadComponent: () => import('./upload-documento/upload-documento.component')
      .then(m => m.UploadDocumentoComponent)
  }
];
