import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-funcionario-dashboard',
  imports: [RouterLink],
  templateUrl: './funcionario-dashboard.component.html',
  styleUrl: './funcionario-dashboard.component.css'
})
export class FuncionarioDashboardComponent implements OnInit {
  private api = inject(ApiService);

  pendientes = signal(0);
  enProceso = signal(0);
  actividadesRecientes = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<any>('/monitor/mis-actividades', { page: 0, size: 100 }).subscribe({
      next: res => {
        const todas: any[] = Array.isArray(res) ? res : (res.content ?? []);
        this.pendientes.set(todas.filter(a => a.estado === 'PENDIENTE').length);
        this.enProceso.set(todas.filter(a => a.estado === 'EN_PROCESO').length);
        const activas = todas
          .filter(a => a.estado === 'PENDIENTE' || a.estado === 'EN_PROCESO')
          .slice(0, 5);
        this.actividadesRecientes.set(activas);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
