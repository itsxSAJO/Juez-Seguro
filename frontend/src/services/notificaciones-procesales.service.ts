// ============================================================================
// JUEZ SEGURO - Servicio de Notificaciones Procesales (HU-SJ-004)
// Notificaciones legales a las partes del proceso
// ============================================================================

import { api, ApiResponse } from "./api";

// ============================================================================
// TIPOS
// ============================================================================

export type EstadoNotificacionProcesal = 
  | "PENDIENTE"
  | "ENVIADA"
  | "ENTREGADA"
  | "FALLIDA"
  | "ANULADA";

export type TipoDestinatario = 
  | "actor"
  | "demandado"
  | "abogado_actor"
  | "abogado_demandado"
  | "tercero"
  | "perito"
  | "testigo";

export type TipoNotificacionProcesal = 
  | "CITACION"
  | "TRASLADO"
  | "AUTO"
  | "PROVIDENCIA"
  | "SENTENCIA"
  | "REQUERIMIENTO"
  | "BOLETA"
  | "DEPOSITO_JUDICIAL";

export type MedioNotificacionProcesal = 
  | "ELECTRONICO"
  | "CASILLERO"
  | "PERSONAL"
  | "BOLETA";

export interface NotificacionProcesal {
  notificacionId: number;
  causaId: number;
  decisionId?: number;
  documentoId?: string;
  
  // Destinatario
  destinatarioTipo: TipoDestinatario;
  destinatarioNombre: string;
  destinatarioIdentificacion?: string;
  destinatarioCorreo?: string;
  destinatarioDireccion?: string;
  destinatarioCasillero?: string;
  
  // Contenido
  tipoNotificacion: TipoNotificacionProcesal;
  asunto: string;
  contenido?: string;
  
  // Medio y envío
  medioNotificacion: MedioNotificacionProcesal;
  estado: EstadoNotificacionProcesal;
  
  // Fechas
  fechaCreacion: string;
  fechaEnvio?: string;
  fechaEntrega?: string;
  
  // Evidencia
  evidenciaEntrega?: string;
  errorEnvio?: string;
  
  // Auditoría
  creadoPorId: number;
  creadoPorNombre?: string;
  ipOrigen?: string;
  
  // Relaciones (información de la causa y decisión)
  numeroProceso?: string;
  tipoDecision?: string;
  decisionTitulo?: string;
}

export interface CrearNotificacionProcesalInput {
  causaId: number;
  decisionId: number;
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
  tipoActuacionCodigo?: string;
}

export interface FiltrosNotificacionesProcesal {
  causaId?: number;
  decisionId?: number;
  estado?: EstadoNotificacionProcesal;
  destinatarioTipo?: TipoDestinatario;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// SERVICIO
// ============================================================================

export const notificacionesProcesalesService = {
  /**
   * Crear nueva notificación procesal
   * Solo SECRETARIO puede crear
   */
  async crear(input: CrearNotificacionProcesalInput): Promise<NotificacionProcesal> {
    const response = await api.post<ApiResponse<NotificacionProcesal>>(
      "/notificaciones-procesales",
      input
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || "Error al crear notificación procesal");
  },

  /**
   * Listar notificaciones por causa
   */
  async listarPorCausa(
    causaId: number,
    filtros?: { estado?: EstadoNotificacionProcesal; destinatarioTipo?: string }
  ): Promise<NotificacionProcesal[]> {
    const params: Record<string, string> = {};
    if (filtros?.estado) params.estado = filtros.estado;
    if (filtros?.destinatarioTipo) params.destinatarioTipo = filtros.destinatarioTipo;
    
    const response = await api.get<{ success: boolean; data: NotificacionProcesal[] }>(
      `/notificaciones-procesales/causa/${causaId}`,
      params
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Listar notificaciones por decisión
   */
  async listarPorDecision(decisionId: number): Promise<NotificacionProcesal[]> {
    const response = await api.get<{ success: boolean; data: NotificacionProcesal[] }>(
      `/notificaciones-procesales/decision/${decisionId}`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtener notificación por ID
   */
  async obtenerPorId(id: number): Promise<NotificacionProcesal | null> {
    const response = await api.get<ApiResponse<NotificacionProcesal>>(
      `/notificaciones-procesales/${id}`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return null;
  },

  /**
   * Confirmar entrega de notificación
   * Solo SECRETARIO puede confirmar
   */
  async confirmarEntrega(
    id: number,
    evidencia: string
  ): Promise<NotificacionProcesal> {
    const response = await api.put<ApiResponse<NotificacionProcesal>>(
      `/notificaciones-procesales/${id}/confirmar-entrega`,
      { evidencia }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || "Error al confirmar entrega");
  },

  /**
   * Registrar fallo en el envío
   */
  async registrarFallo(id: number, error: string): Promise<NotificacionProcesal> {
    const response = await api.put<ApiResponse<NotificacionProcesal>>(
      `/notificaciones-procesales/${id}/registrar-fallo`,
      { error }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || "Error al registrar fallo");
  },

  /**
   * Obtener estadísticas de notificaciones por causa
   */
  async obtenerEstadisticas(causaId: number): Promise<{
    total: number;
    pendientes: number;
    enviadas: number;
    entregadas: number;
    fallidas: number;
  }> {
    const response = await api.get<ApiResponse<{
      total: number;
      pendientes: number;
      enviadas: number;
      entregadas: number;
      fallidas: number;
    }>>(`/notificaciones-procesales/estadisticas/${causaId}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return { total: 0, pendientes: 0, enviadas: 0, entregadas: 0, fallidas: 0 };
  },
};

export default notificacionesProcesalesService;
