import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-monitor',
  imports: [FormsModule],
  templateUrl: './monitor.component.html',
  styleUrl: './monitor.component.css'
})
export class MonitorComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  protected auth = inject(AuthService);

  actividades = signal<any[]>([]);
  tramitesAgrupados = signal<Map<string, any[]>>(new Map());
  tramitesExpandidos = new Set<string>();
  actividadSeleccionada = signal<any | null>(null);
  tramiteSeleccionado = signal<any | null>(null);
  politicaPasos = signal<any[]>([]);
  loading = signal(true);
  loadingDetalle = signal(false);
  error = signal('');
  errorModal = signal('');
  connected = signal(false);
  mostrarModal = signal(false);
  etiquetasCliente = signal<Record<string, string>>({});
  datosFormulario: Record<string, any> = {};

  private ws: WebSocket | null = null;
  private _refreshInterval: any;

  ngOnInit() {
    this.load();
    this.conectarWS();
    this._refreshInterval = setInterval(() => this.load(), 10000);
  }

  ngOnDestroy() {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    if (this.ws) this.ws.close();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    const endpoint = this.auth.getUserRole() === 'ADMIN'
      ? '/monitor/actividades'
      : '/monitor/mis-actividades';
    this.api.get<any>(endpoint).subscribe({
      next: res => {
        const content = Array.isArray(res) ? res : (res.content || []);
        this.actividades.set(content);
        this.agruparPorTramite(content);
        this.loading.set(false);
      },
      error: () => { this.error.set('Error al cargar actividades'); this.loading.set(false); }
    });
  }

  abrirActividad(actividad: any) {
    this.loadingDetalle.set(true);
    this.errorModal.set('');
    this.datosFormulario = {};
    this.tramiteSeleccionado.set(null);
    this.politicaPasos.set([]);
    this.etiquetasCliente.set({});

    this.api.get<any>(`/actividades/${actividad.id}`).subscribe({
      next: detalle => {
        const yaCompletada = detalle.estado === 'COMPLETADO' ||
                             (detalle.datosFormulario &&
                              Object.keys(detalle.datosFormulario).length > 0);

        detalle.formularioDefinicion?.forEach((c: any) => {
          this.datosFormulario[c.id] = detalle.datosFormulario?.[c.id]
            ?? (c.tipo === 'CHECKBOX' ? false : '');
        });

        detalle._soloLectura = yaCompletada;
        this.actividadSeleccionada.set(detalle);
        this.mostrarModal.set(true);
        this.loadingDetalle.set(false);

        this.api.get<any>(`/tramites/${detalle.tramiteId}`).subscribe({
          next: tramite => {
            this.tramiteSeleccionado.set(tramite);
            if (tramite.politicaId) {
              this.api.get<any>(`/politicas/${tramite.politicaId}`).subscribe({
                next: politica => {
                  this.politicaPasos.set(politica.pasos ?? []);
                  const mapa: Record<string, string> = {};
                  politica.actividades?.[0]?.formularioDefinicion?.forEach((c: any) => {
                    mapa[c.id] = c.etiqueta ?? c.id;
                  });
                  this.etiquetasCliente.set(mapa);
                },
                error: () => {}
              });
            }
          },
          error: () => {}
        });
      },
      error: () => { this.loadingDetalle.set(false); }
    });
  }

  cerrarModal() {
    this.mostrarModal.set(false);
    this.actividadSeleccionada.set(null);
    this.tramiteSeleccionado.set(null);
    this.politicaPasos.set([]);
    this.etiquetasCliente.set({});
    this.errorModal.set('');
  }

  getDatosCliente(): { etiqueta: string; valor: any }[] {
    const tramite = this.tramiteSeleccionado();
    const actividad = this.actividadSeleccionada();
    const fuente = tramite?.datos ?? tramite?.datosCliente ?? actividad?.datos;
    if (!fuente) return [];
    const mapa = this.etiquetasCliente();
    return Object.entries(fuente)
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
      .map(([key, valor]) => ({ etiqueta: mapa[key] ?? key, valor }));
  }

  iniciarActividad() {
    const a = this.actividadSeleccionada();
    if (!a) return;
    const userId = this.auth.currentUser()?.id;
    this.api.patch<any>(`/actividades/${a.id}/iniciar`, { responsableId: userId }).subscribe({
      next: updated => {
        this.actividadSeleccionada.set(updated);
        this.load();
      },
      error: () => this.errorModal.set('Error al iniciar actividad')
    });
  }

  completarActividad() {
    const a = this.actividadSeleccionada();
    if (!a) return;
    if (a._soloLectura) {
      this.errorModal.set('Esta actividad ya fue completada y no puede modificarse.');
      return;
    }
    const camposRequeridos = a.formularioDefinicion?.filter((c: any) => c.requerido) ?? [];
    for (const campo of camposRequeridos) {
      const val = this.datosFormulario[campo.id];
      if (val === '' || val === null || val === undefined) {
        this.errorModal.set(`El campo "${campo.etiqueta}" es requerido`);
        return;
      }
    }
    this.errorModal.set('');
    this.api.patch<any>(`/actividades/${a.id}/formulario`, this.datosFormulario).subscribe({
      next: () => { this.cerrarModal(); this.load(); },
      error: () => this.errorModal.set('Error al completar actividad')
    });
  }

  agruparPorTramite(actividades: any[]) {
    const mapa = new Map<string, any[]>();
    for (const a of actividades) {
      const key = a.tramiteId ?? 'sin-tramite';
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key)!.push(a);
    }
    mapa.forEach((acts, key) => {
      mapa.set(key, acts.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
    });
    this.tramitesAgrupados.set(mapa);
  }

  getTramiteKeys(): string[] {
    return Array.from(this.tramitesAgrupados().keys());
  }

  toggleTramite(tramiteId: string) {
    if (this.tramitesExpandidos.has(tramiteId)) {
      this.tramitesExpandidos.delete(tramiteId);
    } else {
      this.tramitesExpandidos.add(tramiteId);
    }
  }

  isTramiteExpandido(tramiteId: string): boolean {
    return this.tramitesExpandidos.has(tramiteId);
  }

  getTramiteEstadoResumen(acts: any[]): string {
    const completadas = acts.filter(a => a.estado === 'COMPLETADO').length;
    const total = acts.length;
    return `${completadas}/${total} completadas`;
  }

  getTramiteColorClass(acts: any[]): string {
    const todasCompletadas = acts.every(a => a.estado === 'COMPLETADO');
    const hayEnProceso = acts.some(a => a.estado === 'EN_PROCESO');
    const hayPendiente = acts.some(a => a.estado === 'PENDIENTE');
    if (todasCompletadas) return 'folder-completado';
    if (hayEnProceso) return 'folder-proceso';
    if (hayPendiente) return 'folder-pendiente';
    return 'folder-default';
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'PENDIENTE':  return 'badge-pendiente';
      case 'EN_PROCESO': return 'badge-proceso';
      case 'COMPLETADO': return 'badge-completado';
      case 'OMITIDO':    return 'badge-omitido';
      default:           return 'badge-default';
    }
  }

  private conectarWS() {
    const token = this.auth.getToken();
    if (!token) return;
    try {
      this.ws = new WebSocket(`${environment.wsUrl}/monitor?token=${token}`);
      this.ws.onopen = () => this.connected.set(true);
      this.ws.onclose = () => this.connected.set(false);
      this.ws.onmessage = () => this.load();
    } catch { this.connected.set(false); }
  }
}
