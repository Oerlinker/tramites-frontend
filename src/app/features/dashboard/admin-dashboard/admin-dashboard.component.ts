import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Usuario, Departamento } from '../../../shared/models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private api = inject(ApiService);

  totalUsuarios = signal(0);
  totalTramites = signal(0);
  tramitesPendientes = signal(0);
  tramitesFinalizados = signal(0);

  usuarios = signal<Usuario[]>([]);
  departamentos = signal<Departamento[]>([]);
  asignandoDeptoUserId: string | null = null;
  deptoSeleccionado = '';
  errorUsuarios = signal('');

  ngOnInit() {
    this.api.get<number>('/usuarios/count').subscribe({ next: v => this.totalUsuarios.set(v), error: () => {} });
    this.api.get<number>('/tramites/count').subscribe({ next: v => this.totalTramites.set(v), error: () => {} });
    this.api.get<number>('/tramites/count?estado=PENDIENTE').subscribe({ next: v => this.tramitesPendientes.set(v), error: () => {} });
    this.api.get<number>('/tramites/count?estado=FINALIZADO').subscribe({ next: v => this.tramitesFinalizados.set(v), error: () => {} });
    this.loadUsuarios();
    this.api.get<Departamento[]>('/departamentos').subscribe({ next: d => this.departamentos.set(d), error: () => {} });
  }

  loadUsuarios() {
    this.api.get<Usuario[]>('/usuarios').subscribe({
      next: u => this.usuarios.set(u.filter(x => x.roles.includes('ROLE_FUNCIONARIO'))),
      error: () => this.errorUsuarios.set('Error al cargar usuarios')
    });
  }

  iniciarAsignacion(usuario: Usuario) {
    this.asignandoDeptoUserId = usuario.id;
    this.deptoSeleccionado = usuario.departamentoId ?? '';
  }

  cancelarAsignacion() {
    this.asignandoDeptoUserId = null;
    this.deptoSeleccionado = '';
  }

  guardarDepartamento(userId: string) {
    const usuario = this.usuarios().find(u => u.id === userId);
    if (!usuario) return;
    this.api.put<Usuario>(`/usuarios/${userId}`, {
      email: usuario.email,
      roles: usuario.roles,
      activo: usuario.activo,
      departamentoId: this.deptoSeleccionado || null
    }).subscribe({
      next: () => { this.cancelarAsignacion(); this.loadUsuarios(); },
      error: () => this.errorUsuarios.set('Error al asignar departamento')
    });
  }

  getNombreDepto(id: string | undefined): string {
    if (!id) return '—';
    return this.departamentos().find(d => d.id === id)?.nombre ?? id;
  }
}
