import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ============================================================================
// ROLES DE FUNCIONARIOS - Sistema según Common Criteria
// ============================================================================
// - cj: Consejo de la Judicatura (administración de cuentas y supervisión)
// - juez: Gestión de causas asignadas y emisión de decisiones
// - secretario: Ingreso de causas, gestión documental y notificaciones
//
// NOTA: El ciudadano NO tiene credenciales. Accede al portal público /ciudadano
// para consultar procesos con datos anonimizados.
// ============================================================================
export type UserRole = "cj" | "juez" | "secretario";

export interface MockUser {
  id: string;
  nombre: string;
  identificacion: string;
  cargo: UserRole;
  unidadJudicial: string;
  materia: string;
  email: string;
  estado: "activa" | "suspendida" | "inactiva";
  intentosFallidos: number;
}

interface AuthContextType {
  user: MockUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// USUARIOS DE PRUEBA - FUNCIONARIOS DEMO
// Solo funcionarios judiciales tienen credenciales de acceso.
// El ciudadano accede al portal público /ciudadano sin autenticación.
// ============================================================================
const mockUsers: (MockUser & { password: string })[] = [
  {
    id: "1",
    nombre: "Dr. María García López",
    identificacion: "1712345678",
    cargo: "cj",
    unidadJudicial: "Consejo de la Judicatura",
    materia: "Administración",
    email: "cj@judicatura.gob.ec",
    password: "cj123",
    estado: "activa",
    intentosFallidos: 0,
  },
  {
    id: "2",
    nombre: "Dr. Carlos Mendoza Ruiz",
    identificacion: "0912345678",
    cargo: "juez",
    unidadJudicial: "Unidad Judicial Civil de Quito",
    materia: "Civil",
    email: "juez@judicatura.gob.ec",
    password: "juez123",
    estado: "activa",
    intentosFallidos: 0,
  },
  {
    id: "3",
    nombre: "Lic. Ana Martínez Silva",
    identificacion: "0612345678",
    cargo: "secretario",
    unidadJudicial: "Unidad Judicial Penal de Guayaquil",
    materia: "Penal",
    email: "secretario@judicatura.gob.ec",
    password: "secretario123",
    estado: "activa",
    intentosFallidos: 0,
  },
  {
    id: "4",
    nombre: "Dr. Juan Pérez Blocked",
    identificacion: "0712345678",
    cargo: "juez",
    unidadJudicial: "Unidad Judicial Laboral",
    materia: "Laboral",
    email: "bloqueado@judicatura.gob.ec",
    password: "blocked123",
    estado: "suspendida",
    intentosFallidos: 5,
  },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<MockUser | null>(() => {
    const stored = localStorage.getItem("mockUser");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const foundUser = mockUsers.find((u) => u.email === email);

    if (!foundUser) {
      return { success: false, error: "Usuario no encontrado" };
    }

    if (foundUser.estado === "suspendida") {
      return { 
        success: false, 
        error: "Cuenta bloqueada. Contacte al administrador del sistema." 
      };
    }

    if (foundUser.estado === "inactiva") {
      return { 
        success: false, 
        error: "Cuenta inactiva. Su cuenta ha sido desactivada." 
      };
    }

    if (foundUser.password !== password) {
      return { 
        success: false, 
        error: `Contraseña incorrecta. Intento ${foundUser.intentosFallidos + 1} de 5.` 
      };
    }

    const { password: _, ...userWithoutPassword } = foundUser;
    setUser(userWithoutPassword);
    localStorage.setItem("mockUser", JSON.stringify(userWithoutPassword));
    
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("mockUser");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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
