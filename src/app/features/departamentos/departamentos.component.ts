import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Departamento } from '../../shared/models';

@Component({
  selector: 'app-departamentos',
  imports: [FormsModule],
  template: `
<div class="page">
  <div class="page-header">
    <h1>Gestión de Departamentos</h1>
    <button class="btn-primary" (click)="mostrarForm.set(true)">+ Nuevo Departamento</button>
  </div>

  @if (mostrarForm()) {
    <div class="form-card">
      <h3>{{ editando ? 'Editar' : 'Nuevo' }} Departamento</h3>
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" [(ngModel)]="formNombre" placeholder="Ej: Atención al Cliente"/>
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" [(ngModel)]="formDesc" placeholder="Descripción del departamento"/>
      </div>
      <div class="form-actions">
        <button class="btn-primary" (click)="guardar()">Guardar</button>
        <button class="btn-secondary" (click)="cancelar()">Cancelar</button>
      </div>
    </div>
  }

  @if (error()) { <p class="error-msg">{{ error() }}</p> }

  @if (departamentos().length === 0) {
    <p class="empty">No hay departamentos registrados.</p>
  } @else {
    <table class="table">
      <thead>
        <tr><th>Nombre</th><th>Descripción</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        @for (d of departamentos(); track d.id) {
          <tr>
            <td><strong>{{ d.nombre }}</strong></td>
            <td>{{ d.descripcion }}</td>
            <td class="actions">
              <button class="btn-sm" (click)="editar(d)">Editar</button>
              <button class="btn-sm btn-danger" (click)="eliminar(d.id)">Eliminar</button>
            </td>
          </tr>
        }
      </tbody>
    </table>
  }
</div>
  `,
  styles: [`
.page { padding: 2rem; }
.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
.page-header h1 { margin:0; color:#1a237e; }
.btn-primary { background:#1a237e; color:#fff; padding:0.5rem 1.25rem; border:none; border-radius:4px; cursor:pointer; }
.btn-secondary { background:#f5f5f5; color:#333; padding:0.5rem 1.25rem; border:1px solid #ddd; border-radius:4px; cursor:pointer; }
.form-card { background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:1.5rem; margin-bottom:1.5rem; }
.form-card h3 { margin:0 0 1rem; color:#1a237e; }
.form-group { margin-bottom:1rem; }
.form-group label { display:block; font-size:13px; color:#555; margin-bottom:4px; }
.form-group input { width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:14px; }
.form-actions { display:flex; gap:8px; }
.table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 6px rgba(0,0,0,0.1); }
.table th { background:#f5f5f5; padding:0.75rem 1rem; text-align:left; font-weight:600; color:#616161; }
.table td { padding:0.75rem 1rem; border-bottom:1px solid #f0f0f0; }
.actions { display:flex; gap:0.5rem; }
.btn-sm { padding:3px 10px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem; background:#e8eaf6; color:#1a237e; }
.btn-danger { background:#ffebee; color:#c62828; }
.error-msg { color:#c62828; }
.empty { color:#9e9e9e; }
  `]
})
export class DepartamentosComponent implements OnInit {
  private api = inject(ApiService);

  departamentos = signal<Departamento[]>([]);
  mostrarForm = signal(false);
  error = signal('');
  editando: string | null = null;
  formNombre = '';
  formDesc = '';

  ngOnInit() { this.load(); }

  load() {
    this.api.get<Departamento[]>('/departamentos').subscribe({
      next: deps => this.departamentos.set(deps),
      error: () => this.error.set('Error al cargar departamentos')
    });
  }

  editar(d: Departamento) {
    this.editando = d.id;
    this.formNombre = d.nombre;
    this.formDesc = d.descripcion;
    this.mostrarForm.set(true);
  }

  cancelar() {
    this.editando = null;
    this.formNombre = '';
    this.formDesc = '';
    this.mostrarForm.set(false);
  }

  guardar() {
    if (!this.formNombre.trim()) { this.error.set('El nombre es obligatorio'); return; }
    const body = { nombre: this.formNombre, descripcion: this.formDesc };
    const req = this.editando
      ? this.api.put<Departamento>(`/departamentos/${this.editando}`, body)
      : this.api.post<Departamento>('/departamentos', body);
    req.subscribe({
      next: () => { this.cancelar(); this.load(); },
      error: err => this.error.set(err.error?.mensaje ?? 'Error al guardar')
    });
  }

  eliminar(id: string) {
    if (!confirm('¿Eliminar este departamento?')) return;
    this.api.delete<void>(`/departamentos/${id}`).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Error al eliminar')
    });
  }
}
