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
   * FORMATO: JSON con contenido en base64 (no FormData)
   */
  async subirDocumento(data: SubirDocumentoRequest): Promise<Documento> {
    console.log('📤 Iniciando subida de documento:', {
      nombre: data.nombre,
      tamanoOriginal: data.archivo.size,
      tipo: data.tipo
    });
    
    // Convertir archivo a Base64 usando ArrayBuffer (más confiable que DataURL)
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(data.archivo);
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        console.log('✅ Archivo convertido a base64:', {
          tamanoArrayBuffer: arrayBuffer.byteLength,
          tamanoBase64: base64.length
        });
        resolve(base64);
      };
      reader.onerror = () => {
        console.error('❌ Error al leer el archivo');
        reject(new Error("Error al leer el archivo"));
      };
    });

    // Usar sessionStorage con 'auth_token' (consistente con AuthContext)
    const token = sessionStorage.getItem("auth_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Payload en formato JSON con base64
    const payload = {
      causaId: data.causaId,
      tipo: data.tipo,
      nombreOriginal: data.nombre,
      contenido: base64Content,
    };

    const response = await fetch(`${API_BASE_URL}/documentos`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || "Error al subir el documento");
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
    try {
      console.log('===========================================');
      console.log('🔍 INICIO verDocumento - ID:', id);
      console.log('===========================================');
      
      const token = sessionStorage.getItem("auth_token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      console.log('📤 Enviando petición al servidor...');
      
      const response = await fetch(`${API_BASE_URL}/documentos/${id}/ver`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        console.error('❌ Error en respuesta del servidor:', response.status, response.statusText);
        throw new Error("Error al obtener el documento");
      }

      console.log('✅ Respuesta OK, procesando blob...');
      console.log('📊 Headers:', {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        contentDisposition: response.headers.get('content-disposition')
      });
      
      const blob = await response.blob();
      console.log('📦 Blob creado:', {
        size: blob.size,
        type: blob.type
      });
      
      // DEBUG: Leer los primeros bytes del blob para verificar contenido
      const arrayBuffer = await blob.slice(0, 100).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const firstBytes = Array.from(uint8Array.slice(0, 10))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      const textDecoder = new TextDecoder('ascii');
      const firstChars = textDecoder.decode(uint8Array.slice(0, 10));
      console.log('🔍 Primeros bytes (hex):', firstBytes);
      console.log('🔍 Primeros caracteres:', firstChars);
      console.log('🔍 ¿Comienza con %PDF?', firstChars.startsWith('%PDF'));
      
      // SEGURIDAD: Validar que sea un PDF antes de abrir
      console.log('🔒 Validando tipo de archivo...');
      const validation = validateBlobType(blob);
      if (!validation.isValid) {
        console.error('❌ Validación fallida:', validation.error);
        throw new Error(validation.error || "Tipo de archivo no permitido");
      }
      console.log('✅ Validación exitosa');
      
      // Obtener el nombre del archivo del header Content-Disposition
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `documento-${id}.pdf`;
      
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
          fileName = decodeURIComponent(matches[1].replace(/['"]/g, ''));
        }
      }
      
      // Asegurar que el archivo tenga extensión .pdf
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        fileName += '.pdf';
      }
      
      console.log('📄 Nombre del archivo:', fileName);
      
      // Crear URL blob
      const url = window.URL.createObjectURL(blob);
      console.log('🔗 URL blob creada:', url);
      
      // Validar esquema blob:
      if (!url.startsWith("blob:")) {
        console.error('❌ URL no válida:', url);
        window.URL.revokeObjectURL(url);
        throw new Error("Error de seguridad: URL no válida");
      }
      
      // Crear un link de descarga temporal y hacer clic
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      console.log('⬇️ Iniciando descarga del archivo...');
      console.log('📋 Link href:', link.href);
      console.log('📋 Link download:', link.download);
      
      // Usar un timeout más largo para asegurar que la descarga complete
      // En algunos navegadores, la descarga es asíncrona
      link.click();
      console.log('✅ Click ejecutado, esperando 5 segundos antes de limpiar...');
      
      // Esperar más tiempo antes de limpiar (5 segundos)
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
        console.log('🧹 Link removido y URL revocada después de 5 segundos');
        console.log('===========================================');
      }, 5000);
      
    } catch (error) {
      console.error('❌ ERROR en verDocumento:', error);
      throw error;
    }
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
