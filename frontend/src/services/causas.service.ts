// ============================================================================
// JUEZ SEGURO - Servicio de Causas
// CRUD y operaciones para causas judiciales
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { 
  Causa, 
  CausaDetalle, 
  CrearCausaRequest,
  Documento,
  Audiencia,
  Actuacion
} from "@/types";

export interface FiltrosCausas {
  estado?: string;
  materia?: string;
  prioridad?: string;
  juezId?: string;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

export const causasService = {
  /**
   * Obtiene lista de causas con filtros y paginación
   */
  async getCausas(filtros?: FiltrosCausas): Promise<PaginatedResponse<Causa>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.materia) params.materia = filtros.materia;
      if (filtros.prioridad) params.prioridad = filtros.prioridad;
      if (filtros.juezId) params.juezId = filtros.juezId;
      if (filtros.busqueda) params.q = filtros.busqueda;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<Causa>>("/causas", params);
  },

  /**
   * Obtiene una causa por ID con todos sus detalles
   */
  async getCausaById(id: string): Promise<CausaDetalle> {
    const response = await api.get<ApiResponse<CausaDetalle>>(`/causas/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Causa no encontrada");
  },

  /**
   * Crea una nueva causa
   */
  async crearCausa(data: CrearCausaRequest): Promise<Causa> {
    const response = await api.post<ApiResponse<Causa>>("/causas", data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al crear la causa");
  },

  /**
   * Actualiza una causa existente
   */
  async actualizarCausa(id: string, data: Partial<Causa>): Promise<Causa> {
    const response = await api.put<ApiResponse<Causa>>(`/causas/${id}`, data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al actualizar la causa");
  },

  /**
   * Cambia el estado de una causa
   */
  async cambiarEstado(id: string, estado: Causa["estado"]): Promise<Causa> {
    const response = await api.patch<ApiResponse<Causa>>(`/causas/${id}/estado`, { estado });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al cambiar el estado");
  },

  /**
   * Asigna un juez a una causa
   */
  async asignarJuez(causaId: string, juezId: string): Promise<Causa> {
    const response = await api.patch<ApiResponse<Causa>>(`/causas/${causaId}/asignar`, { juezId });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al asignar el juez");
  },

  /**
   * Obtiene documentos de una causa
   */
  async getDocumentos(causaId: string): Promise<Documento[]> {
    const response = await api.get<ApiResponse<Documento[]>>(`/causas/${causaId}/documentos`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene audiencias de una causa
   */
  async getAudiencias(causaId: string): Promise<Audiencia[]> {
    const response = await api.get<ApiResponse<Audiencia[]>>(`/causas/${causaId}/audiencias`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene actuaciones de una causa (para ciudadano)
   */
  async getActuaciones(causaId: string): Promise<Actuacion[]> {
    const response = await api.get<ApiResponse<Actuacion[]>>(`/causas/${causaId}/actuaciones`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },
};
