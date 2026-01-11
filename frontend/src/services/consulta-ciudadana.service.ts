// ============================================================================
// JUEZ SEGURO - Servicio de Consulta Ciudadana
// HU-UP-001: Consulta del expediente electrónico de mi proceso
// Búsqueda pública de procesos (datos anonimizados)
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import { secureDownload, validateBlobType } from "../utils/file-security";
import type { ProcesoPublico, Actuacion, BusquedaProcesoRequest, CausaPublicaBackend, ActuacionBackend } from "@/types";

/**
 * Transforma datos del backend (CausaPublica) al formato del frontend (ProcesoPublico)
 */
const transformarCausaAProcesoPublico = (causa: CausaPublicaBackend): ProcesoPublico => {
  return {
    id: causa.causaId?.toString() || causa.numeroProceso,
    numeroExpediente: causa.numeroProceso,
    fechaIngreso: causa.fechaCreacion ? new Date(causa.fechaCreacion).toLocaleDateString("es-EC") : "",
    dependencia: causa.unidadJudicial || "",
    materia: causa.materia || "",
    tipoAccion: causa.tipoProceso || "",
    estado: causa.estadoProcesal || "pendiente",
    // Datos anonimizados
    actorAnonimo: causa.actorNombre || "Actor Anónimo",
    demandadoAnonimo: causa.demandadoNombre || "Demandado Anónimo",
    juezAnonimo: causa.juezPseudonimo || "Juez Anónimo",
  };
};

/**
 * Transforma actuación del backend al formato del frontend
 */
const transformarActuacion = (act: ActuacionBackend): Actuacion => {
  return {
    id: act.actuacionId?.toString() || "",
    fecha: act.fechaActuacion ? new Date(act.fechaActuacion).toLocaleDateString("es-EC") : "",
    tipo: act.tipoActuacion || "Documento",
    descripcion: act.descripcion || "Sin descripción",
    funcionario: act.funcionarioPseudonimo || "Sistema",
    responsableAnonimo: act.funcionarioPseudonimo || "Sistema",
    tieneArchivo: act.tieneArchivo || false,
    mimeType: act.mimeType || "application/pdf",
  };
};

export const consultaCiudadanaService = {
  /**
   * Busca un proceso por número de expediente (público, sin autenticación)
   * Los datos retornados están anonimizados según FDP_IFF
   */
  async buscarPorNumero(numeroProceso: string): Promise<ProcesoPublico | null> {
    try {
      const response = await api.get<ApiResponse<CausaPublicaBackend>>("/publico/buscar", {
        numeroProceso,
      });
      
      if (response.success && response.data) {
        return transformarCausaAProcesoPublico(response.data);
      }
      
      return null;
    } catch (error: any) {
      // Manejar errores específicos
      if (error?.code === "RATE_LIMIT_EXCEEDED") {
        throw new Error("Demasiadas consultas. Por favor espere un momento.");
      }
      if (error?.code === "IP_BLOCKED") {
        throw new Error("IP bloqueada temporalmente por demasiados intentos fallidos.");
      }
      if (error?.code === "INVALID_FORMAT") {
        throw new Error("Formato de número de proceso inválido. Use: PPCCC-AAAA-NNNNN");
      }
      return null;
    }
  },

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
    // Si es búsqueda por número de proceso, usar endpoint directo
    if (tipo === "proceso") {
      const proceso = await this.buscarPorNumero(query);
      return {
        success: true,
        data: proceso ? [proceso] : [],
        total: proceso ? 1 : 0,
        page: 1,
        pageSize: 10,
      };
    }
    
    // Para búsqueda por actor o demandado, usar el endpoint con tipoBusqueda
    const params: Record<string, string> = {
      busqueda: query,
      tipoBusqueda: tipo, // "actor" o "demandado"
      page: page.toString(),
      pageSize: pageSize.toString(),
    };
    
    const response = await api.get<PaginatedResponse<CausaPublicaBackend>>("/publico/causas", params);
    
    return {
      ...response,
      data: (response.data || []).map(transformarCausaAProcesoPublico),
    };
  },

  /**
   * Obtiene detalle de un proceso por número (público)
   * Solo retorna información pública con datos anonimizados
   */
  async getProcesoById(numeroProceso: string): Promise<ProcesoPublico | null> {
    try {
      const response = await api.get<ApiResponse<CausaPublicaBackend>>(`/publico/procesos/${numeroProceso}`);
      
      if (response.success && response.data) {
        return transformarCausaAProcesoPublico(response.data);
      }
      
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Obtiene actuaciones públicas de un proceso
   * Las actuaciones están anonimizadas (sin nombres reales de funcionarios)
   */
  async getActuaciones(numeroProceso: string): Promise<Actuacion[]> {
    try {
      const response = await api.get<ApiResponse<ActuacionBackend[]>>(
        `/publico/procesos/${numeroProceso}/actuaciones`
      );
      
      if (response.success && response.data) {
        return response.data.map(transformarActuacion);
      }
      
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Valida un número de expediente (formato y existencia)
   */
  async validarExpediente(numeroExpediente: string): Promise<{ valido: boolean; existe: boolean }> {
    try {
      const response = await api.get<ApiResponse<{ valido: boolean; existe: boolean }>>(
        "/publico/validar",
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
   * Obtiene lista de causas públicas con filtros
   */
  async getCausasPublicas(filtros?: {
    materia?: string;
    estadoProcesal?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<ProcesoPublico>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.materia) params.materia = filtros.materia;
      if (filtros.estadoProcesal) params.estadoProcesal = filtros.estadoProcesal;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<ProcesoPublico>>("/publico/causas", params);
  },

  /**
   * Obtiene lista de materias disponibles
   */
  async getMaterias(): Promise<string[]> {
    try {
      const response = await api.get<ApiResponse<string[]>>("/publico/materias");
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Obtiene lista de unidades judiciales
   */
  async getUnidadesJudiciales(): Promise<string[]> {
    try {
      const response = await api.get<ApiResponse<string[]>>("/publico/unidades-judiciales");
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Descarga un documento público
   * No requiere autenticación
   * SEGURIDAD: Validación de blob y sanitización de nombre de archivo
   */
  async descargarDocumento(documentoId: string, nombreArchivo: string): Promise<void> {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const response = await fetch(`${apiUrl}/publico/documentos/${documentoId}/descargar`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Error al descargar el documento");
      }

      const blob = await response.blob();
      
      // SEGURIDAD: Validar que sea un PDF antes de descargar
      const validation = validateBlobType(blob);
      if (!validation.isValid) {
        throw new Error(validation.error || "Tipo de archivo no permitido");
      }
      
      // Usar función centralizada (sanitiza nombre, maneja DOM de forma segura)
      secureDownload(blob, nombreArchivo);
      
    } catch (error) {
      // Evitar exponer detalles técnicos en producción
      throw new Error("No se pudo descargar el documento");
    }
  },

  /**
   * Abre un documento para visualización en nueva pestaña
   * No requiere autenticación
   * SEGURIDAD: Usa noopener,noreferrer para aislar el contexto
   */
  verDocumento(documentoId: string): void {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const url = `${apiUrl}/publico/documentos/${documentoId}/ver`;
    // SEGURIDAD: noopener previene acceso a window.opener, noreferrer no envía Referer
    window.open(url, "_blank", "noopener,noreferrer");
  },
};
