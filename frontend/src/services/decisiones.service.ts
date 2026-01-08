// ============================================================================
// JUEZ SEGURO - Servicio de Decisiones Judiciales
// HU-JZ-003: Elaboración y firma de decisiones con PKI
// ============================================================================

import { api, ApiResponse } from "./api";

// ============================================================================
// TIPOS
// ============================================================================

export type TipoDecision = "AUTO" | "PROVIDENCIA" | "SENTENCIA";
export type EstadoDecision = "BORRADOR" | "LISTA_PARA_FIRMA" | "FIRMADA" | "ANULADA";

export interface DecisionJudicial {
  decisionId: number;
  causaId: number;
  numeroProceso?: string;
  juezAutorId: number;
  juezPseudonimo: string;
  tipoDecision: TipoDecision;
  titulo: string;
  contenidoBorrador?: string;
  estado: EstadoDecision;
  version: number;
  fechaFirma?: string;
  rutaPdfFirmado?: string;
  hashIntegridadPdf?: string;
  certificadoFirmante?: string;
  numeroSerieCertificado?: string;
  algoritmoFirma?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface CrearDecisionRequest {
  causaId: number;
  tipoDecision: TipoDecision;
  titulo: string;
  contenidoBorrador?: string;
}

export interface ActualizarDecisionRequest {
  titulo?: string;
  contenidoBorrador?: string;
}

export interface FirmaResult {
  decision: DecisionJudicial;
  mensaje: string;
  firmaInfo: {
    hash: string;
    algoritmo: string;
    certificado: string;
    fechaFirma: string;
    numeroSerie: string;
  };
  pdfUrl?: string;
}

export interface VerificacionFirma {
  valida: boolean;
  mensaje: string;
  detalles?: {
    firmante: string;
    certificadoValido: boolean;
    fechaFirma: string;
    hashOriginal: string;
    hashActual: string;
    hashCoincide: boolean;
  };
}

export interface HistorialDecision {
  historialId: number;
  version: number;
  estadoAnterior: EstadoDecision;
  estadoNuevo: EstadoDecision;
  usuarioId: number;
  usuarioPseudonimo: string;
  descripcionCambio: string;
  fechaCambio: string;
}

export interface FiltrosDecisiones {
  causaId?: number;
  estado?: EstadoDecision;
  tipo?: TipoDecision;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// SERVICIO
// ============================================================================

class DecisionesService {
  /**
   * Crear nueva decisión (borrador)
   */
  async crearDecision(data: CrearDecisionRequest): Promise<DecisionJudicial> {
    const response = await api.post<ApiResponse<DecisionJudicial>>("/decisiones", data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al crear la decisión");
  }

  /**
   * Obtener decisiones del juez autenticado
   * Usa GET /api/decisiones con filtros (el backend filtra según rol)
   */
  async listarMisDecisiones(filtros?: FiltrosDecisiones): Promise<DecisionJudicial[]> {
    const params = new URLSearchParams();
    if (filtros?.causaId) params.append("causaId", filtros.causaId.toString());
    if (filtros?.estado) params.append("estado", filtros.estado);
    if (filtros?.tipo) params.append("tipoDecision", filtros.tipo); // Backend usa tipoDecision
    if (filtros?.page) params.append("page", filtros.page.toString());
    if (filtros?.pageSize) params.append("pageSize", filtros.pageSize.toString());

    const queryString = params.toString();
    const url = `/decisiones${queryString ? `?${queryString}` : ""}`;
    
    const response = await api.get<ApiResponse<DecisionJudicial[]>>(url);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al obtener decisiones");
  }

  /**
   * Obtener decisiones de una causa específica
   * Usa GET /api/decisiones con filtro causaId
   */
  async listarPorCausa(causaId: number): Promise<DecisionJudicial[]> {
    const response = await api.get<ApiResponse<DecisionJudicial[]>>(`/decisiones?causaId=${causaId}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al obtener decisiones de la causa");
  }

  /**
   * Obtener detalle de una decisión
   */
  async obtenerDecision(decisionId: number): Promise<DecisionJudicial> {
    const response = await api.get<ApiResponse<DecisionJudicial>>(`/decisiones/${decisionId}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al obtener la decisión");
  }

  /**
   * Actualizar decisión (solo borradores)
   */
  async actualizarDecision(decisionId: number, data: ActualizarDecisionRequest): Promise<DecisionJudicial> {
    const response = await api.put<ApiResponse<DecisionJudicial>>(`/decisiones/${decisionId}`, data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al actualizar la decisión");
  }

  /**
   * Marcar decisión como lista para firma
   * Backend usa POST /api/decisiones/:id/preparar
   */
  async marcarListaParaFirma(decisionId: number): Promise<DecisionJudicial> {
    const response = await api.post<ApiResponse<DecisionJudicial>>(`/decisiones/${decisionId}/preparar`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al marcar como lista para firma");
  }

  /**
   * FIRMAR DECISIÓN con certificado PKI del servidor
   * Esta es la operación crítica que aplica la firma electrónica real
   */
  async firmarDecision(decisionId: number): Promise<FirmaResult> {
    const response = await api.post<ApiResponse<FirmaResult>>(`/decisiones/${decisionId}/firmar`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al firmar la decisión");
  }

  /**
   * Verificar integridad de firma de una decisión
   * Backend usa GET /api/decisiones/:id/verificar
   */
  async verificarFirma(decisionId: number): Promise<VerificacionFirma> {
    const response = await api.get<ApiResponse<VerificacionFirma>>(`/decisiones/${decisionId}/verificar`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al verificar la firma");
  }

  /**
   * Obtener historial de cambios de una decisión
   */
  async obtenerHistorial(decisionId: number): Promise<HistorialDecision[]> {
    const response = await api.get<ApiResponse<HistorialDecision[]>>(`/decisiones/${decisionId}/historial`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Error al obtener historial");
  }

  /**
   * Eliminar decisión (solo borradores propios)
   */
  async eliminarDecision(decisionId: number): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/decisiones/${decisionId}`);
    if (!response.success) {
      throw new Error(response.error || "Error al eliminar la decisión");
    }
  }

  /**
   * Descargar PDF firmado
   */
  async descargarPdfFirmado(decisionId: number): Promise<Blob> {
    const token = sessionStorage.getItem("auth_token");
    const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000/api"}/decisiones/${decisionId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Error al descargar el PDF");
    }
    
    return response.blob();
  }
}

export const decisionesService = new DecisionesService();
