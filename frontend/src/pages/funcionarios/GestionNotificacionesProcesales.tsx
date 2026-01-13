// ============================================================================
// JUEZ SEGURO - Gestión de Notificaciones Procesales (HU-SJ-004)
// Registro y seguimiento de notificaciones legales a las partes del proceso
// ============================================================================

import { useState, useEffect, useMemo } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  notificacionesProcesalesService, 
  NotificacionProcesal, 
  TipoNotificacionProcesal,
  TipoDestinatario,
  MedioNotificacionProcesal,
  EstadoNotificacionProcesal,
} from "@/services/notificaciones-procesales.service";
import { plazosService, PlazoProcesal, TipoActuacion } from "@/services/plazos.service";
import { causasService } from "@/services/causas.service";
import { decisionesService, DecisionJudicial } from "@/services/decisiones.service";
import {
  Bell,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  Loader2,
  FileText,
  Clock,
  Plus,
  Send,
  XCircle,
  User,
  Mail,
  MapPin,
  Building,
  Eye,
  Timer,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

// Interfaces auxiliares
interface CausaSimple {
  causaId: number;
  numeroProceso: string;
  materia: string;
  estado: string;
  // Datos de las partes procesales
  actorNombre?: string;
  actorIdentificacion?: string;
  demandadoNombre?: string;
  demandadoIdentificacion?: string;
}

interface DecisionSimple {
  decisionId: number;
  tipoDecision: string;
  titulo: string;
  estado: string;
  fechaFirma?: string;
}

const GestionNotificacionesProcesales = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const esSecretario = user?.cargo === "secretario";
  const esJuez = user?.cargo === "juez";
  
  // Estado de datos
  const [notificaciones, setNotificaciones] = useState<NotificacionProcesal[]>([]);
  const [plazos, setPlazos] = useState<PlazoProcesal[]>([]);
  const [causas, setCausas] = useState<CausaSimple[]>([]);
  const [catalogoActuaciones, setCatalogoActuaciones] = useState<TipoActuacion[]>([]);
  const [decisionesFirmadas, setDecisionesFirmadas] = useState<DecisionSimple[]>([]);
  const [cargandoDecisiones, setCargandoDecisiones] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCausa, setFilterCausa] = useState<string>("todas");
  
  // Modal de crear notificación
  const [crearModalOpen, setCrearModalOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  
  // Modal de detalle
  const [selectedNotificacion, setSelectedNotificacion] = useState<NotificacionProcesal | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Formulario de nueva notificación
  const [nuevaNotif, setNuevaNotif] = useState({
    causaId: 0,
    decisionId: 0,
    tipoNotificacion: "" as TipoNotificacionProcesal | "",
    destinatarioTipo: "" as TipoDestinatario | "",
    destinatarioNombre: "",
    destinatarioIdentificacion: "",
    destinatarioCorreo: "",
    destinatarioDireccion: "",
    destinatarioCasillero: "",
    asunto: "",
    contenido: "",
    medioNotificacion: "" as MedioNotificacionProcesal | "",
    tipoActuacionCodigo: "",
  });

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Cargar causas del usuario
      const causasResult = await causasService.getCausas();
      setCausas(causasResult.data
        .filter((c) => c.id && c.id !== "") // Filtrar causas sin ID válido
        .map((c) => ({
          causaId: parseInt(c.id) || 0,
          numeroProceso: c.numeroExpediente || "Sin número",
          materia: c.materia || "Sin materia",
          estado: c.estado,
          // Incluir datos de las partes procesales
          actorNombre: c.actorNombre,
          actorIdentificacion: c.actorIdentificacion,
          demandadoNombre: c.demandadoNombre,
          demandadoIdentificacion: c.demandadoIdentificacion,
        }))
        .filter((c) => c.causaId > 0) // Solo incluir causas con ID numérico válido
      );
      
      // Cargar catálogo de actuaciones para plazos automáticos
      try {
        const catalogoResult = await plazosService.obtenerCatalogoActuaciones();
        setCatalogoActuaciones(catalogoResult);
      } catch {
        console.warn("No se pudo cargar catálogo de actuaciones");
      }
      
      // Cargar todas las notificaciones y plazos
      await cargarNotificacionesYPlazos();
    } catch (error) {
      console.error("Error cargando datos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const cargarNotificacionesYPlazos = async () => {
    try {
      // Cargar notificaciones de todas las causas del usuario
      const todasNotificaciones: NotificacionProcesal[] = [];
      const todosPlazos: PlazoProcesal[] = [];
      
      for (const causa of causas) {
        try {
          const notifs = await notificacionesProcesalesService.listarPorCausa(causa.causaId);
          todasNotificaciones.push(...notifs);
          
          const plazosResult = await plazosService.listarPorCausa(causa.causaId);
          todosPlazos.push(...plazosResult);
        } catch {
          // Continuar con la siguiente causa si hay error
        }
      }
      
      setNotificaciones(todasNotificaciones);
      setPlazos(todosPlazos);
    } catch (error) {
      console.error("Error cargando notificaciones y plazos:", error);
    }
  };

  // Recargar cuando cambian las causas
  useEffect(() => {
    if (causas.length > 0) {
      cargarNotificacionesYPlazos();
    }
  }, [causas]);

  // Cargar decisiones firmadas cuando cambia la causa seleccionada en el formulario
  const cargarDecisionesFirmadas = async (causaId: number) => {
    if (!causaId) {
      setDecisionesFirmadas([]);
      return;
    }
    
    setCargandoDecisiones(true);
    try {
      const decisiones = await decisionesService.listarMisDecisiones({
        causaId: causaId,
        estado: "FIRMADA",
      });
      
      setDecisionesFirmadas(decisiones.map((d: DecisionJudicial) => ({
        decisionId: d.decisionId,
        tipoDecision: d.tipoDecision,
        titulo: d.titulo,
        estado: d.estado,
        fechaFirma: d.fechaFirma,
      })));
    } catch (error) {
      console.error("Error cargando decisiones firmadas:", error);
      setDecisionesFirmadas([]);
      toast({
        title: "Error",
        description: "No se pudieron cargar las decisiones firmadas",
        variant: "destructive",
      });
    } finally {
      setCargandoDecisiones(false);
    }
  };

  // Efecto para cargar decisiones cuando cambia la causa en el formulario
  useEffect(() => {
    if (nuevaNotif.causaId > 0) {
      cargarDecisionesFirmadas(nuevaNotif.causaId);
    } else {
      setDecisionesFirmadas([]);
    }
  }, [nuevaNotif.causaId]);

  const refrescarDatos = async () => {
    setRefreshing(true);
    await cargarDatos();
    setRefreshing(false);
    toast({
      title: "Actualizado",
      description: "Datos actualizados correctamente",
    });
  };

  // Crear nueva notificación
  const handleCrearNotificacion = async () => {
    if (!nuevaNotif.causaId || !nuevaNotif.decisionId || !nuevaNotif.tipoNotificacion || 
        !nuevaNotif.destinatarioTipo || !nuevaNotif.destinatarioNombre || 
        !nuevaNotif.asunto || !nuevaNotif.medioNotificacion) {
      toast({
        title: "Campos requeridos",
        description: "Complete todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    setCreando(true);
    try {
      await notificacionesProcesalesService.crear({
        causaId: nuevaNotif.causaId,
        decisionId: nuevaNotif.decisionId,
        tipoNotificacion: nuevaNotif.tipoNotificacion as TipoNotificacionProcesal,
        destinatarioTipo: nuevaNotif.destinatarioTipo as TipoDestinatario,
        destinatarioNombre: nuevaNotif.destinatarioNombre,
        destinatarioIdentificacion: nuevaNotif.destinatarioIdentificacion || undefined,
        destinatarioCorreo: nuevaNotif.destinatarioCorreo || undefined,
        destinatarioDireccion: nuevaNotif.destinatarioDireccion || undefined,
        destinatarioCasillero: nuevaNotif.destinatarioCasillero || undefined,
        asunto: nuevaNotif.asunto,
        contenido: nuevaNotif.contenido || undefined,
        medioNotificacion: nuevaNotif.medioNotificacion as MedioNotificacionProcesal,
        tipoActuacionCodigo: (nuevaNotif.tipoActuacionCodigo && nuevaNotif.tipoActuacionCodigo !== "__none__") 
          ? nuevaNotif.tipoActuacionCodigo 
          : undefined,
      });

      toast({
        title: "Notificación creada",
        description: "La notificación procesal ha sido registrada exitosamente",
      });

      setCrearModalOpen(false);
      resetFormulario();
      await cargarNotificacionesYPlazos();
    } catch (error) {
      console.error("Error creando notificación:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear la notificación",
        variant: "destructive",
      });
    } finally {
      setCreando(false);
    }
  };

  const resetFormulario = () => {
    setNuevaNotif({
      causaId: 0,
      decisionId: 0,
      tipoNotificacion: "",
      destinatarioTipo: "",
      destinatarioNombre: "",
      destinatarioIdentificacion: "",
      destinatarioCorreo: "",
      destinatarioDireccion: "",
      destinatarioCasillero: "",
      asunto: "",
      contenido: "",
      medioNotificacion: "",
      tipoActuacionCodigo: "",
    });
  };

  // Confirmar entrega
  const handleConfirmarEntrega = async (notifId: number, evidencia: string) => {
    try {
      await notificacionesProcesalesService.confirmarEntrega(notifId, evidencia);
      toast({
        title: "Entrega confirmada",
        description: "La notificación ha sido marcada como entregada",
      });
      await cargarNotificacionesYPlazos();
      setDetailModalOpen(false);
    } catch (error) {
      console.error("Error confirmando entrega:", error);
      toast({
        title: "Error",
        description: "No se pudo confirmar la entrega",
        variant: "destructive",
      });
    }
  };

  // Estadísticas
  const stats = useMemo(() => {
    const pendientes = notificaciones.filter(n => n.estado === "PENDIENTE").length;
    const enviadas = notificaciones.filter(n => n.estado === "ENVIADA").length;
    const entregadas = notificaciones.filter(n => n.estado === "ENTREGADA").length;
    const fallidas = notificaciones.filter(n => n.estado === "FALLIDA").length;
    
    const plazosVigentes = plazos.filter(p => p.estado === "VIGENTE").length;
    const plazosVencidos = plazos.filter(p => p.estado === "VENCIDO").length;
    const plazosProximosVencer = plazos.filter(p => {
      if (p.estado !== "VIGENTE") return false;
      const diasRestantes = differenceInDays(new Date(p.fechaVencimiento), new Date());
      return diasRestantes <= 3 && diasRestantes >= 0;
    }).length;
    
    return { pendientes, enviadas, entregadas, fallidas, plazosVigentes, plazosVencidos, plazosProximosVencer };
  }, [notificaciones, plazos]);

  // Filtrar notificaciones
  const notificacionesFiltradas = useMemo(() => {
    return notificaciones.filter(notif => {
      const matchesSearch = 
        notif.asunto.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notif.destinatarioNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (notif.numeroProceso && notif.numeroProceso.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesEstado = filterEstado === "todos" || notif.estado === filterEstado;
      const matchesCausa = filterCausa === "todas" || notif.causaId.toString() === filterCausa;
      
      return matchesSearch && matchesEstado && matchesCausa;
    });
  }, [notificaciones, searchQuery, filterEstado, filterCausa]);

  // Badges de estado
  const getEstadoBadge = (estado: EstadoNotificacionProcesal) => {
    switch (estado) {
      case "PENDIENTE":
        return <Badge className="bg-warning/20 text-warning flex items-center gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>;
      case "ENVIADA":
        return <Badge className="bg-info/20 text-info flex items-center gap-1"><Send className="w-3 h-3" />Enviada</Badge>;
      case "ENTREGADA":
        return <Badge className="bg-success/20 text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Entregada</Badge>;
      case "FALLIDA":
        return <Badge className="bg-destructive/20 text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" />Fallida</Badge>;
      case "ANULADA":
        return <Badge variant="secondary" className="flex items-center gap-1"><XCircle className="w-3 h-3" />Anulada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const getTipoBadge = (tipo: TipoNotificacionProcesal) => {
    const colores: Record<string, string> = {
      CITACION: "bg-blue-500/20 text-blue-600",
      TRASLADO: "bg-purple-500/20 text-purple-600",
      AUTO: "bg-orange-500/20 text-orange-600",
      PROVIDENCIA: "bg-cyan-500/20 text-cyan-600",
      SENTENCIA: "bg-green-500/20 text-green-600",
      REQUERIMIENTO: "bg-amber-500/20 text-amber-600",
      BOLETA: "bg-gray-500/20 text-gray-600",
      DEPOSITO_JUDICIAL: "bg-pink-500/20 text-pink-600",
    };
    return <Badge className={colores[tipo] || "bg-muted"}>{tipo.replace("_", " ")}</Badge>;
  };

  // Loading state
  if (loading) {
    return (
      <FuncionariosLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2">Cargando notificaciones procesales...</span>
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
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Notificaciones Procesales
            </h1>
            <p className="text-muted-foreground">
              {esSecretario 
                ? "Registro y seguimiento de notificaciones legales a las partes del proceso"
                : "Consulta de notificaciones procesales de sus causas asignadas"
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refrescarDatos} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            {esSecretario && (
              <Dialog open={crearModalOpen} onOpenChange={setCrearModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Notificación
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crear Notificación Procesal</DialogTitle>
                    <DialogDescription>
                      Complete los datos de la notificación. Se vinculará automáticamente al expediente electrónico.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    {/* Selección de causa */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Causa *</Label>
                        <Select 
                          value={nuevaNotif.causaId > 0 ? String(nuevaNotif.causaId) : ""} 
                          onValueChange={(v) => setNuevaNotif({...nuevaNotif, causaId: parseInt(v) || 0, decisionId: 0})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione causa" />
                          </SelectTrigger>
                          <SelectContent>
                            {causas.filter(c => c.causaId > 0).map(c => (
                              <SelectItem key={c.causaId} value={String(c.causaId)}>
                                {c.numeroProceso} - {c.materia}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Decisión Firmada *</Label>
                        <Select 
                          value={nuevaNotif.decisionId > 0 ? String(nuevaNotif.decisionId) : ""}
                          onValueChange={(v) => setNuevaNotif({...nuevaNotif, decisionId: parseInt(v) || 0})}
                          disabled={!nuevaNotif.causaId || cargandoDecisiones}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={cargandoDecisiones ? "Cargando..." : "Seleccione decisión"} />
                          </SelectTrigger>
                          <SelectContent>
                            {cargandoDecisiones ? (
                              <SelectItem value="__loading__" disabled>
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Cargando decisiones...
                                </span>
                              </SelectItem>
                            ) : decisionesFirmadas.length === 0 ? (
                              <SelectItem value="__empty__" disabled>
                                No hay decisiones firmadas para esta causa
                              </SelectItem>
                            ) : (
                              decisionesFirmadas.map(d => (
                                <SelectItem key={d.decisionId} value={String(d.decisionId || 0)}>
                                  [{d.tipoDecision}] {d.titulo} 
                                  {d.fechaFirma && ` - ${format(new Date(d.fechaFirma), "dd/MM/yyyy", { locale: es })}`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Tipo de notificación y medio */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Notificación *</Label>
                        <Select 
                          value={nuevaNotif.tipoNotificacion}
                          onValueChange={(v) => setNuevaNotif({...nuevaNotif, tipoNotificacion: v as TipoNotificacionProcesal})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="citacion">Citación</SelectItem>
                            <SelectItem value="notificacion">Notificación</SelectItem>
                            <SelectItem value="emplazamiento">Emplazamiento</SelectItem>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="providencia">Providencia</SelectItem>
                            <SelectItem value="sentencia">Sentencia</SelectItem>
                            <SelectItem value="recordatorio">Recordatorio</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Medio de Notificación *</Label>
                        <Select 
                          value={nuevaNotif.medioNotificacion}
                          onValueChange={(v) => setNuevaNotif({...nuevaNotif, medioNotificacion: v as MedioNotificacionProcesal})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione medio" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BUZON_ELECTRONICO">Buzón Electrónico</SelectItem>
                            <SelectItem value="CORREO_ELECTRONICO">Correo Electrónico</SelectItem>
                            <SelectItem value="CASILLERO_JUDICIAL">Casillero Judicial</SelectItem>
                            <SelectItem value="FISICO">Físico (Personal)</SelectItem>
                            <SelectItem value="PUBLICACION">Publicación</SelectItem>
                            <SelectItem value="DEPRECATORIO">Deprecatorio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Datos del destinatario */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Datos del Destinatario
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo de Parte *</Label>
                          <Select 
                            value={nuevaNotif.destinatarioTipo}
                            onValueChange={(v) => {
                              const tipoSeleccionado = v as TipoDestinatario;
                              // Buscar la causa seleccionada para obtener datos de las partes
                              const causaSeleccionada = causas.find(c => c.causaId === nuevaNotif.causaId);
                              
                              let nombreAutocompletado = "";
                              let identificacionAutocompletada = "";
                              
                              if (causaSeleccionada) {
                                if (tipoSeleccionado === "actor") {
                                  nombreAutocompletado = causaSeleccionada.actorNombre || "";
                                  identificacionAutocompletada = causaSeleccionada.actorIdentificacion || "";
                                } else if (tipoSeleccionado === "demandado") {
                                  nombreAutocompletado = causaSeleccionada.demandadoNombre || "";
                                  identificacionAutocompletada = causaSeleccionada.demandadoIdentificacion || "";
                                }
                              }
                              
                              setNuevaNotif({
                                ...nuevaNotif, 
                                destinatarioTipo: tipoSeleccionado,
                                destinatarioNombre: nombreAutocompletado,
                                destinatarioIdentificacion: identificacionAutocompletada,
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="actor">Actor</SelectItem>
                              <SelectItem value="demandado">Demandado</SelectItem>
                              <SelectItem value="abogado_actor">Abogado del Actor</SelectItem>
                              <SelectItem value="abogado_demandado">Abogado del Demandado</SelectItem>
                              <SelectItem value="tercero">Tercero</SelectItem>
                              <SelectItem value="perito">Perito</SelectItem>
                              <SelectItem value="testigo">Testigo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Nombre Completo *</Label>
                          <Input 
                            placeholder="Nombre del destinatario"
                            value={nuevaNotif.destinatarioNombre}
                            onChange={(e) => setNuevaNotif({...nuevaNotif, destinatarioNombre: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Identificación</Label>
                          <Input 
                            placeholder="Cédula/RUC/Pasaporte"
                            value={nuevaNotif.destinatarioIdentificacion}
                            onChange={(e) => setNuevaNotif({...nuevaNotif, destinatarioIdentificacion: e.target.value})}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Correo Electrónico</Label>
                          <Input 
                            type="email"
                            placeholder="email@ejemplo.com"
                            value={nuevaNotif.destinatarioCorreo}
                            onChange={(e) => setNuevaNotif({...nuevaNotif, destinatarioCorreo: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Dirección</Label>
                        <Input 
                          placeholder="Dirección física"
                          value={nuevaNotif.destinatarioDireccion}
                          onChange={(e) => setNuevaNotif({...nuevaNotif, destinatarioDireccion: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* Asunto y contenido */}
                    <div className="space-y-2">
                      <Label>Asunto *</Label>
                      <Input 
                        placeholder="Asunto de la notificación"
                        value={nuevaNotif.asunto}
                        onChange={(e) => setNuevaNotif({...nuevaNotif, asunto: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Contenido / Detalle</Label>
                      <Textarea 
                        placeholder="Contenido adicional de la notificación..."
                        value={nuevaNotif.contenido}
                        onChange={(e) => setNuevaNotif({...nuevaNotif, contenido: e.target.value})}
                        rows={4}
                      />
                    </div>

                    {/* Información sobre plazo automático */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>💡 Plazo automático:</strong> Al crear esta notificación, se generará automáticamente 
                        un plazo procesal basado en el tipo de notificación seleccionado.
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCrearModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCrearNotificacion} disabled={creando}>
                      {creando ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Crear Notificación
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{stats.pendientes}</div>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/20">
                  <Send className="w-5 h-5 text-info" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-info">{stats.enviadas}</div>
                  <p className="text-xs text-muted-foreground">Enviadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-success">{stats.entregadas}</div>
                  <p className="text-xs text-muted-foreground">Entregadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-destructive">{stats.fallidas}</div>
                  <p className="text-xs text-muted-foreground">Fallidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.plazosProximosVencer > 0 ? "border-warning" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-500">{stats.plazosProximosVencer}</div>
                  <p className="text-xs text-muted-foreground">Por Vencer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Timer className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.plazosVigentes}</div>
                  <p className="text-xs text-muted-foreground">Plazos Vigentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.plazosVencidos > 0 ? "border-destructive" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-500">{stats.plazosVencidos}</div>
                  <p className="text-xs text-muted-foreground">Plazos Vencidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="notificaciones" className="w-full">
          <TabsList>
            <TabsTrigger value="notificaciones">
              <Bell className="w-4 h-4 mr-2" />
              Notificaciones ({notificaciones.length})
            </TabsTrigger>
            <TabsTrigger value="plazos">
              <Timer className="w-4 h-4 mr-2" />
              Plazos ({plazos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notificaciones" className="mt-4 space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por asunto, destinatario o expediente..."
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
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                  <SelectItem value="ENVIADA">Enviadas</SelectItem>
                  <SelectItem value="ENTREGADA">Entregadas</SelectItem>
                  <SelectItem value="FALLIDA">Fallidas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCausa} onValueChange={setFilterCausa}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Causa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las causas</SelectItem>
                  {causas.filter(c => c.causaId > 0).map(c => (
                    <SelectItem key={c.causaId} value={String(c.causaId)}>
                      {c.numeroProceso}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de notificaciones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notificaciones Procesales
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {notificacionesFiltradas.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay notificaciones que mostrar</p>
                    {esSecretario && (
                      <Button className="mt-4" onClick={() => setCrearModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Crear Primera Notificación
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {notificacionesFiltradas.map((notif) => (
                      <div
                        key={notif.notificacionId}
                        className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedNotificacion(notif);
                          setDetailModalOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {getTipoBadge(notif.tipoNotificacion)}
                              {getEstadoBadge(notif.estado)}
                            </div>
                            <h3 className="font-medium">{notif.asunto}</h3>
                            <p className="text-sm text-muted-foreground">
                              <User className="w-3 h-3 inline mr-1" />
                              {notif.destinatarioNombre} ({notif.destinatarioTipo})
                            </p>
                            {notif.numeroProceso && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <FileText className="w-3 h-3 inline mr-1" />
                                Expediente: {notif.numeroProceso}
                                {notif.decisionTitulo && ` - ${notif.decisionTitulo}`}
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
                            <Button variant="ghost" size="sm" className="mt-2">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plazos" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-5 h-5" />
                  Control de Plazos Procesales
                </CardTitle>
                <CardDescription>
                  Seguimiento de plazos judiciales con alertas automáticas
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {plazos.length === 0 ? (
                  <div className="text-center py-12">
                    <Timer className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay plazos registrados</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {plazos.map((plazo) => {
                      const diasRestantes = differenceInDays(new Date(plazo.fechaVencimiento), new Date());
                      const esUrgente = plazo.estado === "VIGENTE" && diasRestantes <= 3 && diasRestantes >= 0;
                      const estaVencido = plazo.estado === "VENCIDO" || diasRestantes < 0;
                      
                      return (
                        <div
                          key={plazo.plazoId}
                          className={`p-4 ${esUrgente ? "bg-warning/5 border-l-4 border-l-warning" : estaVencido ? "bg-destructive/5 border-l-4 border-l-destructive" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={plazo.estado === "VIGENTE" ? "default" : plazo.estado === "CUMPLIDO" ? "secondary" : "destructive"}>
                                  {plazo.estado}
                                </Badge>
                                {esUrgente && (
                                  <Badge className="bg-warning text-warning-foreground">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    ¡Próximo a vencer!
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-medium">{plazo.tipoPlazo}</h4>
                              <p className="text-sm text-muted-foreground">{plazo.descripcion}</p>
                              {plazo.numeroProceso && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <FileText className="w-3 h-3 inline mr-1" />
                                  Expediente: {plazo.numeroProceso}
                                </p>
                              )}
                              {(plazo.parteResponsableNombre || plazo.parteResponsable) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Responsable: {plazo.parteResponsableNombre || plazo.parteResponsable}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {plazo.diasPlazo} días hábiles
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Vence: {format(new Date(plazo.fechaVencimiento), "dd/MM/yyyy", { locale: es })}
                              </p>
                              {plazo.estado === "VIGENTE" && (
                                <p className={`text-xs mt-1 ${diasRestantes <= 3 ? "text-warning font-medium" : "text-muted-foreground"}`}>
                                  {diasRestantes >= 0 ? `${diasRestantes} días restantes` : "VENCIDO"}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de detalle */}
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
                {getTipoBadge(selectedNotificacion.tipoNotificacion)}
                {getEstadoBadge(selectedNotificacion.estado)}
              </div>

              <div>
                <h3 className="font-semibold text-lg">{selectedNotificacion.asunto}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(selectedNotificacion.fechaCreacion), "EEEE dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{selectedNotificacion.destinatarioNombre}</span>
                  <Badge variant="outline">{selectedNotificacion.destinatarioTipo}</Badge>
                </div>
                {selectedNotificacion.destinatarioCorreo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {selectedNotificacion.destinatarioCorreo}
                  </div>
                )}
                {selectedNotificacion.destinatarioDireccion && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {selectedNotificacion.destinatarioDireccion}
                  </div>
                )}
                {selectedNotificacion.destinatarioCasillero && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building className="w-4 h-4" />
                    Casillero: {selectedNotificacion.destinatarioCasillero}
                  </div>
                )}
              </div>

              {selectedNotificacion.contenido && (
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <p className="whitespace-pre-wrap text-sm">{selectedNotificacion.contenido}</p>
                </div>
              )}

              {selectedNotificacion.numeroProceso && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Expediente</p>
                    <p className="font-medium">{selectedNotificacion.numeroProceso}</p>
                  </div>
                </div>
              )}

              {esSecretario && selectedNotificacion.estado === "ENVIADA" && (
                <div className="pt-2">
                  <Button 
                    className="w-full"
                    onClick={() => handleConfirmarEntrega(selectedNotificacion.notificacionId, "Confirmación manual")}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar Entrega
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FuncionariosLayout>
  );
};

export default GestionNotificacionesProcesales;
