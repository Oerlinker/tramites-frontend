export type Rol = 'ADMIN' | 'FUNCIONARIO' | 'CLIENTE';

export type EstadoTramite = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'RECHAZADO' | 'CANCELADO';

export interface Usuario {
  id: string;
  username: string;
  email: string;
  roles: string[];
  activo: boolean;
  fechaCreacion?: string;
  departamentoId?: string;
  nombreDepartamento?: string;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export interface CampoFormulario {
  id: string;
  etiqueta: string;
  tipo: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'FILE';
  requerido: boolean;
  opciones?: string[];
  valor?: string;
}

export interface Departamento {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface PasoWorkflow {
  orden: number;
  nombre: string;
  descripcion: string;
  rolRequerido: string;
  departamentoId?: string;
  nombreDepartamento?: string;
  obligatorio: boolean;
  formulario?: CampoFormulario[];
}

export interface Politica {
  id: string;
  nombre: string;
  descripcion: string;
  pasos: PasoWorkflow[];
  activa: boolean;
  creadoPor?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  diagramJson?: string;
}

export interface Tramite {
  id: string;
  titulo: string;
  descripcion: string;
  politicaId: string;
  usuarioSolicitanteId: string;
  usuarioAsignadoId?: string;
  estado: EstadoTramite;
  datos?: Record<string, any>;
  comentarios?: string;
  actividadesIds?: string[];
  fechaInicio: string;
  fechaFin?: string;
  fechaActualizacion?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiError {
  status: number;
  mensaje: string;
  timestamp: string;
}
