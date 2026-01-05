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
};
