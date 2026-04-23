import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import SockJS from 'sockjs-client';

@Injectable({ providedIn: 'root' })
export class ColaboracionService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private client: Client | null = null;

  connected = signal(false);
  cambios$ = new Subject<any>();

  get username(): string {
    return this.auth.currentUser()?.username ?? '';
  }

  conectar(politicaId: string) {
    this.desconectar();
    const token = this.auth.getToken();
    const wsBase = environment.apiUrl.replace('/api', '');

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${wsBase}/ws`),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      onConnect: () => {
        this.connected.set(true);
        this.client!.subscribe(`/topic/colaboracion/${politicaId}`, msg => {
          try { this.cambios$.next(JSON.parse(msg.body)); } catch {}
        });
      },
      onDisconnect: () => this.connected.set(false),
      onStompError: () => this.connected.set(false),
      reconnectDelay: 5000,
    });
    this.client.activate();
  }

  publicar(politicaId: string, data: any) {
    if (!this.client?.connected) return;
    this.client.publish({
      destination: `/app/colaboracion/${politicaId}/cambio`,
      body: JSON.stringify(data),
    });
  }

  generarToken(politicaId: string) {
    return this.api.post<{ token: string }>(`/politicas/${politicaId}/compartir`, {});
  }

  obtenerPorToken(token: string) {
    return this.api.get<any>(`/politicas/compartido/${token}`);
  }

  desconectar() {
    this.client?.deactivate();
    this.client = null;
    this.connected.set(false);
  }
}
