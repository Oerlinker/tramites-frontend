import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Documento } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private api = inject(ApiService);

  upload(file: File, politicaId?: string, tramiteId?: string, actividadId?: string): Observable<Documento> {
    const form = new FormData();
    form.append('file', file);
    if (politicaId) form.append('politicaId', politicaId);
    if (tramiteId) form.append('tramiteId', tramiteId);
    if (actividadId) form.append('actividadId', actividadId);
    return this.api.post<Documento>('/documentos/upload', form);
  }

  getAll(): Observable<Documento[]> {
    return this.api.get<Documento[]>('/documentos');
  }

  getByPolitica(politicaId: string): Observable<Documento[]> {
    return this.api.get<Documento[]>(`/documentos/politica/${politicaId}`);
  }

  getByTramite(tramiteId: string): Observable<Documento[]> {
    return this.api.get<Documento[]>(`/documentos/tramite/${tramiteId}`);
  }

  getByActividad(actividadId: string): Observable<Documento[]> {
    return this.api.get<Documento[]>(`/documentos/actividad/${actividadId}`);
  }

  eliminar(id: string): Observable<void> {
    return this.api.delete<void>(`/documentos/${id}`);
  }
}
