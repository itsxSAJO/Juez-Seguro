// ============================================================================
// JUEZ SEGURO - Servicio de Documentos
// Gestión de documentos judiciales
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import { secureOpenDocument, validateBlobType } from "../utils/file-security";
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
    // Si hay causaId, usar el endpoint específico
    if (filtros?.causaId) {
      const response = await api.get<ApiResponse<Documento[]>>(`/documentos/causa/${filtros.causaId}`);
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
          total: response.data.length,
          page: 1,
          pageSize: response.data.length,
        };
      }
      
      return {
        success: false,
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };
    }
    
    // Para otros filtros, usar query params
    const params: Record<string, string> = {};
    
    if (filtros) {
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
    const token = sessionStorage.getItem("auth_token");
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
   * Visualiza un documento en una nueva pestaña
   * SEGURIDAD: Validación de blob y esquema URL para prevenir Open Redirect
   */
  async verDocumento(id: string): Promise<void> {
    const token = sessionStorage.getItem("auth_token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/documentos/${id}/ver`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Error al obtener el documento");
    }

    const blob = await response.blob();
    
    // SEGURIDAD: Validar que sea un PDF antes de abrir
    const validation = validateBlobType(blob);
    if (!validation.isValid) {
      throw new Error(validation.error || "Tipo de archivo no permitido");
    }
    
    // Usar función centralizada que:
    // 1. Valida esquema blob: (previene Open Redirect)
    // 2. Usa noopener,noreferrer (aísla contexto)
    // 3. Limpia URL automáticamente después de 60s
    secureOpenDocument(blob);
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
