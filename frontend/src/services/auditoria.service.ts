// ============================================================================
// JUEZ SEGURO - Servicio de Auditoría
// Consulta de logs de auditoría (solo CJ)
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { LogAuditoria, FiltrosAuditoria, ResultadoAuditoria } from "@/types";

export interface FiltrosAuditoriaExtendidos extends FiltrosAuditoria {
  page?: number;
  pageSize?: number;
}

export interface EstadisticasAuditoria {
  totalEventos: number;
  eventosPorResultado: Record<ResultadoAuditoria, number>;
  eventosPorModulo: Record<string, number>;
  eventosPorDia: Array<{ fecha: string; cantidad: number }>;
  alertasSeguridad: number;
}

export const auditoriaService = {
  /**
   * Obtiene logs de auditoría con filtros
   */
  async getLogs(filtros?: FiltrosAuditoriaExtendidos): Promise<PaginatedResponse<LogAuditoria>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.usuario) params.usuario = filtros.usuario;
      if (filtros.modulo) params.modulo = filtros.modulo;
      if (filtros.resultado) params.resultado = filtros.resultado;
      if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
      if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<LogAuditoria>>("/auditoria/logs", params);
  },

  /**
   * Obtiene un log por ID
   */
  async getLogById(id: string): Promise<LogAuditoria> {
    const response = await api.get<ApiResponse<LogAuditoria>>(`/auditoria/logs/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Log no encontrado");
  },

  /**
   * Obtiene estadísticas de auditoría
   */
  async getEstadisticas(periodo?: { desde: string; hasta: string }): Promise<EstadisticasAuditoria> {
    const params: Record<string, string> = {};
    
    if (periodo) {
      params.fechaDesde = periodo.desde;
      params.fechaHasta = periodo.hasta;
    }
    
    const response = await api.get<ApiResponse<EstadisticasAuditoria>>(
      "/auditoria/estadisticas",
      params
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al obtener estadísticas");
  },

  /**
   * Obtiene alertas de seguridad
   */
  async getAlertasSeguridad(): Promise<LogAuditoria[]> {
    const response = await api.get<ApiResponse<LogAuditoria[]>>("/auditoria/alertas");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtiene accesos fallidos recientes
   */
  async getAccesosFallidos(limite?: number): Promise<LogAuditoria[]> {
    const params: Record<string, string> = {};
    if (limite) params.limite = limite.toString();
    
    const response = await api.get<ApiResponse<LogAuditoria[]>>(
      "/auditoria/accesos-fallidos",
      params
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Exporta logs de auditoría en formato CSV
   */
  async exportarLogs(filtros?: FiltrosAuditoria): Promise<Blob> {
    const params: Record<string, string> = { formato: "csv" };
    
    if (filtros) {
      if (filtros.usuario) params.usuario = filtros.usuario;
      if (filtros.modulo) params.modulo = filtros.modulo;
      if (filtros.resultado) params.resultado = filtros.resultado;
      if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
      if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
    }

    const token = localStorage.getItem("authToken");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = new URL(`${import.meta.env.VITE_API_URL || "http://localhost:3000/api"}/auditoria/exportar`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Error al exportar los logs");
    }

    return response.blob();
  },

  /**
   * Obtiene módulos disponibles para filtrar
   */
  async getModulos(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>("/auditoria/modulos");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },
};
