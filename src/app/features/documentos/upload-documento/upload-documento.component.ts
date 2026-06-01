import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DocumentoService } from '../../../core/services/documento.service';

@Component({
  selector: 'app-upload-documento',
  imports: [RouterLink, FormsModule],
  templateUrl: './upload-documento.component.html',
  styleUrl: './upload-documento.component.css',
})
export class UploadDocumentoComponent {
  private docService = inject(DocumentoService);
  private router = inject(Router);

  archivo: File | null = null;
  tipoContexto: 'libre' | 'politica' | 'tramite' | 'actividad' = 'libre';
  contextoId = '';
  dragOver = false;

  loading = signal(false);
  error = signal('');
  exito = signal(false);

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver = true;
  }

  onDragLeave() {
    this.dragOver = false;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.archivo = file;
  }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.archivo = input.files?.[0] ?? null;
  }

  getTipoLabel(): string {
    const labels: Record<string, string> = {
      politica: 'Política',
      tramite: 'Trámite',
      actividad: 'Actividad',
    };
    return labels[this.tipoContexto] ?? this.tipoContexto;
  }

  subir() {
    if (!this.archivo) return;

    const id = this.contextoId.trim() || undefined;
    const politicaId = this.tipoContexto === 'politica' ? id : undefined;
    const tramiteId = this.tipoContexto === 'tramite' ? id : undefined;
    const actividadId = this.tipoContexto === 'actividad' ? id : undefined;

    this.loading.set(true);
    this.error.set('');

    this.docService.upload(this.archivo, politicaId, tramiteId, actividadId).subscribe({
      next: () => {
        this.loading.set(false);
        this.exito.set(true);
        setTimeout(() => this.router.navigate(['/documentos']), 1500);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Error al subir el archivo. Intenta de nuevo.');
      },
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
