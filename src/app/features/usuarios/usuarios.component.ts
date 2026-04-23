import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Usuario, Departamento } from '../../shared/models';

interface UsuarioForm {
  username: string;
  email: string;
  password: string;
  roles: string[];
  departamentoId: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css'
})
export class UsuariosComponent implements OnInit {
  private api = inject(ApiService);

  usuarios = signal<Usuario[]>([]);
  departamentos = signal<Departamento[]>([]);
  loading = signal(true);
  error = signal('');
  mostrarModal = signal(false);
  modoEdicion = signal(false);

  editandoId: string | null = null;
  form: UsuarioForm = this.formVacio();

  readonly ROLES_DISPONIBLES = ['ROLE_ADMIN', 'ROLE_FUNCIONARIO', 'ROLE_CLIENTE'];

  ngOnInit() {
    this.cargarDatos();
  }

  private cargarDatos() {
    this.loading.set(true);
    this.api.get<Usuario[]>('/usuarios').subscribe({
      next: u => { this.usuarios.set(u.filter((x: any) => x.roles.includes('ROLE_FUNCIONARIO'))); this.loading.set(false); },
      error: () => { this.error.set('Error al cargar usuarios'); this.loading.set(false); }
    });
    this.api.get<Departamento[]>('/departamentos').subscribe({
      next: d => this.departamentos.set(d),
      error: () => {}
    });
  }

  private formVacio(): UsuarioForm {
    return { username: '', email: '', password: '', roles: [], departamentoId: '' };
  }

  getNombreDepto(id: string | undefined): string {
    if (!id) return '—';
    return this.departamentos().find(d => d.id === id)?.nombre ?? '—';
  }

  abrirCrear() {
    this.editandoId = null;
    this.form = this.formVacio();
    this.modoEdicion.set(false);
    this.error.set('');
    this.mostrarModal.set(true);
  }

  abrirEditar(u: Usuario) {
    this.editandoId = u.id;
    this.form = {
      username: u.username,
      email: u.email,
      password: '',
      roles: [...u.roles],
      departamentoId: u.departamentoId ?? ''
    };
    this.modoEdicion.set(true);
    this.error.set('');
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    this.mostrarModal.set(false);
    this.editandoId = null;
    this.form = this.formVacio();
  }

  toggleRol(rol: string) {
    if (this.form.roles.includes(rol)) {
      this.form.roles = this.form.roles.filter(r => r !== rol);
    } else {
      this.form.roles = [...this.form.roles, rol];
    }
  }

  tieneRol(rol: string): boolean {
    return this.form.roles.includes(rol);
  }

  guardar() {
    if (!this.form.username.trim() || !this.form.email.trim()) {
      this.error.set('Username y email son obligatorios');
      return;
    }
    if (!this.modoEdicion() && !this.form.password.trim()) {
      this.error.set('La contraseña es obligatoria');
      return;
    }
    if (this.form.roles.length === 0) {
      this.error.set('Debe seleccionar al menos un rol');
      return;
    }

    const req = this.modoEdicion()
      ? this.api.put<Usuario>(`/usuarios/${this.editandoId}`, {
          email: this.form.email,
          roles: this.form.roles,
          activo: true,
          departamentoId: this.form.departamentoId || null
        })
      : this.api.post<Usuario>('/auth/admin/register', {
          username: this.form.username,
          email: this.form.email,
          password: this.form.password,
          roles: this.form.roles
        });

    req.subscribe({
      next: () => { this.cerrarModal(); this.cargarDatos(); },
      error: err => this.error.set(err.error?.mensaje ?? 'Error al guardar')
    });
  }

  toggleActivo(u: Usuario) {
    const endpoint = u.activo ? `/usuarios/${u.id}/desactivar` : `/usuarios/${u.id}/activar`;
    this.api.patch<void>(endpoint, {}).subscribe({
      next: () => this.cargarDatos(),
      error: () => this.error.set('Error al cambiar estado')
    });
  }

  eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar el usuario "${u.username}"?`)) return;
    this.api.delete<void>(`/usuarios/${u.id}`).subscribe({
      next: () => this.cargarDatos(),
      error: () => this.error.set('Error al eliminar usuario')
    });
  }
}
