// ============================================================================
// JUEZ SEGURO - Servicio de Audiencias
// Gestión de audiencias judiciales
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { Audiencia, ProgramarAudienciaRequest } from "@/types";

export interface FiltrosAudiencias {
  causaId?: string;
  estado?: string;
  tipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

export const audienciasService = {
  /**
   * Obtiene lista de audiencias con filtros
   */
  async getAudiencias(filtros?: FiltrosAudiencias): Promise<PaginatedResponse<Audiencia>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.causaId) params.causaId = filtros.causaId;
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.tipo) params.tipo = filtros.tipo;
      if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
      if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<Audiencia>>("/audiencias", params);
  },

  /**
   * Obtiene una audiencia por ID
   */
  async getAudienciaById(id: string): Promise<Audiencia> {
    const response = await api.get<ApiResponse<Audiencia>>(`/audiencias/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Audiencia no encontrada");
  },

  /**
   * Programa una nueva audiencia
   */
  async programarAudiencia(data: ProgramarAudienciaRequest): Promise<Audiencia> {
    const response = await api.post<ApiResponse<Audiencia>>("/audiencias", data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al programar la audiencia");
  },

  /**
   * Reprograma una audiencia existente
   */
  async reprogramarAudiencia(
    id: string, 
    data: { fecha: string; hora: string; motivo: string }
  ): Promise<Audiencia> {
    const response = await api.patch<ApiResponse<Audiencia>>(`/audiencias/${id}/reprogramar`, data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al reprogramar la audiencia");
  },

  /**
   * Cancela una audiencia
   */
  async cancelarAudiencia(id: string, motivo: string): Promise<Audiencia> {
    const response = await api.patch<ApiResponse<Audiencia>>(`/audiencias/${id}/cancelar`, { motivo });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al cancelar la audiencia");
  },

  /**
   * Marca una audiencia como realizada
   */
  async marcarRealizada(id: string, notas?: string): Promise<Audiencia> {
    const response = await api.patch<ApiResponse<Audiencia>>(`/audiencias/${id}/realizada`, { notas });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al marcar la audiencia");
  },

  /**
   * Obtiene audiencias del día
   */
  async getAudienciasHoy(): Promise<Audiencia[]> {
    const hoy = new Date().toISOString().split("T")[0];
    const response = await api.get<ApiResponse<Audiencia[]>>("/audiencias/hoy", { fecha: hoy });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene agenda semanal
   */
  async getAgendaSemanal(): Promise<Audiencia[]> {
    const response = await api.get<ApiResponse<Audiencia[]>>("/audiencias/semana");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },
};
