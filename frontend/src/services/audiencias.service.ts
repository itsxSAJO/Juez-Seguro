// ============================================================================
// JUEZ SEGURO - Servicio de Audiencias
// HU-SJ-003: Gestión de audiencias judiciales
// HU-JZ-002: Consulta de la agenda de audiencias del juez
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

// Interfaz para historial de reprogramaciones
export interface HistorialReprogramacion {
  historialId: number;
  audienciaId: number;
  fechaHoraAnterior: string;
  salaAnterior: string | null;
  fechaHoraNueva: string;
  salaNueva: string | null;
  motivoReprogramacion: string;
  tipoCambio: "REPROGRAMACION" | "CANCELACION" | "CAMBIO_SALA";
  modificadoPorSecretarioId: number;
  modificadoPorRol: string;
  fechaModificacion: string;
  ipModificacion: string | null;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
}

// Audiencia extendida con historial para el frontend
export interface AudienciaConHistorial extends Audiencia {
  historialCambios?: HistorialReprogramacion[];
  fueReprogramada?: boolean;
}

export const audienciasService = {
  /**
   * Obtiene lista de audiencias con filtros
   */
  async getAudiencias(filtros?: FiltrosAudiencias): Promise<PaginatedResponse<AudienciaConHistorial>> {
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
    
    return api.get<PaginatedResponse<AudienciaConHistorial>>("/audiencias", params);
  },

  /**
   * Obtiene una audiencia por ID con su historial
   */
  async getAudienciaById(id: string): Promise<AudienciaConHistorial> {
    const response = await api.get<ApiResponse<AudienciaConHistorial>>(`/audiencias/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Audiencia no encontrada");
  },

  /**
   * Programa una nueva audiencia
   * HU-SJ-003: Valida que la fecha sea futura
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
   * HU-SJ-003: Guarda historial para trazabilidad
   */
  async reprogramarAudiencia(
    id: string, 
    data: { nuevaFecha: string; motivo: string }
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
    const response = await api.patch<ApiResponse<Audiencia>>(`/audiencias/${id}/estado`, { 
      estado: "cancelada",
      motivo 
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al cancelar la audiencia");
  },

  /**
   * Marca una audiencia como realizada
   */
  async marcarRealizada(id: string, notas?: string): Promise<Audiencia> {
    const response = await api.patch<ApiResponse<Audiencia>>(`/audiencias/${id}/estado`, { 
      estado: "realizada",
      notas 
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al marcar la audiencia");
  },

  /**
   * Obtiene audiencias del día con indicadores de reprogramación
   * HU-JZ-002: Para la agenda del juez
   */
  async getAudienciasHoy(): Promise<AudienciaConHistorial[]> {
    const response = await api.get<ApiResponse<AudienciaConHistorial[]>>("/audiencias/hoy");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene agenda semanal con indicadores de reprogramación
   * HU-JZ-002: Para la agenda del juez
   */
  async getAgendaSemanal(): Promise<AudienciaConHistorial[]> {
    const response = await api.get<ApiResponse<AudienciaConHistorial[]>>("/audiencias/semana");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene la agenda completa del juez con historial
   * HU-JZ-002: Consulta de la agenda de audiencias del juez
   */
  async getAgendaJuez(fechaDesde?: string, fechaHasta?: string): Promise<AudienciaConHistorial[]> {
    const params: Record<string, string> = {};
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;

    const response = await api.get<ApiResponse<AudienciaConHistorial[]>>("/audiencias/agenda", params);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene audiencias reprogramadas recientemente
   * HU-JZ-002: Para alertar al juez de cambios en su agenda
   */
  async getAudienciasReprogramadasRecientes(dias: number = 7): Promise<{
    audiencias: AudienciaConHistorial[];
    mensaje: string;
  }> {
    const response = await api.get<ApiResponse<AudienciaConHistorial[]> & { mensaje?: string }>(
      "/audiencias/reprogramadas-recientes",
      { dias: dias.toString() }
    );
    
    if (response.success && response.data) {
      return {
        audiencias: response.data,
        mensaje: response.mensaje || `${response.data.length} audiencia(s) reprogramadas`,
      };
    }
    
    return { audiencias: [], mensaje: "No hay audiencias reprogramadas recientemente" };
  },

  /**
   * Obtiene el historial de reprogramaciones de una audiencia
   * HU-JZ-002: Para que el juez sepa si le movieron la agenda
   */
  async getHistorialReprogramaciones(audienciaId: string): Promise<HistorialReprogramacion[]> {
    const response = await api.get<ApiResponse<HistorialReprogramacion[]>>(
      `/audiencias/${audienciaId}/historial`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },
};
