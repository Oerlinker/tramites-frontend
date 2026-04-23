import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthRequest, RegisterRequest, Usuario } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private _currentUser = signal<Usuario | null>(this.loadUserFromStorage());
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  login(credentials: { username: string; password: string }) {
    return this.http.post<any>(`${this.baseUrl}/login`, credentials).pipe(
      tap((res) => {
        const usuario: Usuario = {
          id: res.id,
          username: res.username,
          email: res.email,
          roles: res.roles.map((r: string) => r.replace('ROLE_', '')),
          activo: true,
        };
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(usuario));
        this._currentUser.set(usuario);
      }),
    );
  }

  register(data: RegisterRequest) {
    return this.http.post<any>(`${this.baseUrl}/register`, data).pipe(
      tap((res) => {
        const usuario: Usuario = {
          id: res.id,
          username: res.username,
          email: res.email,
          roles: res.roles.map((r: string) =>r.replace('ROLE_', '')),
          activo: true,
        };
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(usuario));
        this._currentUser.set(usuario);
      }),
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token') && this._currentUser() !== null;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUserRole(): string | null {
    return this._currentUser()?.roles?.[0] ?? null;
  }

  private loadUserFromStorage(): Usuario | null {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
