import { Component, EventEmitter, Output, signal, inject, OnDestroy } from '@angular/core';
import { NlpService, CampoSugerido } from '../../../core/services/nlp.service';

type EstadoGrabacion = 'idle' | 'grabando' | 'procesando' | 'listo' | 'error';

@Component({
  selector: 'app-audio-recorder',
  standalone: true,
  templateUrl: './audio-recorder.component.html',
  styleUrls: ['./audio-recorder.component.css'],
})
export class AudioRecorderComponent implements OnDestroy {
  @Output() camposSugeridos = new EventEmitter<CampoSugerido[]>();

  private nlp = inject(NlpService);

  estado = signal<EstadoGrabacion>('idle');
  transcripcion = signal('');
  errorMsg = signal('');

  private mediaRecorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private stream?: MediaStream;

  async iniciarGrabacion(): Promise<void> {
    this.errorMsg.set('');
    this.transcripcion.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm' });
      this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.mediaRecorder.onstop = () => this.enviar();
      this.mediaRecorder.start();
      this.estado.set('grabando');
    } catch {
      this.errorMsg.set('No se pudo acceder al micrófono.');
      this.estado.set('error');
    }
  }

  detenerGrabacion(): void {
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.estado.set('procesando');
  }

  private enviar(): void {
    const blob = new Blob(this.chunks, { type: 'audio/webm' });
    this.nlp.audioAFormulario(blob, 'grabacion.webm').subscribe({
      next: res => {
        this.transcripcion.set(res.transcripcion ?? '');
        this.estado.set('listo');
        if (res.campos?.length) {
          this.camposSugeridos.emit(res.campos);
        }
      },
      error: err => {
        this.errorMsg.set(err?.error?.detail ?? err?.message ?? 'Error al procesar audio');
        this.estado.set('error');
      },
    });
  }

  reiniciar(): void {
    this.estado.set('idle');
    this.transcripcion.set('');
    this.errorMsg.set('');
  }

  ngOnDestroy(): void {
    this.stream?.getTracks().forEach(t => t.stop());
  }
}
