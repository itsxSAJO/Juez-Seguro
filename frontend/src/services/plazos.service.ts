// ============================================================================
// JUEZ SEGURO - Servicio de Plazos Procesales (HU-SJ-004)
// Control de plazos judiciales con alertas
// ============================================================================

import { api, ApiResponse } from "./api";

// ============================================================================
// TIPOS
// ============================================================================

export type EstadoPlazo = 
  | "VIGENTE"
  | "CUMPLIDO"
  | "VENCIDO"
  | "SUSPENDIDO"
  | "EXTENDIDO";

export type TipoDestinatario = 
  | "actor"
  | "demandado"
  | "abogado_actor"
  | "abogado_demandado"
  | "tercero"
  | "perito"
  | "testigo"
  | "ambas_partes";

export interface PlazoProcesal {
  plazoId: number;
  causaId: number;
  notificacionId?: number;
  decisionId?: number;
  
  // Descripción
  tipoPlazo: string;
  descripcion: string;
  
  // Parte afectada
  parteResponsable?: TipoDestinatario;
  parteResponsableNombre?: string; // Nombre completo del actor/demandado
  
  // Fechas
  fechaInicio: string;
  diasPlazo: number;
  fechaVencimiento: string;
  
  // Estado
  estado: EstadoPlazo;
  
  // Alertas
  alertaEnviada3Dias: boolean;
  alertaEnviada1Dia: boolean;
  alertaEnviadaVencido: boolean;
  
  // Suspensión
  suspendido: boolean;
  fechaSuspension?: string;
  motivoSuspension?: string;
  fechaReanudacion?: string;
  
  // Cumplimiento
  fechaCumplimiento?: string;
  documentoCumplimientoId?: string;
  
  // Auditoría
  fechaCreacion: string;
  fechaActualizacion?: string;
  creadoPorId: number;
  creadoPorNombre?: string;
  
  // Relaciones
  numeroProceso?: string;
}

export interface CrearPlazoInput {
  causaId: number;
  notificacionId?: number;
  decisionId?: number;
  tipoPlazo: string;
  descripcion: string;
  parteResponsable?: TipoDestinatario;
  diasPlazo: number;
  fechaInicio?: string;
}

export interface ActualizarEstadoPlazoInput {
  nuevoEstado: EstadoPlazo;
  fechaCumplimiento?: string;
  documentoCumplimientoId?: string;
  motivoSuspension?: string;
}

export interface CalculoVencimiento {
  fechaInicio: string;
  diasHabiles: number;
  fechaVencimiento: string;
  diasSaltados: number;
  detalleDias?: Array<{
    fecha: string;
    esHabil: boolean;
    motivo?: string;
  }>;
}

export interface TipoActuacion {
  tipoId: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  plazoDiasHabiles: number;
  parteResponsableDefault?: string;
  materia?: string;
  activo: boolean;
}

// ============================================================================
// SERVICIO
// ============================================================================

export const plazosService = {
  /**
   * Crear nuevo plazo procesal
   */
  async crear(input: CrearPlazoInput): Promise<PlazoProcesal> {
    const response = await api.post<ApiResponse<PlazoProcesal>>(
      "/plazos",
      input
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || "Error al crear plazo procesal");
  },

  /**
   * Listar plazos por causa
   */
  async listarPorCausa(causaId: number): Promise<PlazoProcesal[]> {
    const response = await api.get<{ success: boolean; data: PlazoProcesal[] }>(
      `/plazos/causa/${causaId}`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtener plazo por ID
   */
  async obtenerPorId(id: number): Promise<PlazoProcesal | null> {
    const response = await api.get<ApiResponse<PlazoProcesal>>(
      `/plazos/${id}`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return null;
  },

  /**
   * Actualizar estado del plazo
   */
  async actualizarEstado(
    id: number,
    input: ActualizarEstadoPlazoInput
  ): Promise<PlazoProcesal> {
    const response = await api.put<ApiResponse<PlazoProcesal>>(
      `/plazos/${id}/estado`,
      input
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || "Error al actualizar estado del plazo");
  },

  /**
   * Calcular fecha de vencimiento
   */
  async calcularVencimiento(
    fechaInicio: string,
    diasHabiles: number
  ): Promise<CalculoVencimiento> {
    const response = await api.post<ApiResponse<CalculoVencimiento>>(
      "/plazos/calcular-vencimiento",
      { fechaInicio, diasHabiles }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || "Error al calcular vencimiento");
  },

  /**
   * Obtener catálogo de tipos de actuación
   */
  async obtenerCatalogoActuaciones(): Promise<TipoActuacion[]> {
    const response = await api.get<{ success: boolean; data: TipoActuacion[] }>(
      "/plazos/catalogo/tipos-actuacion"
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtener plazos próximos a vencer (alertas)
   */
  async obtenerAlertasProximas(): Promise<PlazoProcesal[]> {
    const response = await api.get<{ success: boolean; data: PlazoProcesal[] }>(
      "/plazos/alertas"
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Obtener días inhábiles
   */
  async obtenerDiasInhabiles(): Promise<Array<{ fecha: string; descripcion: string }>> {
    const response = await api.get<{ success: boolean; data: Array<{ fecha: string; descripcion: string }> }>(
      "/plazos/dias-inhabiles"
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },
};

export default plazosService;
