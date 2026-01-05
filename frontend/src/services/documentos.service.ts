// ============================================================================
// JUEZ SEGURO - Servicio de Documentos
// Gestión de documentos judiciales
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { Documento, SubirDocumentoRequest } from "@/types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface FiltrosDocumentos {
  causaId?: string;
  tipo?: string;
  estado?: string;
  page?: number;
  pageSize?: number;
}

export const documentosService = {
  /**
   * Obtiene lista de documentos con filtros
   */
  async getDocumentos(filtros?: FiltrosDocumentos): Promise<PaginatedResponse<Documento>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.causaId) params.causaId = filtros.causaId;
      if (filtros.tipo) params.tipo = filtros.tipo;
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<Documento>>("/documentos", params);
  },

  /**
   * Obtiene un documento por ID
   */
  async getDocumentoById(id: string): Promise<Documento> {
    const response = await api.get<ApiResponse<Documento>>(`/documentos/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Documento no encontrado");
  },

  /**
   * Sube un nuevo documento
   */
  async subirDocumento(data: SubirDocumentoRequest): Promise<Documento> {
    const formData = new FormData();
    formData.append("causaId", data.causaId);
    formData.append("nombre", data.nombre);
    formData.append("tipo", data.tipo);
    formData.append("archivo", data.archivo);

    const token = localStorage.getItem("authToken");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/documentos`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Error al subir el documento");
    }

    const result = await response.json() as ApiResponse<Documento>;
    
    if (result.success && result.data) {
      return result.data;
    }
    
    throw new Error(result.error || "Error al subir el documento");
  },

  /**
   * Descarga un documento
   */
  async descargarDocumento(id: string): Promise<Blob> {
    const token = localStorage.getItem("authToken");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/documentos/${id}/descargar`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Error al descargar el documento");
    }

    return response.blob();
  },

  /**
   * Firma un documento digitalmente
   */
  async firmarDocumento(id: string): Promise<Documento> {
    const response = await api.post<ApiResponse<Documento>>(`/documentos/${id}/firmar`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al firmar el documento");
  },

  /**
   * Elimina un documento (solo borradores)
   */
  async eliminarDocumento(id: string): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/documentos/${id}`);
    
    if (!response.success) {
      throw new Error(response.error || "Error al eliminar el documento");
    }
  },

  /**
   * Verifica la integridad de un documento
   */
  async verificarIntegridad(id: string): Promise<{ valido: boolean; hash: string }> {
    const response = await api.get<ApiResponse<{ valido: boolean; hash: string }>>(
      `/documentos/${id}/verificar`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al verificar el documento");
  },
};
