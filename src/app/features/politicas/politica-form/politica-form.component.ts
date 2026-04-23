import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Politica } from '../../../shared/models';

@Component({
  selector: 'app-politica-form',
  imports: [FormsModule, RouterLink],
  templateUrl: './politica-form.component.html',
  styleUrl: './politica-form.component.css'
})
export class PoliticaFormComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  politicaId: string | null = null;
  loading = signal(false);
  error = signal('');

  nombre = '';
  descripcion = '';
  activa = true;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.politicaId = id;
      this.api.get<Politica>(`/politicas/${id}`).subscribe({
        next: p => { this.nombre = p.nombre; this.descripcion = p.descripcion; this.activa = p.activa; }
      });
    }
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    const body = { nombre: this.nombre, descripcion: this.descripcion, activa: this.activa };
    const req = this.isEdit
      ? this.api.put<Politica>(`/politicas/${this.politicaId}`, body)
      : this.api.post<Politica>('/politicas', body);

    req.subscribe({
      next: () => this.router.navigate(['/politicas']),
      error: err => { this.error.set(err.error?.mensaje ?? 'Error al guardar'); this.loading.set(false); }
    });
  }
}
