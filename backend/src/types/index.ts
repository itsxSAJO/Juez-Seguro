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
  ultimoAcceso?: Date | null;
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
  unidadJudicial: string;  // FIA_USB: Atributo de sesión
  materia: string;         // FIA_USB: Atributo de sesión
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
  secretario_pseudonimo?: string;
  estado_procesal: EstadoProcesal;
  fecha_creacion: Date;
  descripcion?: string;
  // Partes procesales (información pública, sin pseudonimizar)
  actor_nombre?: string;
  actor_identificacion?: string;
  demandado_nombre?: string;
  demandado_identificacion?: string;
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
  descripcion?: string;
  // Partes procesales (información pública)
  actorNombre?: string;
  actorIdentificacion?: string;
  demandadoNombre?: string;
  demandadoIdentificacion?: string;
  // Funcionario que registró (pseudonimizado)
  secretarioPseudonimo?: string;
}

// Vista pública de actuación (para ciudadanos) - HU-UP-001
export interface ActuacionPublica {
  actuacionId: string;
  tipoActuacion: string;
  fechaActuacion: Date;
  descripcion: string;
  estado: string;
  funcionarioPseudonimo: string; // Solo pseudónimo, nunca ID real
  tieneArchivo: boolean; // Indica si hay documento descargable
  mimeType?: string; // Tipo MIME del archivo
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
  // Autenticación
  | "LOGIN_EXITOSO"
  | "LOGIN_FALLIDO"
  | "LOGOUT"
  | "ACCESO_DENEGADO"
  // Causas
  | "CREACION_CAUSA"
  | "CAMBIO_ESTADO"
  | "CONSULTA_AUDITORIA"
  // Usuarios
  | "CREACION_USUARIO"
  | "MODIFICACION_USUARIO"
  | "BLOQUEO_CUENTA"
  | "DESBLOQUEO_CUENTA"
  // Sprint 3 - HU-JZ-003: Decisiones y Firmas
  | "CREACION_DECISION"
  | "ACTUALIZACION_DECISION"
  | "DECISION_LISTA_FIRMA"
  | "DECISION_FIRMADA"
  | "FIRMA_DENEGADA"
  | "MODIFICACION_DENEGADA"
  | "ELIMINACION_DECISION"
  | "VERIFICACION_FIRMA"
  // Sprint 3 - HU-SJ-004: Notificaciones y Plazos
  | "CREACION_NOTIFICACION"
  | "ENVIO_NOTIFICACION"
  | "ENTREGA_NOTIFICACION"
  | "FALLO_NOTIFICACION"
  | "CREACION_PLAZO"
  | "CAMBIO_ESTADO_PLAZO"
  | "ESCANEO_PLAZOS"
  | "ESCANEO_MANUAL_PLAZOS"
  | "ALERTA_PLAZO_ENVIADA"
  | "LECTURA_ALERTA"
  | string;

export type ModuloAfectado = 
  | "AUTH" 
  | "CASOS" 
  | "ADMIN" 
  | "DOCUMENTOS" 
  | "AUDIENCIAS" 
  | "NOTIFICACIONES"
  | "DECISIONES"
  | "PLAZOS"
  | "FIRMAS";

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
  fechaSubida?: Date; // Alias
  subido_por_id?: number;
  subidoPorId?: number; // Alias
  subidoPor?: string; // Alias - pseudónimo del que subió
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

// Tipos para notificaciones internas del sistema
export type TipoNotificacionInterna = 
  | "causa_asignada"
  | "audiencia_programada"
  | "audiencia_reprogramada"
  | "audiencia_cancelada"
  | "documento_agregado"
  | "plazo_proximo"
  | "sistema";

export type EstadoNotificacionInterna = "no_leida" | "leida" | "archivada";

export type PrioridadNotificacion = "baja" | "normal" | "alta" | "urgente";

export interface NotificacionInterna {
  id: number;
  notificacion_id?: number; // Alias
  destinatarioId: number;
  destinatario_id?: number; // Alias
  tipo: TipoNotificacionInterna;
  titulo: string;
  mensaje: string;
  causaId?: number;
  causa_id?: number; // Alias
  audienciaId?: number;
  audiencia_id?: number; // Alias
  estado: EstadoNotificacionInterna;
  prioridad: PrioridadNotificacion;
  datosAdicionales?: Record<string, any>;
  datos_adicionales?: Record<string, any>; // Alias
  creadoPorId?: number;
  creado_por_id?: number; // Alias
  ipOrigen?: string;
  ip_origen?: string; // Alias
  fechaCreacion: Date;
  fecha_creacion?: Date; // Alias
  fechaLectura?: Date;
  fecha_lectura?: Date; // Alias
  // Campos de JOIN
  numeroProceso?: string;
  numero_proceso?: string; // Alias
}

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

// ============================================================================
// DECISIONES JUDICIALES (HU-JZ-003 - Sprint 3)
// Autos, providencias y sentencias con firma electrónica
// ============================================================================

export type TipoDecision = "AUTO" | "PROVIDENCIA" | "SENTENCIA";

export type EstadoDecision = "BORRADOR" | "LISTA_PARA_FIRMA" | "FIRMADA" | "ANULADA";

/**
 * Decisión judicial (auto, providencia, sentencia)
 * Mapeado a tabla decisiones_judiciales en db_casos
 */
export interface DecisionJudicial {
  decisionId: number;
  decision_id?: number; // Alias BD
  
  // Referencias
  causaId: number;
  causa_id?: number; // Alias BD
  numeroProceso?: string; // JOIN con causas
  
  // Autor
  juezAutorId: number;
  juez_autor_id?: number; // Alias BD
  juezPseudonimo: string;
  juez_pseudonimo?: string; // Alias BD
  
  // Contenido
  tipoDecision: TipoDecision;
  tipo_decision?: TipoDecision; // Alias BD
  titulo: string;
  contenidoBorrador?: string;
  contenido_borrador?: string; // Alias BD
  
  // Estado (máquina de estados)
  estado: EstadoDecision;
  version: number;
  
  // Metadatos de firma (solo cuando estado = FIRMADA)
  fechaFirma?: Date;
  fecha_firma?: Date; // Alias BD
  rutaPdfFirmado?: string;
  ruta_pdf_firmado?: string; // Alias BD
  hashIntegridadPdf?: string;
  hash_integridad_pdf?: string; // Alias BD
  
  // Metadatos de firma electrónica
  certificadoFirmante?: string;
  certificado_firmante?: string; // Alias BD
  numeroSerieCertificado?: string;
  numero_serie_certificado?: string; // Alias BD
  algoritmoFirma?: string;
  algoritmo_firma?: string; // Alias BD
  firmaBase64?: string;
  firma_base64?: string; // Alias BD
  
  // Documento relacionado (opcional)
  documentoId?: number;
  documento_id?: number; // Alias BD
  
  // Auditoría
  fechaCreacion: Date;
  fecha_creacion?: Date; // Alias BD
  fechaActualizacion?: Date;
  fecha_actualizacion?: Date; // Alias BD
  ipCreacion?: string;
  ip_creacion?: string; // Alias BD
}

/**
 * Vista pública de decisión judicial (sin datos sensibles)
 */
export interface DecisionJudicialPublica {
  decisionId: number;
  causaId: number;
  numeroProceso: string;
  tipoDecision: TipoDecision;
  titulo: string;
  estado: EstadoDecision;
  juezPseudonimo: string; // Solo pseudónimo, nunca ID real
  fechaCreacion: Date;
  fechaFirma?: Date;
  version: number;
}

/**
 * Metadatos de firma electrónica
 */
export interface MetadatosFirma {
  certificadoFirmante: string;
  numeroSerieCertificado: string;
  algoritmoFirma: string;
  fechaFirma: Date;
  hashDocumento: string;
  firmaBase64: string;
  verificado: boolean;
}

/**
 * Historial de versiones de una decisión
 */
export interface HistorialDecision {
  historialId: number;
  decisionId: number;
  versionAnterior: number;
  contenidoAnterior?: string;
  estadoAnterior: EstadoDecision;
  modificadoPorId: number;
  fechaModificacion: Date;
  ipOrigen?: string;
  motivoCambio?: string;
}

/**
 * Input para crear decisión judicial
 */
export interface CrearDecisionInput {
  causaId: number;
  tipoDecision: TipoDecision;
  titulo: string;
  contenidoBorrador?: string;
}

/**
 * Input para actualizar decisión judicial
 */
export interface ActualizarDecisionInput {
  titulo?: string;
  contenidoBorrador?: string;
}

/**
 * Input para firmar decisión judicial
 */
export interface FirmarDecisionInput {
  decisionId: number;
  contenidoFinal: string; // HTML/texto final para generar PDF
}

/**
 * Resultado de verificación de firma
 */
export interface VerificacionFirma {
  valido: boolean;
  firmante?: string;
  fechaFirma?: Date;
  hashOriginal?: string;
  hashActual?: string;
  error?: string;
}

// ============================================================================
// NOTIFICACIONES PROCESALES (HU-SJ-004)
// ============================================================================

/**
 * Estados de notificación procesal
 */
export type EstadoNotificacionProcesal = 
  | "PENDIENTE"      // Creada, pendiente de envío
  | "ENVIADA"        // Enviada al destinatario
  | "ENTREGADA"      // Confirmación de entrega
  | "FALLIDA"        // Error en el envío
  | "ANULADA";       // Anulada por el sistema

/**
 * Tipos de destinatario en una notificación
 */
export type TipoDestinatario = 
  | "actor"
  | "demandado" 
  | "abogado_actor"
  | "abogado_demandado"
  | "tercero"
  | "perito"
  | "testigo";

/**
 * Tipos de notificación procesal
 */
export type TipoNotificacionProcesal = 
  | "CITACION"           // Citación a audiencia o comparecencia
  | "TRASLADO"           // Traslado de demanda o recurso
  | "AUTO"               // Notificación de auto
  | "PROVIDENCIA"        // Notificación de providencia
  | "SENTENCIA"          // Notificación de sentencia
  | "REQUERIMIENTO"      // Requerimiento de información/documentos
  | "BOLETA"             // Boleta de notificación general
  | "DEPOSITO_JUDICIAL"; // Notificación de depósito

/**
 * Medios de notificación procesal disponibles
 */
export type MedioNotificacionProcesal = 
  | "ELECTRONICO"        // Email/Sistema
  | "CASILLERO"          // Casillero judicial
  | "PERSONAL"           // Notificación personal
  | "BOLETA";            // Boleta dejada en domicilio

/**
 * Notificación procesal completa
 */
export interface NotificacionProcesal {
  notificacionId: number;
  notificacion_id?: number; // Alias BD
  
  // Referencias
  causaId: number;
  causa_id?: number; // Alias BD
  decisionId?: number;
  decision_id?: number; // Alias BD
  documentoId?: string;
  documento_id?: string; // Alias BD
  
  // Destinatario
  destinatarioTipo: TipoDestinatario;
  destinatario_tipo?: string; // Alias BD
  destinatarioNombre: string;
  destinatario_nombre?: string; // Alias BD
  destinatarioIdentificacion?: string;
  destinatario_identificacion?: string; // Alias BD
  destinatarioCorreo?: string;
  destinatario_correo?: string; // Alias BD
  destinatarioDireccion?: string;
  destinatario_direccion?: string; // Alias BD
  destinatarioCasillero?: string;
  destinatario_casillero?: string; // Alias BD
  
  // Contenido
  tipoNotificacion: TipoNotificacionProcesal;
  tipo_notificacion?: string; // Alias BD
  asunto: string;
  contenido?: string;
  
  // Medio y envío
  medioNotificacion: MedioNotificacionProcesal;
  medio_notificacion?: string; // Alias BD
  estado: EstadoNotificacionProcesal;
  
  // Fechas (CRÍTICO: hora del servidor)
  fechaCreacion: Date;
  fecha_creacion?: Date; // Alias BD
  fechaEnvio?: Date;
  fecha_envio?: Date; // Alias BD
  fechaEntrega?: Date;
  fecha_entrega?: Date; // Alias BD
  
  // Evidencia de entrega
  evidenciaEntrega?: string;
  evidencia_entrega?: string; // Alias BD
  
  // Error si falló
  errorEnvio?: string;
  error_envio?: string; // Alias BD
  
  // Auditoría
  creadoPorId: number;
  creado_por_id?: number; // Alias BD
  enviadoPorId?: number;
  enviado_por_id?: number; // Alias BD
  ipOrigen?: string;
  ip_origen?: string; // Alias BD
}

/**
 * Input para crear notificación procesal
 */
export interface CrearNotificacionInput {
  causaId: number;
  decisionId: number; // OBLIGATORIO: No se permiten notificaciones huérfanas
  tipoNotificacion: TipoNotificacionProcesal;
  destinatarioTipo: TipoDestinatario;
  destinatarioNombre: string;
  destinatarioIdentificacion?: string;
  destinatarioCorreo?: string;
  destinatarioDireccion?: string;
  destinatarioCasillero?: string;
  asunto: string;
  contenido?: string;
  medioNotificacion: MedioNotificacionProcesal;
  tipoActuacionCodigo?: string; // Código del catálogo para crear plazo automático
}

// ============================================================================
// PLAZOS PROCESALES (HU-SJ-004)
// ============================================================================

/**
 * Estados de plazo procesal
 */
export type EstadoPlazo = 
  | "VIGENTE"        // Plazo en curso
  | "CUMPLIDO"       // Cumplido a tiempo
  | "VENCIDO"        // Venció sin cumplimiento
  | "SUSPENDIDO"     // Suspendido temporalmente
  | "EXTENDIDO";     // Extendido por resolución judicial

/**
 * Plazo procesal completo
 */
export interface PlazoProcesal {
  plazoId: number;
  plazo_id?: number; // Alias BD
  
  // Referencias
  causaId: number;
  causa_id?: number; // Alias BD
  notificacionId?: number;
  notificacion_id?: number; // Alias BD
  decisionId?: number;
  decision_id?: number; // Alias BD
  
  // Descripción
  tipoPlazo: string;
  tipo_plazo?: string; // Alias BD
  descripcion: string;
  
  // Parte afectada
  parteResponsable?: TipoDestinatario | "ambas_partes";
  parte_responsable?: string; // Alias BD
  
  // Fechas (CRÍTICO: cálculo de días hábiles)
  fechaInicio: Date;
  fecha_inicio?: Date; // Alias BD
  diasPlazo: number;
  dias_plazo?: number; // Alias BD
  fechaVencimiento: Date;
  fecha_vencimiento?: Date; // Alias BD
  
  // Estado
  estado: EstadoPlazo;
  
  // Alertas enviadas
  alertaEnviada3Dias: boolean;
  alerta_enviada_3_dias?: boolean; // Alias BD
  alertaEnviada1Dia: boolean;
  alerta_enviada_1_dia?: boolean; // Alias BD
  alertaEnviadaVencido: boolean;
  alerta_enviada_vencido?: boolean; // Alias BD
  
  // Suspensión
  suspendido: boolean;
  fechaSuspension?: Date;
  fecha_suspension?: Date; // Alias BD
  motivoSuspension?: string;
  motivo_suspension?: string; // Alias BD
  fechaReanudacion?: Date;
  fecha_reanudacion?: Date; // Alias BD
  
  // Cumplimiento
  fechaCumplimiento?: Date;
  fecha_cumplimiento?: Date; // Alias BD
  documentoCumplimientoId?: string;
  documento_cumplimiento_id?: string; // Alias BD
  
  // Auditoría
  fechaCreacion: Date;
  fecha_creacion?: Date; // Alias BD
  fechaActualizacion?: Date;
  fecha_actualizacion?: Date; // Alias BD
  creadoPorId: number;
  creado_por_id?: number; // Alias BD
}

/**
 * Input para crear plazo procesal
 */
export interface CrearPlazoInput {
  causaId: number;
  notificacionId?: number;
  decisionId?: number;
  tipoPlazo: string;
  descripcion: string;
  parteResponsable?: TipoDestinatario | "ambas_partes";
  diasPlazo: number;
  fechaInicio?: Date; // Si no se proporciona, usa NOW() del servidor
}

/**
 * Catálogo de tipos de actuación
 */
export interface TipoActuacion {
  tipoId: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  plazoDiasHabiles: number;
  parteResponsableDefault?: string;
  materia?: string;
  activo: boolean;
}

/**
 * Día inhábil (feriado/vacaciones judiciales)
 */
export interface DiaInhabil {
  diaId: number;
  fecha: Date;
  descripcion: string;
  esRecurrente: boolean;
  activo: boolean;
}

/**
 * Alerta de plazo próximo a vencer
 */
export interface AlertaPlazo {
  plazoId: number;
  causaId: number;
  numeroProceso: string;
  tipoPlazo: string;
  descripcion: string;
  fechaVencimiento: Date;
  diasRestantes: number;
  parteResponsable?: string;
  juezId: number;
  secretarioId?: number;
  nivelAlerta: "CRITICO" | "URGENTE" | "INFORMATIVO"; // <24h, 1-3 días, >3 días
}

/**
 * Resultado del cálculo de fecha de vencimiento
 */
export interface CalculoVencimiento {
  fechaInicio: Date;
  diasHabiles: number;
  fechaVencimiento: Date;
  diasSaltados: number; // Fines de semana y feriados saltados
  detalleDias: Array<{
    fecha: Date;
    esHabil: boolean;
    motivo?: string;
  }>;
}

