import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Gavel,
  Bell,
  Settings,
  LogOut,
  Scale,
  ChevronLeft,
  ChevronRight,
  Timer,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { notificacionesService } from "@/services/notificaciones.service";

// ============================================================================
// PERMISOS POR ROL - COMMON CRITERIA
// ============================================================================
// CJ (Consejo de la Judicatura):
//   - Administración de cuentas de funcionarios
//   - Supervisión de actividad (auditoría)
//   - Acceso al dashboard
//
// JUEZ:
//   - Gestión de causas asignadas
//   - Revisión de expedientes
//   - Emisión de decisiones (sentencias, autos, providencias)
//   - Agenda de audiencias
//   - Notificaciones judiciales
//
// SECRETARIO:
//   - Ingreso de nuevas causas
//   - Programación de audiencias
//   - Gestión de notificaciones
//
// CIUDADANO:
//   - Consulta de expediente electrónico propio
//   - Datos anonimizados
// ============================================================================

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  roles?: ("cj" | "juez" | "secretario")[];
  badge?: number;
  description?: string;
}

const navItems: NavItem[] = [
  { 
    icon: LayoutDashboard, 
    label: "Dashboard", 
    href: "/funcionarios",
    description: "Panel principal"
  },
  // ============ CJ - CONSEJO DE LA JUDICATURA ============
  { 
    icon: Users, 
    label: "Administrar Cuentas", 
    href: "/funcionarios/cuentas",
    roles: ["cj"],
    description: "Gestión de usuarios del sistema"
  },
  { 
    icon: Calendar, 
    label: "Agenda de Audiencias", 
    href: "/funcionarios/audiencias",
    roles: ["cj"],
    description: "Visualización de audiencias"
  },
  { 
    icon: Settings, 
    label: "Auditoría", 
    href: "/funcionarios/auditoria",
    roles: ["cj"],
    description: "Supervisión y logs del sistema"
  },
  // ============ SECRETARIO ============
  { 
    icon: FileText, 
    label: "Ingreso de Causas", 
    href: "/funcionarios/causas/nueva",
    roles: ["secretario"],
    description: "Registrar nueva causa judicial"
  },
  { 
    icon: FileText, 
    label: "Gestión de Causas", 
    href: "/funcionarios/causas",
    roles: ["secretario"],
    description: "Administrar causas existentes"
  },
  { 
    icon: Bell, 
    label: "Notificaciones", 
    href: "/funcionarios/notificaciones",
    roles: ["juez", "secretario"],
    description: "Gestión de notificaciones judiciales"
  },
  { 
    icon: Timer, 
    label: "Notif. Procesales", 
    href: "/funcionarios/notificaciones-procesales",
    roles: ["juez", "secretario"],
    description: "Notificaciones y plazos procesales (HU-SJ-004)"
  },
  // ============ JUEZ ============
  { 
    icon: Gavel, 
    label: "Mis Causas Asignadas", 
    href: "/funcionarios/causas",
    roles: ["juez"],
    description: "Causas asignadas para resolución"
  },
  { 
    icon: Scale, 
    label: "Editor de Decisiones", 
    href: "/funcionarios/decisiones",
    roles: ["juez"],
    description: "Redactar sentencias, autos y providencias"
  },
  // ============ COMPARTIDOS JUEZ + SECRETARIO ============
  { 
    icon: Calendar, 
    label: "Agenda de Audiencias", 
    href: "/funcionarios/audiencias",
    roles: ["juez", "secretario"],
    description: "Programación de audiencias"
  },
];

export const FuncionariosSidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);

  // Cargar conteo de notificaciones no leídas
  useEffect(() => {
    const cargarNotificaciones = async () => {
      try {
        const resultado = await notificacionesService.getMisNotificaciones({ estado: "no_leida" });
        setNotificacionesNoLeidas(resultado.noLeidas || 0);
      } catch (error) {
        console.error("Error al cargar notificaciones:", error);
      }
    };

    if (user) {
      cargarNotificaciones();
      // Actualizar cada 30 segundos
      const intervalo = setInterval(cargarNotificaciones, 30000);
      return () => clearInterval(intervalo);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    // Navegar al login y reemplazar el historial para evitar volver atrás
    navigate("/funcionarios/login", { replace: true });
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.cargo || "secretario");
  });

  const isActive = (href: string) => {
    if (href === "/funcionarios") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <Link to="/funcionarios" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-ring/20">
            <Scale className="w-5 h-5 text-sidebar-ring" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-heading font-bold truncate">Juez Seguro</h1>
              <p className="text-xs text-sidebar-foreground/70">Portal Funcionarios</p>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold">
              {/* Mostrar iniciales del pseudónimo: JU para JUEZ, SE para SECRETARIO, AD para ADMIN */}
              {user.pseudonimo?.startsWith("JUEZ") ? "JU" :
               user.pseudonimo?.startsWith("SECRETARIO") ? "SE" :
               user.pseudonimo?.startsWith("ADMIN") ? "AD" :
               user.cargo.toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.pseudonimo || user.nombre}</p>
              <p className="text-xs text-sidebar-foreground/70 capitalize">{user.cargo}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          // Determinar si este item debe mostrar badge de notificaciones
          const badgeCount = item.href === "/funcionarios/notificaciones" ? notificacionesNoLeidas : item.badge;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative",
                isActive(item.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="ml-auto bg-warning text-warning-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && badgeCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-warning text-warning-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className={cn(
            "w-full text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-destructive",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="ml-3">Cerrar Sesión</span>}
        </Button>
      </div>
    </aside>
  );
};
