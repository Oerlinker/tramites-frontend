import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);

  loading = signal(false);
  loadingPassword = signal(false);
  successInfo = signal('');
  errorInfo = signal('');
  successPassword = signal('');
  errorPassword = signal('');

  email = '';
  emailNuevo = '';
  username = '';
  roles: string[] = [];

  passwordNueva = '';
  passwordConfirm = '';

  seccionAbierta: string | null = null;

  ngOnInit() {
    this.api.get<any>('/usuarios/me').subscribe({
      next: u => {
        this.username = u.username;
        this.email = u.email;
        this.roles = u.roles ?? [];
      },
      error: () => {
        const user = this.auth.currentUser();
        if (user) {
          this.username = user.username;
          this.email = user.email;
          this.roles = user.roles ?? [];
        }
      }
    });
  }

  toggleSeccion(seccion: string | null) {
    this.seccionAbierta = this.seccionAbierta === seccion ? null : seccion;
    this.successInfo.set('');
    this.errorInfo.set('');
    this.successPassword.set('');
    this.errorPassword.set('');
    if (seccion === 'email') this.emailNuevo = this.email;
    if (seccion === 'password') {
      this.passwordNueva = '';
      this.passwordConfirm = '';
    }
  }

  guardarEmail() {
    if (!this.emailNuevo.trim()) {
      this.errorInfo.set('El email es requerido');
      return;
    }
    this.loading.set(true);
    this.errorInfo.set('');
    this.successInfo.set('');
    this.api.put<any>('/usuarios/me', { email: this.emailNuevo }).subscribe({
      next: () => {
        this.email = this.emailNuevo;
        this.successInfo.set('Email actualizado correctamente');
        this.loading.set(false);
        setTimeout(() => this.toggleSeccion(null), 1500);
      },
      error: () => {
        this.errorInfo.set('Error al actualizar email');
        this.loading.set(false);
      }
    });
  }

  cambiarPassword() {
    if (!this.passwordNueva.trim()) {
      this.errorPassword.set('La nueva contraseña es requerida');
      return;
    }
    if (this.passwordNueva !== this.passwordConfirm) {
      this.errorPassword.set('Las contraseñas no coinciden');
      return;
    }
    if (this.passwordNueva.length < 6) {
      this.errorPassword.set('Mínimo 6 caracteres');
      return;
    }
    this.loadingPassword.set(true);
    this.errorPassword.set('');
    this.successPassword.set('');
    this.api.patch<void>('/usuarios/me/password', {
      nuevaPassword: this.passwordNueva
    }).subscribe({
      next: () => {
        this.successPassword.set('Contraseña actualizada correctamente');
        this.passwordNueva = '';
        this.passwordConfirm = '';
        this.loadingPassword.set(false);
        setTimeout(() => this.toggleSeccion(null), 1500);
      },
      error: () => {
        this.errorPassword.set('Error al cambiar contraseña');
        this.loadingPassword.set(false);
      }
    });
  }
}
