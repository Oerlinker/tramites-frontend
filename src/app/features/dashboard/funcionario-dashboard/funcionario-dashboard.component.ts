import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-funcionario-dashboard',
  imports: [RouterLink],
  templateUrl: './funcionario-dashboard.component.html',
  styleUrl: './funcionario-dashboard.component.css'
})
export class FuncionarioDashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  pendientes = signal(0);
  enProceso = signal(0);
  actividadesRecientes = signal<any[]>([]);
  loading = signal(true);
  private _refreshInterval: any;

  ngOnInit() { this.load(); this._refreshInterval = setInterval(() => this.load(true), 10000); }
  ngOnDestroy() { if (this._refreshInterval) clearInterval(this._refreshInterval); }

  private load(silencioso = false) {
    this.api.get<any>('/monitor/mis-actividades', { page: 0, size: 100 }).subscribe({
      next: res => {
        const todas: any[] = Array.isArray(res) ? res : (res.content ?? []);
        this.pendientes.set(todas.filter(a => a.estado === 'PENDIENTE').length);
        this.enProceso.set(todas.filter(a => a.estado === 'EN_PROCESO').length);
        const activas = todas
          .filter(a => a.estado === 'PENDIENTE' || a.estado === 'EN_PROCESO')
          .slice(0, 5);
        this.actividadesRecientes.set(activas);
        if (!silencioso) this.loading.set(false);
      },
      error: () => { if (!silencioso) this.loading.set(false); }
    });
  }
}
