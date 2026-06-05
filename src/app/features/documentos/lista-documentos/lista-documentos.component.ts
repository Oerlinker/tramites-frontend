import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentoService } from '../../../core/services/documento.service';
import { Documento } from '../../../shared/models';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-lista-documentos',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './lista-documentos.component.html',
  styleUrl: './lista-documentos.component.css',
})
export class ListaDocumentosComponent implements OnInit {
  private docService = inject(DocumentoService);
  private sanitizer = inject(DomSanitizer);
  private api = inject(ApiService);

  documentos = signal<Documento[]>([]);
  loading = signal(false);
  error = signal('');
  docVisor = signal<Documento | null>(null);

  tipoContexto: 'politica' | 'tramite' | 'actividad' = 'politica';
  contextoId = '';

  vistaActiva: 'lista' | 'jerarquica' = 'lista';
  politicas = signal<any[]>([]);
  politicaAbierta = signal<string | null>(null);
  actividadAbierta = signal<string | null>(null);
  docsNodo = signal<Record<string, Documento[]>>({});
  cargandoJerarquia = signal(false);
  nodosPorPolitica = signal<Record<string, any[]>>({});

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

  getSafeUrl(url: string): SafeResourceUrl { return this.sanitizer.bypassSecurityTrustResourceUrl(url); }

  verDoc(doc: Documento) { this.docVisor.set(doc); }
  cerrarVisor() { this.docVisor.set(null); }
  esPDF(doc: Documento) { return doc.tipo?.includes('pdf') || doc.nombre?.endsWith('.pdf'); }
  esImagen(doc: Documento) { return doc.tipo?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(doc.nombre); }

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

  cargarVistaJerarquica(): void {
    this.cargandoJerarquia.set(true);
    this.api.get<any[]>('/politicas').subscribe({
      next: pols => {
        this.politicas.set(pols);
        this.cargandoJerarquia.set(false);
      },
      error: () => this.cargandoJerarquia.set(false)
    });
  }

  togglePolitica(politicaId: string, diagramJson?: string): void {
    if (this.politicaAbierta() === politicaId) {
      this.politicaAbierta.set(null);
      return;
    }
    this.politicaAbierta.set(politicaId);
    this.actividadAbierta.set(null);

    if (diagramJson) {
      try {
        const data = JSON.parse(diagramJson);
        const nodos = (data.nodes ?? []).filter((n: any) => n.type === 'actividad');
        this.nodosPorPolitica.update(m => ({ ...m, [politicaId]: nodos }));
      } catch {
        this.nodosPorPolitica.update(m => ({ ...m, [politicaId]: [] }));
      }
    }
  }

  toggleActividad(nodoId: string): void {
    if (this.actividadAbierta() === nodoId) {
      this.actividadAbierta.set(null);
      return;
    }
    this.actividadAbierta.set(nodoId);
    if (!this.docsNodo()[nodoId]) {
      this.docService.getByActividad(nodoId).subscribe({
        next: docs => this.docsNodo.update(m => ({ ...m, [nodoId]: docs })),
        error: () => this.docsNodo.update(m => ({ ...m, [nodoId]: [] }))
      });
    }
  }

  getNodosDePolitica(politicaId: string): any[] {
    return this.nodosPorPolitica()[politicaId] ?? [];
  }

  getDocsNodo(nodoId: string): Documento[] {
    return this.docsNodo()[nodoId] ?? [];
  }

  cambiarVista(vista: 'lista' | 'jerarquica'): void {
    this.vistaActiva = vista;
    if (vista === 'jerarquica' && this.politicas().length === 0) {
      this.cargarVistaJerarquica();
    }
  }
}
