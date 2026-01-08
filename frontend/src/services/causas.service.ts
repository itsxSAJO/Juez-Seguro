// ============================================================================
// JUEZ SEGURO - Servicio de Causas
// CRUD y operaciones para causas judiciales
// HU-SJ-001: Registro de nuevas causas con validación de scope
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { 
  Causa, 
  CausaDetalle, 
  CrearCausaRequest,
  Documento,
  Audiencia,
  Actuacion,
  EstadoCausa,
  PrioridadCausa
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

// Interface para respuesta de creación de causa (HU-SJ-001)
export interface CrearCausaResponse {
  causa_id: number;
  numero_proceso: string;
  materia: string;
  tipo_proceso: string;
  unidad_judicial: string;
  juez_pseudonimo: string;
  estado_procesal: string;
  fecha_creacion: string;
  juezPseudonimo: string;
}

// Interface para crear causa con asignación automática (HU-SJ-001)
export interface CrearCausaAutoRequest {
  materia: string;
  tipoProceso: string;
  unidadJudicial: string;
  descripcion?: string;
  // Partes procesales (información pública)
  actorNombre?: string;
  actorIdentificacion?: string;
  demandadoNombre?: string;
  demandadoIdentificacion?: string;
}

// Respuesta del backend (puede venir en camelCase o snake_case)
interface CausaBackend {
  // camelCase (desde toPublic)
  causaId?: number;
  numeroProceso?: string;
  tipoProceso?: string;
  unidadJudicial?: string;
  juezPseudonimo?: string;
  estadoProcesal?: string;
  fechaCreacion?: string;
  actorNombre?: string;
  demandadoNombre?: string;
  secretarioPseudonimo?: string;
  // snake_case (desde raw query)
  causa_id?: number;
  numero_proceso?: string;
  tipo_proceso?: string;
  unidad_judicial?: string;
  juez_pseudonimo?: string;
  estado_procesal?: string;
  fecha_creacion?: string;
  actor_nombre?: string;
  demandado_nombre?: string;
  secretario_pseudonimo?: string;
  // Campos comunes
  materia?: string;
  descripcion?: string;
}

/**
 * Mapea estado procesal del backend a estado del frontend
 */
function mapearEstado(estadoProcesal: string): EstadoCausa {
  const estado = estadoProcesal?.toUpperCase() || "";
  if (estado === "ARCHIVADA") return "archivado";
  if (estado === "RESUELTA") return "resuelto";
  if (estado === "SUSPENDIDA") return "suspendido";
  return "en_tramite"; // INICIADA, EN_TRAMITE, etc.
}

/**
 * Mapea una causa del backend al formato del frontend
 * Soporta tanto camelCase como snake_case del backend
 */
function mapearCausa(causaBackend: CausaBackend): Causa {
  // Obtener valores con fallback entre camelCase y snake_case
  const id = causaBackend.causaId ?? causaBackend.causa_id ?? 0;
  const numeroProceso = causaBackend.numeroProceso ?? causaBackend.numero_proceso ?? "";
  const tipoProceso = causaBackend.tipoProceso ?? causaBackend.tipo_proceso ?? "";
  const unidadJudicial = causaBackend.unidadJudicial ?? causaBackend.unidad_judicial ?? "";
  const juezPseudonimo = causaBackend.juezPseudonimo ?? causaBackend.juez_pseudonimo ?? "Juez asignado";
  const estadoProcesal = causaBackend.estadoProcesal ?? causaBackend.estado_procesal ?? "INICIADA";
  const fechaCreacion = causaBackend.fechaCreacion ?? causaBackend.fecha_creacion ?? new Date().toISOString();
  const actorNombre = causaBackend.actorNombre ?? causaBackend.actor_nombre ?? "Actor no especificado";
  const demandadoNombre = causaBackend.demandadoNombre ?? causaBackend.demandado_nombre ?? "Demandado no especificado";
  const secretarioPseudonimo = causaBackend.secretarioPseudonimo ?? causaBackend.secretario_pseudonimo ?? "Secretario";

  return {
    id: id.toString(),
    numeroExpediente: numeroProceso,
    materia: causaBackend.materia || "",
    tipoAccion: tipoProceso,
    unidadJudicial: unidadJudicial,
    // Partes procesales: nombres reales (información pública)
    actorNombre: actorNombre,
    demandadoNombre: demandadoNombre,
    // Funcionarios: pseudónimos (protección de identidad)
    juezAsignadoId: id.toString(),
    juezAsignadoNombre: juezPseudonimo,
    secretarioPseudonimo: secretarioPseudonimo,
    estado: mapearEstado(estadoProcesal),
    estadoProcesal: estadoProcesal,
    fechaIngreso: fechaCreacion,
    fechaActualizacion: fechaCreacion,
    prioridad: "normal",
    descripcion: causaBackend.descripcion,
  };
}

export const causasService = {
  /**
   * Obtiene lista de causas con filtros y paginación
   * Mapea los datos del backend al formato del frontend
   */
  async getCausas(filtros?: FiltrosCausas): Promise<{ data: Causa[]; total: number; page: number; pageSize: number }> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.estado) params.estadoProcesal = filtros.estado;
      if (filtros.materia) params.materia = filtros.materia;
      if (filtros.busqueda) params.busqueda = filtros.busqueda;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    const response = await api.get<{ success: boolean; data: CausaBackend[]; total: number; page: number; pageSize: number }>("/causas", params);
    
    // Mapear cada causa del backend al formato del frontend
    const causasMapeadas = (response.data || []).map(mapearCausa);
    
    return {
      data: causasMapeadas,
      total: response.total || causasMapeadas.length,
      page: response.page || 1,
      pageSize: response.pageSize || 20,
    };
  },

  /**
   * Obtiene una causa por ID con todos sus detalles
   */
  async getCausaById(id: string): Promise<CausaDetalle> {
    const response = await api.get<ApiResponse<CausaBackend>>(`/causas/${id}`);
    
    if (response.success && response.data) {
      const causaMapeada = mapearCausa(response.data);
      return {
        ...causaMapeada,
        documentos: [],
        audiencias: [],
        actuaciones: [],
      } as CausaDetalle;
    }
    
    throw new Error(response.error || "Causa no encontrada");
  },

  /**
   * Crea una nueva causa con asignación automática de juez (HU-SJ-001)
   * Incluye validación de scope: materia y unidad judicial deben coincidir
   * con los atributos del secretario autenticado
   */
  async crearCausa(data: CrearCausaAutoRequest): Promise<CrearCausaResponse> {
    const response = await api.post<ApiResponse<CrearCausaResponse> & { message?: string }>("/causas", data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    // Manejar errores específicos de validación de scope
    const errorResponse = response as any;
    if (errorResponse.code === "MATERIA_NO_COINCIDE") {
      throw new Error(`Acceso denegado: ${response.error}`);
    }
    if (errorResponse.code === "UNIDAD_NO_COINCIDE") {
      throw new Error(`Acceso denegado: ${response.error}`);
    }
    if (errorResponse.code === "NO_JUECES_DISPONIBLES") {
      throw new Error(`Sin jueces disponibles: ${response.error}`);
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

  /**
   * Obtiene el historial de reprogramaciones de audiencias de una causa
   * HU-SJ-003: Trazabilidad de audiencias en el expediente electrónico
   */
  async getHistorialReprogramaciones(causaId: string): Promise<HistorialReprogramacion[]> {
    const response = await api.get<ApiResponse<HistorialReprogramacion[]>>(`/causas/${causaId}/historial-reprogramaciones`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },
};

// Interface para historial de reprogramaciones
export interface HistorialReprogramacion {
  historialId: number;
  audienciaId: number;
  tipoAudiencia?: string;
  fechaHoraAnterior: string;
  salaAnterior?: string;
  fechaHoraNueva: string;
  salaNueva?: string;
  motivoReprogramacion: string;
  tipoCambio: "REPROGRAMACION" | "CANCELACION" | "CAMBIO_SALA";
  modificadoPorSecretarioId: number;
  modificadoPorRol: string;
  fechaModificacion: string;
  ipModificacion?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
}
