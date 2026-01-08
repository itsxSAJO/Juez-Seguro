// ============================================================================
// JUEZ SEGURO - Servicio de Notificaciones
// Gestión de notificaciones judiciales
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { Notificacion, EnviarNotificacionRequest } from "@/types";

export interface FiltrosNotificaciones {
  causaId?: string;
  estado?: string;
  tipo?: string;
  page?: number;
  pageSize?: number;
}

export const notificacionesService = {
  /**
   * Obtiene lista de notificaciones con filtros
   */
  async getNotificaciones(filtros?: FiltrosNotificaciones): Promise<PaginatedResponse<Notificacion>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.causaId) params.causaId = filtros.causaId;
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.tipo) params.tipo = filtros.tipo;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<Notificacion>>("/notificaciones", params);
  },

  /**
   * Obtiene una notificación por ID
   */
  async getNotificacionById(id: string): Promise<Notificacion> {
    const response = await api.get<ApiResponse<Notificacion>>(`/notificaciones/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Notificación no encontrada");
  },

  /**
   * Envía una nueva notificación
   */
  async enviarNotificacion(data: EnviarNotificacionRequest): Promise<Notificacion> {
    const response = await api.post<ApiResponse<Notificacion>>("/notificaciones", data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al enviar la notificación");
  },

  /**
   * Marca una notificación como recibida
   */
  async marcarRecibida(id: string): Promise<Notificacion> {
    const response = await api.patch<ApiResponse<Notificacion>>(`/notificaciones/${id}/recibida`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al actualizar la notificación");
  },

  /**
   * Reenvía una notificación
   */
  async reenviarNotificacion(id: string): Promise<Notificacion> {
    const response = await api.post<ApiResponse<Notificacion>>(`/notificaciones/${id}/reenviar`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al reenviar la notificación");
  },

  /**
   * Obtiene notificaciones pendientes
   */
  async getPendientes(): Promise<Notificacion[]> {
    const response = await api.get<ApiResponse<Notificacion[]>>("/notificaciones/pendientes");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene notificaciones vencidas
   */
  async getVencidas(): Promise<Notificacion[]> {
    const response = await api.get<ApiResponse<Notificacion[]>>("/notificaciones/vencidas");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene conteo por estado
   */
  async getConteoEstados(): Promise<Record<string, number>> {
    const response = await api.get<ApiResponse<Record<string, number>>>("/notificaciones/conteo");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return {};
  },

  // ==========================================================================
  // NOTIFICACIONES INTERNAS DEL SISTEMA
  // ==========================================================================

  /**
   * Obtiene las notificaciones internas del usuario actual
   */
  async getMisNotificaciones(filtros?: {
    estado?: "no_leida" | "leida" | "archivada" | "todas";
    tipo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ notificaciones: NotificacionInterna[]; total: number; noLeidas: number }> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.tipo) params.tipo = filtros.tipo;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }

    const response = await api.get<{
      success: boolean;
      data: NotificacionInterna[];
      total: number;
      noLeidas: number;
    }>("/notificaciones/internas/mis-notificaciones", params);

    if (response.success && response.data) {
      return {
        notificaciones: response.data,
        total: response.total || 0,
        noLeidas: response.noLeidas || 0,
      };
    }

    return { notificaciones: [], total: 0, noLeidas: 0 };
  },

  /**
   * Obtiene el conteo de notificaciones no leídas
   */
  async getConteoNoLeidas(): Promise<number> {
    const response = await api.get<{ success: boolean; data: { noLeidas: number } }>(
      "/notificaciones/internas/conteo"
    );

    if (response.success && response.data) {
      return response.data.noLeidas;
    }

    return 0;
  },

  /**
   * Marca una notificación interna como leída
   */
  async marcarLeida(id: number): Promise<NotificacionInterna | null> {
    const response = await api.patch<ApiResponse<NotificacionInterna>>(
      `/notificaciones/internas/${id}/leer`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  },

  /**
   * Marca todas las notificaciones como leídas
   */
  async marcarTodasLeidas(): Promise<number> {
    const response = await api.patch<{ success: boolean; data: { marcadas: number } }>(
      "/notificaciones/internas/marcar-todas-leidas"
    );

    if (response.success && response.data) {
      return response.data.marcadas;
    }

    return 0;
  },

  /**
   * Archiva una notificación interna
   */
  async archivar(id: number): Promise<NotificacionInterna | null> {
    const response = await api.patch<ApiResponse<NotificacionInterna>>(
      `/notificaciones/internas/${id}/archivar`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  },
};

// Tipo para notificaciones internas
export interface NotificacionInterna {
  id: number;
  destinatarioId: number;
  tipo: "causa_asignada" | "audiencia_programada" | "audiencia_reprogramada" | "audiencia_cancelada" | "documento_agregado" | "plazo_proximo" | "sistema";
  titulo: string;
  mensaje: string;
  causaId?: number;
  audienciaId?: number;
  estado: "no_leida" | "leida" | "archivada";
  prioridad: "baja" | "normal" | "alta" | "urgente";
  datosAdicionales?: Record<string, any>;
  fechaCreacion: string;
  fechaLectura?: string;
  numeroProceso?: string;
}
