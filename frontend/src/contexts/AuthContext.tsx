import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

// ============================================================================
// ROLES DE FUNCIONARIOS - Sistema según Common Criteria
// ============================================================================
// - ADMIN_CJ: Consejo de la Judicatura (administración de cuentas y supervisión)
// - JUEZ: Gestión de causas asignadas y emisión de decisiones
// - SECRETARIO: Ingreso de causas, gestión documental y notificaciones
//
// NOTA: El ciudadano NO tiene credenciales. Accede al portal público /ciudadano
// para consultar procesos con datos anonimizados.
// ============================================================================
export type UserRole = "ADMIN_CJ" | "JUEZ" | "SECRETARIO";

// Mapeo para compatibilidad con UI existente
export type UIRole = "cj" | "juez" | "secretario";

const roleMapping: Record<UserRole, UIRole> = {
  "ADMIN_CJ": "cj",
  "JUEZ": "juez",
  "SECRETARIO": "secretario"
};

export interface User {
  id: number;
  nombre: string; // Contiene el pseudónimo, NO el nombre real
  pseudonimo: string | null; // Pseudónimo explícito (JUEZ-XXXX, SECR-XXXX, etc.)
  identificacion: string;
  cargo: UIRole;
  rol: UserRole;
  unidadJudicial: string;
  materia: string;
  email: string;
  estado: "ACTIVA" | "SUSPENDIDA" | "INACTIVA" | "BLOQUEADA" | "HABILITABLE";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiereCambioPassword: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User; requiereCambioPassword?: boolean }>;
  logout: () => void;
  completarCambioPassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API Base URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Claves para sessionStorage (más seguro que localStorage para tokens)
const TOKEN_KEY = "auth_token";
const PSEUDONIMO_KEY = "user_pseudonimo";

/**
 * Decodifica un JWT para extraer el payload (sin verificar firma)
 * La verificación real se hace en el backend
 */
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Verifica si un token JWT ha expirado
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;
  
  // exp está en segundos, Date.now() en milisegundos
  return Date.now() >= payload.exp * 1000;
}

/**
 * Extrae los datos del usuario del token JWT
 */
function getUserFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  return {
    id: payload.funcionarioId,
    nombre: "", // Se obtiene del backend en login, no guardamos en storage
    pseudonimo: null, // Se obtiene del backend en login
    identificacion: payload.identificacion,
    cargo: roleMapping[payload.rol as UserRole] || "secretario",
    rol: payload.rol,
    unidadJudicial: payload.unidadJudicial,
    materia: payload.materia,
    email: payload.correo,
    estado: "ACTIVA", // Si tiene token válido, asumimos activa
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiereCambioPassword, setRequiereCambioPassword] = useState(false);

  // Restaurar sesión al cargar - Solo desde sessionStorage, no localStorage
  useEffect(() => {
    const restoreSession = async () => {
      // Usar sessionStorage en lugar de localStorage (se limpia al cerrar navegador)
      const storedToken = sessionStorage.getItem(TOKEN_KEY);
      const storedRequiereCambio = sessionStorage.getItem("requiereCambioPassword") === "true";
      const storedPseudonimo = sessionStorage.getItem(PSEUDONIMO_KEY);

      if (storedToken) {
        // Verificar si el token no ha expirado
        if (!isTokenExpired(storedToken)) {
          const userFromToken = getUserFromToken(storedToken);
          if (userFromToken) {
            // Restaurar pseudónimo guardado
            userFromToken.pseudonimo = storedPseudonimo;
            userFromToken.nombre = storedPseudonimo || userFromToken.nombre;
            setToken(storedToken);
            setUser(userFromToken);
            setRequiereCambioPassword(storedRequiereCambio);
          } else {
            // Token inválido
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem("requiereCambioPassword");
            sessionStorage.removeItem(PSEUDONIMO_KEY);
          }
        } else {
          // Token expirado, limpiar
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem("requiereCambioPassword");
          sessionStorage.removeItem(PSEUDONIMO_KEY);
        }
      }

      // Limpiar datos antiguos de localStorage si existen (migración)
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ correo: email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Manejar errores específicos
        if (data.code === "USER_NOT_FOUND") {
          return { success: false, error: "Usuario no encontrado" };
        }
        if (data.code === "INVALID_PASSWORD") {
          return { 
            success: false, 
            error: `Contraseña incorrecta. Intento ${data.intentosFallidos || 1} de 5.` 
          };
        }
        if (data.code === "ACCOUNT_LOCKED") {
          return { 
            success: false, 
            error: `Cuenta bloqueada. ${data.minutosRestantes ? `Espere ${data.minutosRestantes} minutos.` : "Contacte al administrador."}` 
          };
        }
        if (data.code === "ACCOUNT_NOT_ACTIVE") {
          return { 
            success: false, 
            error: "Cuenta no activa. Contacte al administrador del sistema." 
          };
        }
        return { success: false, error: data.message || "Error al iniciar sesión" };
      }

      // Login exitoso - Solo guardamos el token en sessionStorage
      const receivedToken = data.data.token;
      const requiereCambio = data.data.requiereCambioPassword || false;
      
      // Construir datos del usuario desde la respuesta (para uso inmediato)
      const userData: User = {
        id: data.data.user.funcionarioId,
        nombre: data.data.user.pseudonimo || data.data.user.nombresCompletos, // Usar pseudónimo
        pseudonimo: data.data.user.pseudonimo || null,
        identificacion: data.data.user.identificacion,
        cargo: roleMapping[data.data.user.rolNombre as UserRole],
        rol: data.data.user.rolNombre,
        unidadJudicial: data.data.user.unidadJudicial,
        materia: data.data.user.materia,
        email: data.data.user.correoInstitucional,
        estado: data.data.user.estado,
      };

      setUser(userData);
      setToken(receivedToken);
      setRequiereCambioPassword(requiereCambio);
      
      // Guardar token y pseudónimo en sessionStorage
      sessionStorage.setItem(TOKEN_KEY, receivedToken);
      if (userData.pseudonimo) {
        sessionStorage.setItem(PSEUDONIMO_KEY, userData.pseudonimo);
      }
      
      // Si requiere cambio de password, guardarlo también
      if (requiereCambio) {
        sessionStorage.setItem("requiereCambioPassword", "true");
      }

      return { success: true, user: userData, requiereCambioPassword: requiereCambio };
    } catch (error) {
      console.error("Login error:", error);
      return { 
        success: false, 
        error: "Error de conexión. Verifique que el servidor esté activo." 
      };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRequiereCambioPassword(false);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem("requiereCambioPassword");
    sessionStorage.removeItem(PSEUDONIMO_KEY);
    // Limpiar también localStorage por si quedaron datos antiguos
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  // Función para marcar que el usuario completó el cambio de contraseña
  const completarCambioPassword = useCallback(() => {
    setRequiereCambioPassword(false);
    sessionStorage.removeItem("requiereCambioPassword");
    // Actualizar estado del usuario a ACTIVA
    setUser((prev) => prev ? { ...prev, estado: "ACTIVA" } : null);
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token,
        isAuthenticated: !!user && !!token, 
        isLoading,
        requiereCambioPassword,
        login, 
        logout,
        completarCambioPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // En desarrollo, esto puede ocurrir durante HMR - mostrar warning en lugar de error
    if (import.meta.env.DEV) {
      console.warn("useAuth called outside of AuthProvider - this may be a HMR issue. Try refreshing the page.");
      // Retornar un objeto dummy para evitar crash durante HMR
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: true,
        requiereCambioPassword: false,
        login: async () => ({ success: false, error: "Context not ready" }),
        logout: () => {},
        completarCambioPassword: () => {},
      } as AuthContextType;
    }
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Type for the context (needed for fallback)
type AuthContextType = ReturnType<typeof useAuth>;
