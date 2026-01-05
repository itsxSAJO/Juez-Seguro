// ============================================================================
// JUEZ SEGURO BACKEND - Tipos del Sistema
// Definiciones de tipos alineados con el esquema de BD
// ============================================================================

// ============================================================================
// USUARIOS Y AUTENTICACIÓN (FIA)
// ============================================================================
export type UserRole = "ADMIN_CJ" | "JUEZ" | "SECRETARIO";
export type RolUsuario = UserRole;

export type EstadoCuenta = "HABILITABLE" | "ACTIVA" | "SUSPENDIDA" | "INACTIVA" | "BLOQUEADA";

// Mapeado a la tabla 'funcionarios'
export interface Funcionario {
  funcionario_id: number;
  identificacion: string;
  nombres_completos: string;
  correo_institucional: string;
  password_hash: string;
  rol_id: number;
  unidad_judicial: string;
  materia: string;
  estado: EstadoCuenta;
  intentos_fallidos: number;
  fecha_bloqueo: Date | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

// Vista pública del funcionario (sin password_hash)
export interface FuncionarioPublico {
  funcionarioId: number;
  identificacion: string;
  nombresCompletos: string;
  correoInstitucional: string;
  rolId: number;
  rolNombre?: string;
  unidadJudicial: string;
  materia: string;
  estado: EstadoCuenta;
  intentosFallidos: number;
  fechaBloqueo: Date | null;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

// Mapeado a la tabla 'roles'
export interface Rol {
  rol_id: number;
  nombre: UserRole;
  descripcion: string;
}

// Mapeado a la tabla 'historial_estados'
export interface HistorialEstado {
  historial_id: number;
  funcionario_id: number;
  estado_anterior: EstadoCuenta | null;
  estado_nuevo: EstadoCuenta;
  fecha_cambio: Date;
  usuario_modificador_id: number | null;
}

export interface TokenPayload {
  funcionarioId: number;
  identificacion: string;
  correo: string;
  rol: UserRole;
  rolId: number;
  iat?: number;
  exp?: number;
}

// Alias para compatibilidad
export type Usuario = Funcionario;
export type UsuarioPublico = FuncionarioPublico;

// ============================================================================
// CASOS / PROCESOS (FDP)
// ============================================================================
export type EstadoProcesal = "INICIADA" | "EN_TRAMITE" | "RESUELTA" | "ARCHIVADA" | "SUSPENDIDA";
export type EstadoCausa = EstadoProcesal;
export type PrioridadCausa = "normal" | "urgente" | "alta" | "baja";

// Mapeado a la tabla 'mapa_pseudonimos'
export interface MapaPseudonimo {
  mapa_id: number;
  juez_id_real: number;
  pseudonimo_publico: string;
  fecha_generacion: Date;
}

// Mapeado a la tabla 'causas'
export interface Causa {
  causa_id: number;
  numero_proceso: string;
  materia: string;
  tipo_proceso: string;
  unidad_judicial: string;
  juez_asignado_id: number;
  juez_pseudonimo: string;
  secretario_creador_id: number;
  estado_procesal: EstadoProcesal;
  fecha_creacion: Date;
}

// Vista pública de causa (para ciudadanos)
export interface CausaPublica {
  causaId: number;
  numeroProceso: string;
  materia: string;
  tipoProceso: string;
  unidadJudicial: string;
  juezPseudonimo: string; // Solo pseudónimo, nunca ID real
  estadoProcesal: EstadoProcesal;
  fechaCreacion: Date;
}

// Mapeado a la tabla 'expedientes'
export interface Expediente {
  expediente_id: number;
  causa_id: number;
  fecha_apertura: Date;
  observaciones: string | null;
}

// ============================================================================
// AUDITORÍA (FAU)
// ============================================================================
export type TipoEventoAuditoria = 
  | "LOGIN_EXITOSO"
  | "LOGIN_FALLIDO"
  | "LOGOUT"
  | "CREACION_CAUSA"
  | "CAMBIO_ESTADO"
  | "ACCESO_DENEGADO"
  | "CONSULTA_AUDITORIA"
  | "CREACION_USUARIO"
  | "MODIFICACION_USUARIO"
  | "BLOQUEO_CUENTA"
  | "DESBLOQUEO_CUENTA"
  | string;

export type ModuloAfectado = "AUTH" | "CASOS" | "ADMIN" | "DOCUMENTOS" | "AUDIENCIAS" | "NOTIFICACIONES";

// Mapeado a la tabla 'logs_auditoria'
export interface LogAuditoria {
  log_id: number;
  fecha_evento: Date;
  usuario_id: number | null;
  rol_usuario: string | null;
  ip_origen: string | null;
  tipo_evento: TipoEventoAuditoria;
  modulo_afectado: ModuloAfectado | null;
  descripcion_evento: string | null;
  datos_afectados: Record<string, unknown> | null;
  hash_evento: string;
}

// Alias para compatibilidad
export type TipoEvento = TipoEventoAuditoria;

// ============================================================================
// DOCUMENTOS (para futuras tablas)
// ============================================================================
export type TipoDocumento = "demanda" | "contestacion" | "prueba" | "sentencia" | "auto" | "providencia" | "escrito" | "anexo" | "notificacion" | "otro";

export type EstadoDocumento = "activo" | "eliminado" | "borrador" | "pendiente" | "firmado" | "notificado";

export interface Documento {
  id: string;
  causa_id: number;
  causaId?: number; // Alias
  nombre: string;
  tipo: TipoDocumento;
  ruta?: string;
  formato?: "pdf" | "docx";
  tamano?: number;
  tamanioBytes?: number; // Alias
  fecha_subida: Date;
  subido_por_id?: number;
  subidoPorId?: number; // Alias
  subidoPorNombre?: string; // Alias
  hash_integridad: string;
  hashIntegridad?: string; // Alias
  mimeType?: string;
  estado: EstadoDocumento;
}

// ============================================================================
// AUDIENCIAS (para futuras tablas)
// ============================================================================
export type TipoAudiencia = "inicial" | "evaluacion" | "juicio" | "resolucion" | "conciliacion" | "preliminar" | "sentencia" | "otra";

export type EstadoAudiencia = "programada" | "realizada" | "reprogramada" | "cancelada" | "en_curso" | "finalizada" | "suspendida";

export interface Audiencia {
  id: string;
  causa_id: number;
  causaId?: number; // Alias
  numeroExpediente?: string; // Para JOIN con causas
  materia?: string; // Para JOIN con causas
  tipo: TipoAudiencia;
  fecha?: Date; // Alias
  fecha_hora: Date;
  fechaHora?: Date; // Alias
  sala: string;
  duracion_minutos?: number;
  duracionMinutos?: number; // Alias
  modalidad?: "presencial" | "virtual";
  enlace_virtual?: string;
  enlaceVirtual?: string; // Alias
  observaciones?: string;
  programada_por_id?: number;
  programadaPorId?: number; // Alias
  estado: EstadoAudiencia;
  fecha_creacion?: Date;
  fechaCreacion?: Date; // Alias
}

// ============================================================================
// NOTIFICACIONES (para futuras tablas)
// ============================================================================
export type TipoNotificacion = "citacion" | "notificacion" | "emplazamiento" | "recordatorio" | "providencia" | "sentencia" | "otro";

export type MedioNotificacion = "electronico" | "fisico" | "judicial";

export type EstadoNotificacion = "enviada" | "recibida" | "vencida" | "pendiente" | "leida" | "fallida" | "cancelada";

export interface Notificacion {
  id: string;
  causa_id: number;
  causaId?: number; // Alias
  numeroExpediente?: string; // Para JOIN con causas
  tipo: TipoNotificacion;
  destinatario: string;
  destinatario_id?: number;
  asunto?: string;
  mensaje?: string;
  medio?: MedioNotificacion;
  prioridad?: "alta" | "normal" | "baja";
  creada_por_id?: number;
  creadaPorId?: number; // Alias
  fecha_creacion?: Date;
  fechaCreacion?: Date; // Alias
  fecha_envio?: Date;
  fechaEnvio?: Date; // Alias
  fecha_lectura?: Date;
  fechaLectura?: Date; // Alias
  fecha_limite?: Date;
  intentos_envio?: number;
  intentosEnvio?: number; // Alias
  estado: EstadoNotificacion;
}

// ============================================================================
// RESPUESTAS API
// ============================================================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
