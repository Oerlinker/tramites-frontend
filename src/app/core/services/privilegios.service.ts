import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { PrivilegiosPN } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class PrivilegiosService {
  private auth = inject(AuthService);

  private defaultPrivilegios: PrivilegiosPN = {
    verDocumentos: ['ADMIN', 'FUNCIONARIO', 'CLIENTE'],
    subirDocumentos: ['ADMIN', 'FUNCIONARIO'],
    eliminarDocumentos: ['ADMIN'],
    aprobar: ['ADMIN'],
  };

  puede(accion: keyof PrivilegiosPN, privilegios?: PrivilegiosPN): boolean {
    const rol = this.auth.getUserRole() ?? '';
    const config = privilegios ?? this.defaultPrivilegios;
    return config[accion]?.includes(rol) ?? false;
  }
}
