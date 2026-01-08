// ============================================================================
// JUEZ SEGURO - Gestión de Notificaciones Internas
// Consumo de notificaciones reales del backend (sin mocks)
// ============================================================================

import { useState, useEffect, useMemo } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { notificacionesService, NotificacionInterna } from "@/services/notificaciones.service";
import {
  Bell,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  Loader2,
  FileText,
  Gavel,
  Clock,
  Archive,
  CheckCheck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const GestionNotificaciones = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Estado de datos - consumidos del backend
  const [notificaciones, setNotificaciones] = useState<NotificacionInterna[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [noLeidas, setNoLeidas] = useState(0);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todas");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  
  // Modal de detalle
  const [selectedNotificacion, setSelectedNotificacion] = useState<NotificacionInterna | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Cargar notificaciones del backend
  const cargarNotificaciones = async () => {
    try {
      const resultado = await notificacionesService.getMisNotificaciones({
        estado: filterEstado === "todas" ? undefined : filterEstado as any,
        tipo: filterTipo === "todos" ? undefined : filterTipo,
      });
      
      setNotificaciones(resultado.notificaciones);
      setTotal(resultado.total);
      setNoLeidas(resultado.noLeidas);
    } catch (error) {
      console.error("Error al cargar notificaciones:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las notificaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarNotificaciones();
  }, [filterEstado, filterTipo]);

  const refrescarDatos = async () => {
    setRefreshing(true);
    await cargarNotificaciones();
    setRefreshing(false);
    toast({
      title: "Actualizado",
      description: "Notificaciones actualizadas",
    });
  };

  // Marcar como leída
  const handleMarcarLeida = async (notif: NotificacionInterna) => {
    if (notif.estado === "leida") return;
    
    try {
      await notificacionesService.marcarLeida(notif.id);
      await cargarNotificaciones();
      toast({
        title: "Notificación leída",
        description: "La notificación ha sido marcada como leída",
      });
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  };

  // Marcar todas como leídas
  const handleMarcarTodasLeidas = async () => {
    try {
      const cantidad = await notificacionesService.marcarTodasLeidas();
      await cargarNotificaciones();
      toast({
        title: "Notificaciones actualizadas",
        description: `${cantidad} notificación(es) marcada(s) como leída(s)`,
      });
    } catch (error) {
      console.error("Error al marcar todas como leídas:", error);
    }
  };

  // Archivar notificación
  const handleArchivar = async (notif: NotificacionInterna) => {
    try {
      await notificacionesService.archivar(notif.id);
      await cargarNotificaciones();
      setDetailModalOpen(false);
      toast({
        title: "Notificación archivada",
        description: "La notificación ha sido archivada",
      });
    } catch (error) {
      console.error("Error al archivar:", error);
    }
  };

  // Abrir detalle
  const openDetail = async (notif: NotificacionInterna) => {
    setSelectedNotificacion(notif);
    setDetailModalOpen(true);
    
    // Marcar como leída automáticamente al abrir
    if (notif.estado === "no_leida") {
      await handleMarcarLeida(notif);
    }
  };

  // Stats calculadas
  const stats = useMemo(() => {
    const causasAsignadas = notificaciones.filter((n) => n.tipo === "causa_asignada").length;
    const audienciasProgramadas = notificaciones.filter((n) => n.tipo === "audiencia_programada").length;
    const audienciasReprogramadas = notificaciones.filter((n) => n.tipo === "audiencia_reprogramada").length;
    
    return { causasAsignadas, audienciasProgramadas, audienciasReprogramadas };
  }, [notificaciones]);

  // Filtrar por búsqueda
  const filteredNotificaciones = notificaciones.filter((notif) => {
    const matchesSearch = 
      notif.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.mensaje.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (notif.numeroProceso && notif.numeroProceso.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Badges de tipo
  const getTipoBadge = (tipo: NotificacionInterna["tipo"]) => {
    switch (tipo) {
      case "causa_asignada":
        return (
          <Badge className="bg-primary/20 text-primary flex items-center gap-1">
            <Gavel className="w-3 h-3" />
            Causa Asignada
          </Badge>
        );
      case "audiencia_programada":
        return (
          <Badge className="bg-info/20 text-info flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" />
            Audiencia Programada
          </Badge>
        );
      case "audiencia_reprogramada":
        return (
          <Badge className="bg-warning/20 text-warning flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Audiencia Reprogramada
          </Badge>
        );
      case "documento_agregado":
        return (
          <Badge className="bg-secondary flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Documento
          </Badge>
        );
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  // Badge de prioridad
  const getPrioridadBadge = (prioridad: NotificacionInterna["prioridad"]) => {
    switch (prioridad) {
      case "urgente":
        return <Badge variant="destructive">Urgente</Badge>;
      case "alta":
        return <Badge className="bg-warning text-warning-foreground">Alta</Badge>;
      case "normal":
        return <Badge variant="secondary">Normal</Badge>;
      case "baja":
        return <Badge variant="outline">Baja</Badge>;
    }
  };

  // Badge de estado
  const getEstadoBadge = (estado: NotificacionInterna["estado"]) => {
    switch (estado) {
      case "no_leida":
        return (
          <Badge className="bg-info text-info-foreground flex items-center gap-1">
            <Bell className="w-3 h-3" />
            No leída
          </Badge>
        );
      case "leida":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Leída
          </Badge>
        );
      case "archivada":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Archive className="w-3 h-3" />
            Archivada
          </Badge>
        );
    }
  };

  // Loading state
  if (loading) {
    return (
      <FuncionariosLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2">Cargando notificaciones...</span>
        </div>
      </FuncionariosLayout>
    );
  }

  return (
    <FuncionariosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">Mis Notificaciones</h1>
            <p className="text-muted-foreground">
              Centro de notificaciones del sistema - Causas asignadas, audiencias y más
            </p>
          </div>
          <div className="flex gap-2">
            {noLeidas > 0 && (
              <Button variant="outline" onClick={handleMarcarTodasLeidas}>
                <CheckCheck className="w-4 h-4 mr-2" />
                Marcar todas como leídas
              </Button>
            )}
            <Button variant="outline" onClick={refrescarDatos} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={noLeidas > 0 ? "border-info" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/20">
                  <Bell className="w-5 h-5 text-info" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-info">{noLeidas}</div>
                  <p className="text-sm text-muted-foreground">No Leídas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Gavel className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.causasAsignadas}</div>
                  <p className="text-sm text-muted-foreground">Causas Asignadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <CalendarIcon className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.audienciasProgramadas}</div>
                  <p className="text-sm text-muted-foreground">Audiencias Programadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.audienciasReprogramadas > 0 ? "border-warning" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{stats.audienciasReprogramadas}</div>
                  <p className="text-sm text-muted-foreground">Reprogramaciones</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerta de no leídas */}
        {noLeidas > 0 && (
          <Card className="border-info/50 bg-info/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Bell className="w-6 h-6 text-info shrink-0" />
                <div>
                  <p className="font-semibold text-info">Tienes {noLeidas} notificación(es) sin leer</p>
                  <p className="text-sm text-muted-foreground">
                    Revisa las notificaciones para estar al día con tus causas y audiencias.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, mensaje o número de proceso..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="no_leida">No leídas</SelectItem>
              <SelectItem value="leida">Leídas</SelectItem>
              <SelectItem value="archivada">Archivadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="causa_asignada">Causas asignadas</SelectItem>
              <SelectItem value="audiencia_programada">Audiencias programadas</SelectItem>
              <SelectItem value="audiencia_reprogramada">Reprogramaciones</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificaciones ({filteredNotificaciones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredNotificaciones.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay notificaciones que mostrar</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotificaciones.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 hover:bg-muted/30 cursor-pointer transition-colors ${
                      notif.estado === "no_leida" ? "bg-info/5 border-l-4 border-l-info" : ""
                    }`}
                    onClick={() => openDetail(notif)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getTipoBadge(notif.tipo)}
                          {getPrioridadBadge(notif.prioridad)}
                          {notif.estado === "no_leida" && (
                            <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
                          )}
                        </div>
                        <h3 className={`font-medium ${notif.estado === "no_leida" ? "font-semibold" : ""}`}>
                          {notif.titulo}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {notif.mensaje}
                        </p>
                        {notif.numeroProceso && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Expediente: <span className="font-medium">{notif.numeroProceso}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(notif.fechaCreacion), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                        <div className="mt-2">
                          {getEstadoBadge(notif.estado)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Detalle de Notificación
            </DialogTitle>
          </DialogHeader>
          {selectedNotificacion && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getTipoBadge(selectedNotificacion.tipo)}
                {getPrioridadBadge(selectedNotificacion.prioridad)}
                {getEstadoBadge(selectedNotificacion.estado)}
              </div>

              <div>
                <h3 className="font-semibold text-lg">{selectedNotificacion.titulo}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(selectedNotificacion.fechaCreacion), "EEEE dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border">
                <p className="whitespace-pre-wrap">{selectedNotificacion.mensaje}</p>
              </div>

              {selectedNotificacion.numeroProceso && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Expediente relacionado</p>
                    <p className="font-medium">{selectedNotificacion.numeroProceso}</p>
                  </div>
                </div>
              )}

              {selectedNotificacion.datosAdicionales && (
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-sm font-medium mb-2">Información adicional</p>
                  <div className="space-y-1 text-sm">
                    {selectedNotificacion.datosAdicionales.materia && (
                      <p><span className="text-muted-foreground">Materia:</span> {selectedNotificacion.datosAdicionales.materia}</p>
                    )}
                    {selectedNotificacion.datosAdicionales.tipoAudiencia && (
                      <p><span className="text-muted-foreground">Tipo audiencia:</span> {selectedNotificacion.datosAdicionales.tipoAudiencia}</p>
                    )}
                    {selectedNotificacion.datosAdicionales.fechaHora && (
                      <p>
                        <span className="text-muted-foreground">Fecha programada:</span>{" "}
                        {format(new Date(selectedNotificacion.datosAdicionales.fechaHora), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                    )}
                    {selectedNotificacion.datosAdicionales.motivo && (
                      <p><span className="text-muted-foreground">Motivo:</span> {selectedNotificacion.datosAdicionales.motivo}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {selectedNotificacion.estado !== "archivada" && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleArchivar(selectedNotificacion)}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archivar
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={() => setDetailModalOpen(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FuncionariosLayout>
  );
};

export default GestionNotificaciones;
