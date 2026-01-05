// ============================================================================
// JUEZ SEGURO - Servicio de Autenticación
// Maneja login, logout y gestión de sesión
// ============================================================================

import { api, ApiResponse } from "./api";
import type { LoginRequest, LoginResponse, Usuario } from "@/types";

const AUTH_TOKEN_KEY = "authToken";
const USER_DATA_KEY = "userData";

export const authService = {
  /**
   * Inicia sesión con credenciales
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>("/auth/login", credentials);
    
    if (response.success && response.data) {
      // Guardar token y datos de usuario
      localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(response.data.user));
      return response.data;
    }
    
    throw new Error(response.error || "Error al iniciar sesión");
  },

  /**
   * Cierra la sesión actual
   */
  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } finally {
      // Limpiar datos locales siempre
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
    }
  },

  /**
   * Obtiene el usuario actual desde localStorage
   */
  getCurrentUser(): Usuario | null {
    const userData = localStorage.getItem(USER_DATA_KEY);
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Verifica si hay una sesión activa
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Obtiene el token de autenticación
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Refresca el token de autenticación
   */
  async refreshToken(): Promise<string> {
    const response = await api.post<ApiResponse<{ token: string }>>("/auth/refresh");
    
    if (response.success && response.data) {
      localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
      return response.data.token;
    }
    
    throw new Error("No se pudo refrescar el token");
  },

  /**
   * Valida la sesión actual con el servidor
   */
  async validateSession(): Promise<boolean> {
    try {
      const response = await api.get<ApiResponse<{ valid: boolean }>>("/auth/validate");
      return response.success && response.data?.valid === true;
    } catch {
      return false;
    }
  },
};
