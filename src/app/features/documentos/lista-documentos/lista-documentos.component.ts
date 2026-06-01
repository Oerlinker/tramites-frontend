import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DocumentoService } from '../../../core/services/documento.service';
import { Documento } from '../../../shared/models';

@Component({
  selector: 'app-lista-documentos',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './lista-documentos.component.html',
  styleUrl: './lista-documentos.component.css',
})
export class ListaDocumentosComponent implements OnInit {
  private docService = inject(DocumentoService);

  documentos = signal<Documento[]>([]);
  loading = signal(false);
  error = signal('');

  tipoContexto: 'politica' | 'tramite' | 'actividad' = 'politica';
  contextoId = '';

  ngOnInit() {
    this.cargar(this.docService.getAll());
  }

  buscar() {
    const id = this.contextoId.trim();
    const obs$ = id
      ? (this.tipoContexto === 'politica'
          ? this.docService.getByPolitica(id)
          : this.tipoContexto === 'tramite'
            ? this.docService.getByTramite(id)
            : this.docService.getByActividad(id))
      : this.docService.getAll();
    this.cargar(obs$);
  }

  private cargar(obs$: ReturnType<typeof this.docService.getAll>) {
    this.loading.set(true);
    this.error.set('');
    obs$.subscribe({
      next: (docs) => {
        this.documentos.set(docs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar documentos');
        this.loading.set(false);
      },
    });
  }

  eliminar(doc: Documento) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    this.docService.eliminar(doc.id).subscribe({
      next: () => this.documentos.update(list => list.filter(d => d.id !== doc.id)),
      error: () => this.error.set('Error al eliminar el documento'),
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
