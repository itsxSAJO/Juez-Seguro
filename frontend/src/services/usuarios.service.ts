// ============================================================================
// JUEZ SEGURO - Servicio de Usuarios
// Gestión de cuentas de funcionarios (CJ)
// ============================================================================

import { api, ApiResponse, PaginatedResponse } from "./api";
import type { Usuario, UserRole } from "@/types";

export interface FiltrosUsuarios {
  cargo?: UserRole;
  estado?: string;
  unidadJudicial?: string;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

export interface CrearUsuarioRequest {
  identificacion: string;
  nombresCompletos: string;
  correoInstitucional: string;
  rolId: number;
  unidadJudicial: string;
  materia: string;
}

export interface ActualizarUsuarioRequest {
  nombresCompletos?: string;
  correoInstitucional?: string;
  rolId?: number;
  unidadJudicial?: string;
  materia?: string;
  estado?: string;
}

export const usuariosService = {
  /**
   * Obtiene lista de usuarios con filtros
   */
  async getUsuarios(filtros?: FiltrosUsuarios): Promise<PaginatedResponse<Usuario>> {
    const params: Record<string, string> = {};
    
    if (filtros) {
      if (filtros.cargo) params.cargo = filtros.cargo;
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.unidadJudicial) params.unidadJudicial = filtros.unidadJudicial;
      if (filtros.busqueda) params.q = filtros.busqueda;
      if (filtros.page) params.page = filtros.page.toString();
      if (filtros.pageSize) params.pageSize = filtros.pageSize.toString();
    }
    
    return api.get<PaginatedResponse<Usuario>>("/usuarios", params);
  },

  /**
   * Obtiene un usuario por ID
   */
  async getUsuarioById(id: string): Promise<Usuario> {
    const response = await api.get<ApiResponse<Usuario>>(`/usuarios/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Usuario no encontrado");
  },

  /**
   * Verifica si un correo electrónico está disponible
   */
  async verificarDisponibilidad(correo: string): Promise<{ disponible: boolean }> {
    try {
      const response = await api.get<ApiResponse<{ disponible: boolean }>>(
        `/usuarios/verificar-disponibilidad`,
        { correo }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return { disponible: true };
    } catch {
      // Si hay error, asumimos que está disponible para no bloquear el formulario
      return { disponible: true };
    }
  },

  /**
   * Crea un nuevo usuario
   */
  async crearUsuario(data: CrearUsuarioRequest): Promise<Usuario> {
    const response = await api.post<ApiResponse<Usuario>>("/usuarios", data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al crear el usuario");
  },

  /**
   * Actualiza un usuario existente
   */
  async actualizarUsuario(id: string, data: ActualizarUsuarioRequest): Promise<Usuario> {
    const response = await api.put<ApiResponse<Usuario>>(`/usuarios/${id}`, data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al actualizar el usuario");
  },

  /**
   * Suspende una cuenta de usuario
   */
  async suspenderUsuario(id: string, motivo: string): Promise<Usuario> {
    const response = await api.patch<ApiResponse<Usuario>>(`/usuarios/${id}/suspender`, { motivo });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al suspender el usuario");
  },

  /**
   * Reactiva una cuenta suspendida
   */
  async reactivarUsuario(id: string): Promise<Usuario> {
    const response = await api.patch<ApiResponse<Usuario>>(`/usuarios/${id}/reactivar`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al reactivar el usuario");
  },

  /**
   * Resetea la contraseña de un usuario
   */
  async resetearPassword(id: string): Promise<{ passwordTemporal: string }> {
    const response = await api.post<ApiResponse<{ passwordTemporal: string }>>(
      `/usuarios/${id}/resetear-password`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al resetear la contraseña");
  },

  /**
   * Desbloquea una cuenta bloqueada por intentos fallidos
   * NOTA: Backend usa POST, no PATCH
   */
  async desbloquearCuenta(id: string): Promise<Usuario> {
    const response = await api.post<ApiResponse<Usuario>>(`/usuarios/${id}/desbloquear`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error || "Error al desbloquear la cuenta");
  },

  /**
   * Obtiene el historial de accesos de un usuario
   */
  async getHistorialAccesos(id: string): Promise<Array<{ fecha: string; ip: string; exito: boolean }>> {
    const response = await api.get<ApiResponse<Array<{ fecha: string; ip: string; exito: boolean }>>>(
      `/usuarios/${id}/historial-accesos`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  },
};
