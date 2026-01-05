// ============================================================================
// JUEZ SEGURO - Tipos del Sistema
// Definiciones de tipos compartidos entre frontend y backend
// ============================================================================

// ============================================================================
// TIPOS DE USUARIO Y AUTENTICACIÓN
// ============================================================================
export type UserRole = "cj" | "juez" | "secretario";

export type EstadoCuenta = "activa" | "suspendida" | "inactiva";

export interface Usuario {
  id: string;
  nombre: string;
  identificacion: string;
  cargo: UserRole;
  unidadJudicial: string;
  materia: string;
  email: string;
  estado: EstadoCuenta;
  fechaCreacion: string;
  ultimoAcceso: string | null;
  intentosFallidos: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Usuario;
  expiresAt: string;
}

// ============================================================================
// TIPOS DE CAUSAS / PROCESOS
// ============================================================================
export type EstadoCausa = "en_tramite" | "resuelto" | "archivado" | "suspendido";

export type PrioridadCausa = "normal" | "urgente" | "alta";

export interface Causa {
  id: string;
  numeroExpediente: string;
  materia: string;
  tipoAccion: string;
  unidadJudicial: string;
  // Datos pseudonimizados para protección de identidad
  actorPseudonimo: string;
  demandadoPseudonimo: string;
  juezAsignadoId: string;
  juezAsignadoNombre: string;
  estado: EstadoCausa;
  estadoProcesal: string;
  fechaIngreso: string;
  fechaActualizacion: string;
  prioridad: PrioridadCausa;
}

export interface CausaDetalle extends Causa {
  documentos: Documento[];
  audiencias: Audiencia[];
  actuaciones: Actuacion[];
}

export interface CrearCausaRequest {
  materia: string;
  tipoAccion: string;
  unidadJudicial: string;
  actorIdentificacion: string;
  demandadoIdentificacion: string;
  descripcion?: string;
}

// ============================================================================
// TIPOS DE DOCUMENTOS
// ============================================================================
export type TipoDocumento = "escrito" | "providencia" | "auto" | "sentencia" | "anexo" | "notificacion";

export type EstadoDocumento = "borrador" | "pendiente" | "firmado" | "notificado";

export type FormatoDocumento = "pdf" | "docx";

export interface Documento {
  id: string;
  causaId: string;
  nombre: string;
  tipo: TipoDocumento;
  formato: FormatoDocumento;
  tamano: string;
  fechaSubida: string;
  subidoPor: string;
  hashIntegridad: string;
  estado: EstadoDocumento;
}

export interface SubirDocumentoRequest {
  causaId: string;
  nombre: string;
  tipo: TipoDocumento;
  archivo: File;
}

// ============================================================================
// TIPOS DE AUDIENCIAS
// ============================================================================
export type TipoAudiencia = "inicial" | "evaluacion" | "juicio" | "resolucion" | "conciliacion";

export type EstadoAudiencia = "programada" | "realizada" | "reprogramada" | "cancelada";

export interface Audiencia {
  id: string;
  causaId: string;
  numeroExpediente: string;
  tipo: TipoAudiencia;
  fecha: string;
  hora: string;
  sala: string;
  estado: EstadoAudiencia;
  partes: string[];
  notas: string;
  historialCambios?: CambioAudiencia[];
}

export interface CambioAudiencia {
  fecha: string;
  cambio: string;
  usuario: string;
}

export interface ProgramarAudienciaRequest {
  causaId: string;
  tipo: TipoAudiencia;
  fecha: string;
  hora: string;
  sala: string;
  notas?: string;
}

// ============================================================================
// TIPOS DE NOTIFICACIONES
// ============================================================================
export type TipoNotificacion = "citacion" | "notificacion" | "emplazamiento" | "recordatorio";

export type MedioNotificacion = "electronico" | "fisico" | "judicial";

export type EstadoNotificacion = "enviada" | "recibida" | "vencida" | "pendiente";

export interface Notificacion {
  id: string;
  causaId: string;
  tipo: TipoNotificacion;
  destinatario: string;
  medio: MedioNotificacion;
  fechaEnvio: string;
  fechaLimite: string;
  estado: EstadoNotificacion;
}

export interface EnviarNotificacionRequest {
  causaId: string;
  tipo: TipoNotificacion;
  destinatarioId: string;
  medio: MedioNotificacion;
  mensaje: string;
}

// ============================================================================
// TIPOS DE AUDITORÍA
// ============================================================================
export type ResultadoAuditoria = "exito" | "error" | "denegado";

export interface LogAuditoria {
  id: string;
  usuario: string;
  accion: string;
  modulo: string;
  detalle: string;
  ip: string;
  fecha: string;
  resultado: ResultadoAuditoria;
}

export interface FiltrosAuditoria {
  usuario?: string;
  modulo?: string;
  resultado?: ResultadoAuditoria;
  fechaDesde?: string;
  fechaHasta?: string;
}

// ============================================================================
// TIPOS DE ACTUACIONES (para portal ciudadano)
// ============================================================================
export interface Actuacion {
  id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  funcionario: string; // Pseudonimizado
}

// ============================================================================
// TIPOS PARA CONSULTA CIUDADANA (datos anonimizados)
// ============================================================================
export type EstadoProceso = "activo" | "archivado" | "pendiente";

export interface ProcesoPublico {
  id: string;
  numeroExpediente: string;
  fechaIngreso: string;
  dependencia: string;
  materia: string;
  tipoAccion: string;
  estado: EstadoProceso;
  // Identificadores anónimos para proteger identidad
  actorAnonimo: string;
  demandadoAnonimo: string;
  juezAnonimo: string;
}

export interface BusquedaProcesoRequest {
  query: string;
  tipo: "actor" | "demandado" | "proceso";
}
