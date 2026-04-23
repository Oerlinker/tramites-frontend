import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Politica } from '../../../shared/models';

@Component({
  selector: 'app-politicas-list',
  imports: [RouterLink],
  templateUrl: './politicas-list.component.html',
  styleUrl: './politicas-list.component.css',
})
export class PoliticasListComponent implements OnInit {
  private api = inject(ApiService);

  politicas = signal<Politica[]>([]);
  loading = signal(true);
  error = signal('');

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.get<Politica[]>('/politicas').subscribe({
      next: (res) => {
        this.politicas.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar políticas');
        this.loading.set(false);
      },
    });
  }

  toggleActiva(p: Politica) {
    const endpoint = p.activa ? `/politicas/${p.id}/desactivar` : `/politicas/${p.id}/activar`;
    this.api.patch<Politica>(endpoint, {}).subscribe({
      next: (updated) => {
        this.politicas.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      },
      error: () => this.error.set('Error al cambiar estado'),
    });
  }

  eliminar(id: any) {
    if (!confirm('¿Eliminar esta política?')) return;
    this.api.delete<void>(`/politicas/${id}`).subscribe({
      next: () => this.politicas.update((list) => list.filter((p) => p.id !== id)),
      error: () => this.error.set('Error al eliminar'),
    });
  }
}
