import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface Analitica {
  totalTramites: number;
  tramitesPorEstado: Record<string, number>;
  totalActividades: number;
  actividadesPorEstado: Record<string, number>;
  actividadesPorDepartamento: Record<string, number>;
  duracionPromedioHoras: number;
  tramitesUltimos7Dias: number;
}

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
