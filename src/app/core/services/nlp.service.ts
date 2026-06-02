import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CampoSugerido {
  nombre: string;
  etiqueta: string;
  tipo: string;
  requerido: boolean;
  placeholder?: string;
}

export interface RecomendacionPolitica {
  politica_id: string;
  politica_nombre: string;
  confianza: number;
  razon: string;
}

@Injectable({ providedIn: 'root' })
export class NlpService {
  private http = inject(HttpClient);
  private baseUrl = environment.iaUrl;

  sugerirFormulario(descripcion: string): Observable<{ campos: CampoSugerido[] }> {
    return this.http.post<{ campos: CampoSugerido[] }>(
      `${this.baseUrl}/api/ia/sugerir-formulario`,
      { descripcion }
    );
  }

  recomendarPolitica(descripcion: string, politicas: any[]): Observable<RecomendacionPolitica> {
    return this.http.post<RecomendacionPolitica>(
      `${this.baseUrl}/api/ia/recomendar-politica`,
      { descripcion, politicas }
    );
  }
}
