import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { NlpService, RecomendacionPolitica } from '../../../core/services/nlp.service';
import { Politica, Tramite } from '../../../shared/models';

@Component({
  selector: 'app-tramite-iniciar',
  imports: [CommonModule, FormsModule],
  templateUrl: './tramite-iniciar.component.html',
  styleUrl: './tramite-iniciar.component.css',
})
export class TramiteIniciarComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private nlp = inject(NlpService);

  politicas = signal<Politica[]>([]);
  politicaSeleccionada: string | null = null;
  titulo = '';
  descripcion = '';
  loading = signal(false);
  error = signal('');
  success = signal('');

  formularioInicial = signal<any[]>([]);
  datosFormulario: Record<string, any> = {};

  descripcionIA = '';
  cargandoRecomendacion = signal(false);
  recomendacion = signal<RecomendacionPolitica | null>(null);
  errorRecomendacion = signal('');

  ngOnInit() {
    this.api.get<Politica[]>('/politicas?soloActivas=true').subscribe({
      next: (politicas) => this.politicas.set(politicas),
      error: () => this.error.set('Error al cargar tipos de trámite'),
    });
  }

  onPoliticaChange(): void {
    this.datosFormulario = {};
    const politica = this.politicas().find(p => p.id === this.politicaSeleccionada);
    if (!politica?.pasos) { this.formularioInicial.set([]); return; }
    const pasoConForm = politica.pasos
      .sort((a, b) => a.orden - b.orden)
      .find(p => p.formulario && p.formulario.length > 0);
    this.formularioInicial.set(pasoConForm?.formulario ?? []);
    pasoConForm?.formulario?.forEach(c => {
      this.datosFormulario[c.id] = c.tipo === 'CHECKBOX' ? false : '';
    });
  }

  recomendarPoliticaIA(): void {
    if (!this.descripcionIA.trim()) return;
    this.cargandoRecomendacion.set(true);
    this.errorRecomendacion.set('');
    this.recomendacion.set(null);
    const politicasPayload = this.politicas().map(p => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
    }));
    this.nlp.recomendarPolitica(this.descripcionIA, politicasPayload).subscribe({
      next: res => {
        this.recomendacion.set(res);
        this.cargandoRecomendacion.set(false);
      },
      error: err => {
        this.errorRecomendacion.set(err?.error?.detail ?? err?.message ?? 'Error al consultar IA');
        this.cargandoRecomendacion.set(false);
      }
    });
  }

  seleccionarPoliticaRecomendada(): void {
    const rec = this.recomendacion();
    if (!rec) return;
    this.politicaSeleccionada = rec.politica_id;
    this.onPoliticaChange();
    this.recomendacion.set(null);
  }

  submit() {
    if (!this.politicaSeleccionada) {
      this.error.set('Selecciona un tipo de trámite');
      return;
    }
    if (!this.titulo.trim()) {
      this.error.set('Ingresa un título');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api
      .post<Tramite>('/tramites', {
        titulo: this.titulo,
        descripcion: this.descripcion,
        politicaId: this.politicaSeleccionada,
        datos: this.datosFormulario,
      })
      .subscribe({
        next: (tramite) => {
          this.success.set('Trámite iniciado exitosamente. ID: ' + tramite.id);
          setTimeout(() => this.router.navigate(['/tramites']), 1500);
        },
        error: (err) => {
          this.error.set(err.error?.mensaje ?? err.error ?? 'Error al iniciar trámite');
          this.loading.set(false);
        },
      });
  }
}
