import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';

interface Analitica {
  totalTramites: number;
  tramitesPorEstado: Record<string, number>;
  totalActividades: number;
  actividadesPorEstado: Record<string, number>;
  actividadesPorDepartamento: Record<string, number>;
  duracionPromedioHoras: number;
  tramitesUltimos7Dias: number;
}

interface TFTiempo { tiempo_estimado_horas: number; }
interface TFAnomalia { es_anomalia: boolean; score: number; mensaje: string; }
interface TFExito { probabilidad: number; recomendacion: string; }

@Component({
  selector: 'app-analitica',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './analitica.component.html',
  styleUrl: './analitica.component.css'
})
export class AnaliticaComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  error = signal('');
  data = signal<Analitica | null>(null);
  tfTiempo = signal<TFTiempo | null>(null);
  tfAnomalia = signal<TFAnomalia | null>(null);
  tfExito = signal<TFExito | null>(null);
  loadingTF = signal(true);

  readonly estadoColores: Record<string, string> = {
    PENDIENTE:   '#f59e0b',
    EN_PROCESO:  '#3b82f6',
    COMPLETADO:  '#22c55e',
    RECHAZADO:   '#ef4444',
    CANCELADO:   '#9ca3af',
    OMITIDO:     '#9ca3af',
  };

  ngOnInit() {
    this.api.getAnalitica().subscribe({
      next: (res: any) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar analítica. Verifica que tienes permisos de administrador.');
        this.loading.set(false);
      }
    });

    forkJoin({
      tiempo: this.api.predecirTiempoTF({ orden: 2, num_campos: 3, hora: new Date().getHours(), dia: new Date().getDay() }).pipe(catchError(() => of(null))),
      anomalia: this.api.detectarAnomaliaTF({ tiempo_actual: this.data()?.duracionPromedioHoras ?? 4, tiempo_esperado: 4 }).pipe(catchError(() => of(null))),
      exito: this.api.predecirExitoTF({ orden_actual: 2, total_actividades: 4, completadas: this.data()?.totalActividades ?? 0 }).pipe(catchError(() => of(null)))
    }).subscribe(results => {
      if (results.tiempo) this.tfTiempo.set(results.tiempo as TFTiempo);
      if (results.anomalia) this.tfAnomalia.set(results.anomalia as TFAnomalia);
      if (results.exito) this.tfExito.set(results.exito as TFExito);
      this.loadingTF.set(false);
    });
  }

  entries(obj: Record<string, number> | undefined): [string, number][] {
    if (!obj) return [];
    return Object.entries(obj);
  }

  maxValue(obj: Record<string, number> | undefined): number {
    if (!obj) return 1;
    return Math.max(...Object.values(obj), 1);
  }

  barWidth(value: number, max: number): number {
    return Math.round((value / max) * 100);
  }

  departamentosCuello(obj: Record<string, number> | undefined): [string, number][] {
    if (!obj) return [];
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }
}
