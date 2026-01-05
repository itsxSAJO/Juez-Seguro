// ============================================================================
// JUEZ SEGURO - Servicio de Consulta Ciudadana
// Búsqueda pública de procesos (datos anonimizados)
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { ProcesoPublico, Actuacion, BusquedaProcesoRequest } from "@/types";

export const consultaCiudadanaService = {
  /**
   * Busca procesos por criterio (público, sin autenticación)
   * Los datos retornados están anonimizados
   */
  async buscarProcesos(
    query: string,
    tipo: BusquedaProcesoRequest["tipo"],
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<ProcesoPublico>> {
    const params: Record<string, string> = {
      q: query,
      tipo,
      page: page.toString(),
      pageSize: pageSize.toString(),
    };
    
    return api.get<PaginatedResponse<ProcesoPublico>>("/publico/procesos/buscar", params);
  },

  /**
   * Obtiene detalle de un proceso por ID (público)
   * Solo retorna información pública con datos anonimizados
   */
  async getProcesoById(id: string): Promise<ProcesoPublico | null> {
    try {
      const response = await api.get<ApiResponse<ProcesoPublico>>(`/publico/procesos/${id}`);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Obtiene actuaciones públicas de un proceso
   * Las actuaciones están anonimizadas (sin nombres reales)
   */
  async getActuaciones(procesoId: string): Promise<Actuacion[]> {
    try {
      const response = await api.get<ApiResponse<Actuacion[]>>(
        `/publico/procesos/${procesoId}/actuaciones`
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Valida un número de expediente
   */
  async validarExpediente(numeroExpediente: string): Promise<{ valido: boolean; existe: boolean }> {
    try {
      const response = await api.get<ApiResponse<{ valido: boolean; existe: boolean }>>(
        "/publico/procesos/validar",
        { expediente: numeroExpediente }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return { valido: false, existe: false };
    } catch {
      return { valido: false, existe: false };
    }
  },

  /**
   * Obtiene estadísticas públicas (sin datos sensibles)
   */
  async getEstadisticasPublicas(): Promise<{
    totalProcesos: number;
    procesosPorMateria: Record<string, number>;
    procesosPorEstado: Record<string, number>;
  }> {
    try {
      const response = await api.get<ApiResponse<{
        totalProcesos: number;
        procesosPorMateria: Record<string, number>;
        procesosPorEstado: Record<string, number>;
      }>>("/publico/estadisticas");
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return {
        totalProcesos: 0,
        procesosPorMateria: {},
        procesosPorEstado: {},
      };
    } catch {
      return {
        totalProcesos: 0,
        procesosPorMateria: {},
        procesosPorEstado: {},
      };
    }
  },
};
