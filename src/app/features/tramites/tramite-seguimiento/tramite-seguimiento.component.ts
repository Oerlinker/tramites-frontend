import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Tramite } from '../../../shared/models';

@Component({
  selector: 'app-tramite-seguimiento',
  imports: [RouterLink, FormsModule, SlicePipe],
  templateUrl: './tramite-seguimiento.component.html',
  styleUrl: './tramite-seguimiento.component.css'
})
export class TramiteSeguimientoComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);

  tramites = signal<Tramite[]>([]);
  totalPages = signal(1);
  currentPage = signal(0);
  loading = signal(true);
  error = signal('');
  filtroEstado = '';

  readonly estados = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'RECHAZADO', 'CANCELADO'];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string | number> = { page: this.currentPage(), size: 10 };
    if (this.filtroEstado) params['estado'] = this.filtroEstado;

    const role = this.auth.getUserRole();
    const endpoint = role === 'CLIENTE' ? '/tramites/mis-tramites' : '/tramites';

    this.api.get<any>(endpoint, params).subscribe({
      next: res => {
        const content = Array.isArray(res) ? res : (res.content || []);
        const total = res.totalElements || content.length;
        const size = 10;
        this.tramites.set(content);
        this.totalPages.set(Math.max(1, Math.ceil(total / size)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar trámites');
        this.loading.set(false);
      }
    });
  }

  cambiarEstado(tramiteId: string, estado: string) {
    this.api.patch<Tramite>(`/tramites/${tramiteId}/estado`, { estado, comentario: '' }).subscribe({
      next: updated => this.tramites.update(list => list.map(t => t.id === updated.id ? updated : t)),
      error: () => this.error.set('Error al cambiar estado')
    });
  }

  eliminarTramite(id: string) {
    if (!confirm('¿Eliminar este trámite permanentemente?')) return;
    this.api.delete<void>(`/tramites/${id}`).subscribe({
      next: () => this.tramites.update(list => list.filter(t => t.id !== id)),
      error: () => this.error.set('Error al eliminar trámite')
    });
  }

  prevPage() { if (this.currentPage() > 0) { this.currentPage.update(p => p - 1); this.load(); } }
  nextPage() { if (this.currentPage() < this.totalPages() - 1) { this.currentPage.update(p => p + 1); this.load(); } }
}
