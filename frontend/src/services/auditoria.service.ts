// ============================================================================
// JUEZ SEGURO - Servicio de Auditoría
// Consulta de logs de auditoría (solo CJ)
// HU-CJ-003: Revisión de registros de actividad
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { LogAuditoria, FiltrosAuditoria, ResultadoAuditoria } from "@/types";

export interface FiltrosAuditoriaExtendidos extends FiltrosAuditoria {
  usuarioCorreo?: string;
  tipoEvento?: string;
  moduloAfectado?: string;
  causaReferencia?: string;
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

export interface ResultadoVerificacionCadena {
  totalRegistros: number;
  registrosValidos: number;
  registrosRotos: number;
  primerErrorId: number | null;
  integridadOk: boolean;
}

export const auditoriaService = {
  /**
   * Obtiene logs de auditoría con filtros y paginación
   */
  async getLogs(filtros?: FiltrosAuditoriaExtendidos): Promise<PaginatedResponse<LogAuditoria>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.usuarioCorreo) params.usuarioCorreo = filtros.usuarioCorreo;
      if (filtros.tipoEvento) params.tipoEvento = filtros.tipoEvento;
      if (filtros.moduloAfectado) params.moduloAfectado = filtros.moduloAfectado;
      if (filtros.causaReferencia) params.causaReferencia = filtros.causaReferencia;
      if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
      if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<LogAuditoria>>("/auditoria", params);
  },

  /**
   * Obtiene un log por ID
   */
  async getLogById(id: string): Promise<LogAuditoria> {
    const response = await api.get<ApiResponse<LogAuditoria>>(`/auditoria/${id}`);
    
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
  async exportarLogs(filtros?: FiltrosAuditoriaExtendidos): Promise<Blob> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.usuarioCorreo) params.usuarioCorreo = filtros.usuarioCorreo;
      if (filtros.tipoEvento) params.tipoEvento = filtros.tipoEvento;
      if (filtros.moduloAfectado) params.moduloAfectado = filtros.moduloAfectado;
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
   * Obtiene tipos de evento disponibles
   */
  async getTiposEvento(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>("/auditoria/tipos-evento");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
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

  /**
   * Obtiene usuarios que aparecen en los logs de auditoría
   */
  async getUsuariosEnLogs(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>("/auditoria/usuarios");
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Verifica la integridad de la cadena de hashes
   */
  async verificarCadena(fechaDesde?: string, fechaHasta?: string): Promise<ResultadoVerificacionCadena> {
    const params: Record<string, string> = {};
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;
    
    const response = await api.get<ApiResponse<ResultadoVerificacionCadena>>(
      "/auditoria/verificar-cadena",
      params
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error("Error al verificar integridad");
  },

  /**
   * Obtiene estadísticas globales de auditoría
   */
  async getEstadisticasGlobales(filtros?: FiltrosAuditoriaExtendidos): Promise<{
    total: number;
    exitosas: number;
    errores: number;
    denegadas: number;
  }> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.usuarioCorreo) params.usuarioCorreo = filtros.usuarioCorreo;
      if (filtros.tipoEvento) params.tipoEvento = filtros.tipoEvento;
      if (filtros.moduloAfectado) params.moduloAfectado = filtros.moduloAfectado;
      if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
      if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
    }
    
    const response = await api.get<ApiResponse<{
      total: number;
      exitosas: number;
      errores: number;
      denegadas: number;
    }>>("/auditoria/estadisticas", params);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return { total: 0, exitosas: 0, errores: 0, denegadas: 0 };
  },
};
