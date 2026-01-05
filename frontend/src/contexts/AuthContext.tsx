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
  nombre: string;
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API Base URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaurar sesión al cargar
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
      } catch {
        // Token inválido, limpiar
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
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

      // Login exitoso
      const userData: User = {
        id: data.data.user.funcionarioId,
        nombre: data.data.user.nombresCompletos,
        identificacion: data.data.user.identificacion,
        cargo: roleMapping[data.data.user.rolNombre as UserRole],
        rol: data.data.user.rolNombre,
        unidadJudicial: data.data.user.unidadJudicial,
        materia: data.data.user.materia,
        email: data.data.user.correoInstitucional,
        estado: data.data.user.estado,
      };

      setUser(userData);
      setToken(data.data.token);
      localStorage.setItem("token", data.data.token);
      localStorage.setItem("user", JSON.stringify(userData));

      return { success: true, user: userData };
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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token,
        isAuthenticated: !!user && !!token, 
        isLoading,
        login, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
