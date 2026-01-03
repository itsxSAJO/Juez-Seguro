import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Calendar,
  Bell,
  Clock,
  TrendingUp,
  Users,
  Gavel,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCausas, getAudiencias, getNotificaciones, Causa, Audiencia, Notificacion } from "@/lib/mockFuncionarios";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  className?: string;
}

const StatCard = ({ title, value, description, icon: Icon, trend, className }: StatCardProps) => (
  <Card className={cn("hover:shadow-md transition-shadow", className)}>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="w-5 h-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp className="w-3 h-3 text-success" />
          <span className="text-xs text-success">+{trend.value}%</span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const DashboardFuncionarios = () => {
  const { user } = useAuth();
  const [causas, setCausas] = useState<Causa[]>([]);
  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [causasData, audienciasData, notificacionesData] = await Promise.all([
          getCausas(user?.id),
          getAudiencias(user?.id),
          getNotificaciones(),
        ]);
        setCausas(causasData);
        setAudiencias(audienciasData);
        setNotificaciones(notificacionesData);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user?.id]);

  const causasActivas = causas.filter((c) => c.estado === "en_tramite").length;
  const audienciasHoy = audiencias.filter((a) => a.fecha === new Date().toISOString().split("T")[0]).length;
  const notificacionesPendientes = notificaciones.filter((n) => n.estado === "pendiente").length;
  const plazosProximos = notificaciones.filter((n) => {
    const limit = new Date(n.fechaLimite);
    const today = new Date();
    const diff = (limit.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 3 && diff >= 0;
  }).length;

  const proximasAudiencias = audiencias
    .filter((a) => new Date(a.fecha) >= new Date() && a.estado === "programada")
    .slice(0, 5);

  const causasRecientes = causas
    .sort((a, b) => new Date(b.fechaActualizacion).getTime() - new Date(a.fechaActualizacion).getTime())
    .slice(0, 5);

  const getRoleName = (cargo: string) => {
    switch (cargo) {
      case "admin":
        return "Administrador";
      case "juez":
        return "Juez";
      case "secretario":
        return "Secretario Judicial";
      default:
        return cargo;
    }
  };

  return (
    <FuncionariosLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          Bienvenido, {user?.nombre.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {getRoleName(user?.cargo || "")} - {user?.unidadJudicial}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Causas Activas"
          value={causasActivas}
          description="En trámite"
          icon={FileText}
          trend={{ value: 12, label: "vs. mes anterior" }}
        />
        <StatCard
          title="Audiencias Hoy"
          value={audienciasHoy}
          description="Programadas"
          icon={Calendar}
        />
        <StatCard
          title="Notificaciones"
          value={notificacionesPendientes}
          description="Pendientes de envío"
          icon={Bell}
        />
        <StatCard
          title="Plazos Próximos"
          value={plazosProximos}
          description="Vencen en 3 días"
          icon={Clock}
          className={plazosProximos > 0 ? "border-warning/50" : ""}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas Audiencias */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Próximas Audiencias</CardTitle>
              <CardDescription>Agenda de los próximos días</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/funcionarios/audiencias" className="flex items-center gap-1">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : proximasAudiencias.length > 0 ? (
              <div className="space-y-3">
                {proximasAudiencias.map((aud) => (
                  <div
                    key={aud.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary">
                      <span className="text-xs font-medium">
                        {new Date(aud.fecha).toLocaleDateString("es-EC", { day: "2-digit" })}
                      </span>
                      <span className="text-xs">
                        {new Date(aud.fecha).toLocaleDateString("es-EC", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{aud.numeroExpediente}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {aud.tipo} - {aud.hora} - {aud.sala}
                      </p>
                    </div>
                    {aud.historialCambios.length > 0 && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        Reprogramada
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No hay audiencias próximas</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Causas Recientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Causas Recientes</CardTitle>
              <CardDescription>Última actividad</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/funcionarios/causas" className="flex items-center gap-1">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : causasRecientes.length > 0 ? (
              <div className="space-y-3">
                {causasRecientes.map((causa) => (
                  <Link
                    key={causa.id}
                    to={`/funcionarios/causas/${causa.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg",
                        causa.estado === "en_tramite" && "bg-success/10",
                        causa.estado === "resuelto" && "bg-info/10",
                        causa.estado === "archivado" && "bg-muted",
                        causa.estado === "suspendido" && "bg-warning/10"
                      )}
                    >
                      {causa.estado === "en_tramite" && <Gavel className="w-5 h-5 text-success" />}
                      {causa.estado === "resuelto" && <CheckCircle className="w-5 h-5 text-info" />}
                      {causa.estado === "archivado" && <FileText className="w-5 h-5 text-muted-foreground" />}
                      {causa.estado === "suspendido" && <AlertTriangle className="w-5 h-5 text-warning" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{causa.numeroExpediente}</p>
                      <p className="text-xs text-muted-foreground">
                        {causa.materia} - {causa.estadoProcesal}
                      </p>
                    </div>
                    {causa.prioridad === "urgente" && (
                      <Badge variant="destructive" className="shrink-0">Urgente</Badge>
                    )}
                    {causa.prioridad === "alta" && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 shrink-0">
                        Alta
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No hay causas asignadas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {user?.cargo === "secretario" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/funcionarios/causas/nueva">
                <FileText className="w-4 h-4 mr-2" />
                Nueva Causa
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/funcionarios/audiencias/nueva">
                <Calendar className="w-4 h-4 mr-2" />
                Programar Audiencia
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/funcionarios/notificaciones">
                <Bell className="w-4 h-4 mr-2" />
                Enviar Notificación
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {user?.cargo === "admin" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Administración</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/funcionarios/cuentas">
                <Users className="w-4 h-4 mr-2" />
                Gestionar Funcionarios
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/funcionarios/auditoria">
                <FileText className="w-4 h-4 mr-2" />
                Ver Auditoría
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </FuncionariosLayout>
  );
};

export default DashboardFuncionarios;
