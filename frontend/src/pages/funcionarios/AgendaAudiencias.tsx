// ============================================================================
// JUEZ SEGURO - Agenda de Audiencias
// HU-SJ-003: Programación y gestión de audiencias
// HU-JZ-002: Consulta de la agenda de audiencias del juez
// ============================================================================

import { useState, useEffect } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { audienciasService, AudienciaConHistorial } from "@/services/audiencias.service";
import { causasService } from "@/services/causas.service";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  History,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Video,
  Building,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Audiencia, TipoAudiencia, Causa, Modalidad } from "@/types";

const AgendaAudiencias = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Estado de datos - consumidos del backend
  const [audiencias, setAudiencias] = useState<AudienciaConHistorial[]>([]);
  const [causas, setCausas] = useState<Causa[]>([]);
  const [audienciasReprogramadas, setAudienciasReprogramadas] = useState<AudienciaConHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAudiencia, setSelectedAudiencia] = useState<AudienciaConHistorial | null>(null);
  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [reprogramarModalOpen, setReprogramarModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state para crear audiencia
  const [selectedCausa, setSelectedCausa] = useState("");
  const [tipoAudiencia, setTipoAudiencia] = useState<TipoAudiencia>("inicial");
  const [fechaAudiencia, setFechaAudiencia] = useState<Date>();
  const [horaAudiencia, setHoraAudiencia] = useState("");
  const [salaAudiencia, setSalaAudiencia] = useState("");
  const [modalidadAudiencia, setModalidadAudiencia] = useState<Modalidad>("presencial");
  const [enlaceVirtual, setEnlaceVirtual] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Form state para reprogramar
  const [nuevaFechaReprogramar, setNuevaFechaReprogramar] = useState<Date>();
  const [nuevaHoraReprogramar, setNuevaHoraReprogramar] = useState("");
  const [motivoReprogramar, setMotivoReprogramar] = useState("");

  const salas = ["Sala 1A", "Sala 2B", "Sala 3C", "Sala Virtual 1", "Sala Virtual 2"];

  // Cargar datos del backend
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      // Cargar audiencias según el rol
      const audienciasData = user?.cargo === "juez" 
        ? await audienciasService.getAgendaJuez()
        : (await audienciasService.getAudiencias()).data || [];
      
      setAudiencias(audienciasData);
      
      // Cargar causas para el formulario de programación
      if (user?.cargo === "secretario" || user?.cargo === "cj") {
        const causasData = await causasService.getCausas();
        setCausas(causasData.data || []);
      }
      
      // Cargar audiencias reprogramadas recientes (HU-JZ-002: alertas para el juez)
      if (user?.cargo === "juez") {
        const { audiencias: reprogramadas } = await audienciasService.getAudienciasReprogramadasRecientes(7);
        setAudienciasReprogramadas(reprogramadas);
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las audiencias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refrescarDatos = async () => {
    setRefreshing(true);
    await cargarDatos();
    setRefreshing(false);
    toast({
      title: "Actualizado",
      description: "Los datos han sido actualizados",
    });
  };

  // Helper para obtener fecha de audiencia
  const getFechaAudiencia = (aud: AudienciaConHistorial): Date => {
    const fechaStr = aud.fechaHora || aud.fecha_hora || aud.fecha;
    return fechaStr ? parseISO(fechaStr) : new Date();
  };

  // Helper para obtener hora de audiencia
  const getHoraAudiencia = (aud: AudienciaConHistorial): string => {
    if (aud.hora) return aud.hora;
    const fecha = getFechaAudiencia(aud);
    return format(fecha, "HH:mm");
  };

  // Calendar days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get audiencias for a specific day
  const getAudienciasForDay = (date: Date) => {
    return audiencias.filter((aud) => {
      const fechaAud = getFechaAudiencia(aud);
      return isSameDay(fechaAud, date);
    });
  };

  // Audiencias for selected date
  const audienciasDelDia = selectedDate ? getAudienciasForDay(selectedDate) : [];

  const getEstadoBadge = (estado: Audiencia["estado"], fueReprogramada?: boolean) => {
    if (fueReprogramada || estado === "reprogramada") {
      return <Badge className="bg-warning text-warning-foreground"><History className="w-3 h-3 mr-1" />Reprogramada</Badge>;
    }
    switch (estado) {
      case "programada":
        return <Badge className="bg-info text-info-foreground">Programada</Badge>;
      case "realizada":
        return <Badge className="bg-success text-success-foreground">Realizada</Badge>;
      case "cancelada":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const getTipoBadge = (tipo: TipoAudiencia) => {
    switch (tipo) {
      case "inicial":
        return <Badge variant="outline">Inicial</Badge>;
      case "evaluacion":
        return <Badge variant="outline" className="border-info text-info">Evaluación</Badge>;
      case "juicio":
        return <Badge variant="outline" className="border-warning text-warning">Juicio</Badge>;
      case "resolucion":
        return <Badge variant="outline" className="border-success text-success">Resolución</Badge>;
      case "conciliacion":
        return <Badge variant="outline" className="border-primary text-primary">Conciliación</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  // HU-SJ-003: Programar nueva audiencia con validación de fecha futura
  const handleScheduleAudiencia = async () => {
    if (!selectedCausa || !tipoAudiencia || !fechaAudiencia || !horaAudiencia || !salaAudiencia) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete todos los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    // Validar que la fecha sea futura
    const fechaHoraCompleta = new Date(fechaAudiencia);
    const [hora, minutos] = horaAudiencia.split(":").map(Number);
    fechaHoraCompleta.setHours(hora, minutos, 0, 0);

    if (fechaHoraCompleta <= new Date()) {
      toast({
        title: "Fecha inválida",
        description: "La fecha y hora de la audiencia debe ser futura.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      await audienciasService.programarAudiencia({
        causaId: selectedCausa,
        tipo: tipoAudiencia,
        fechaHora: fechaHoraCompleta.toISOString(),
        sala: salaAudiencia,
        duracionMinutos: 60,
        modalidad: modalidadAudiencia,
        enlaceVirtual: modalidadAudiencia === "virtual" ? enlaceVirtual : undefined,
        observaciones: observaciones || undefined,
      });

      toast({
        title: "Audiencia programada",
        description: `Audiencia de ${tipoAudiencia} programada para el ${format(fechaAudiencia, "dd/MM/yyyy")} a las ${horaAudiencia}.`,
      });

      setScheduleModalOpen(false);
      resetFormulario();
      await cargarDatos();
    } catch (error) {
      console.error("Error programando audiencia:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo programar la audiencia",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // HU-SJ-003: Reprogramar audiencia con registro de historial para trazabilidad
  const handleReprogramarAudiencia = async () => {
    if (!selectedAudiencia || !nuevaFechaReprogramar || !nuevaHoraReprogramar || !motivoReprogramar) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete todos los campos.",
        variant: "destructive",
      });
      return;
    }

    if (motivoReprogramar.length < 10) {
      toast({
        title: "Motivo muy corto",
        description: "El motivo debe tener al menos 10 caracteres.",
        variant: "destructive",
      });
      return;
    }

    const fechaHoraCompleta = new Date(nuevaFechaReprogramar);
    const [hora, minutos] = nuevaHoraReprogramar.split(":").map(Number);
    fechaHoraCompleta.setHours(hora, minutos, 0, 0);

    if (fechaHoraCompleta <= new Date()) {
      toast({
        title: "Fecha inválida",
        description: "La nueva fecha debe ser futura.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      await audienciasService.reprogramarAudiencia(selectedAudiencia.id, {
        nuevaFecha: fechaHoraCompleta.toISOString(),
        motivo: motivoReprogramar,
      });

      toast({
        title: "Audiencia reprogramada",
        description: "Se ha registrado el cambio en el historial de trazabilidad.",
      });

      setReprogramarModalOpen(false);
      setNuevaFechaReprogramar(undefined);
      setNuevaHoraReprogramar("");
      setMotivoReprogramar("");
      setSelectedAudiencia(null);
      await cargarDatos();
    } catch (error) {
      console.error("Error reprogramando audiencia:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo reprogramar la audiencia",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetFormulario = () => {
    setSelectedCausa("");
    setTipoAudiencia("inicial");
    setFechaAudiencia(undefined);
    setHoraAudiencia("");
    setSalaAudiencia("");
    setModalidadAudiencia("presencial");
    setEnlaceVirtual("");
    setObservaciones("");
  };

  const openAudienciaDetail = (audiencia: AudienciaConHistorial) => {
    setSelectedAudiencia(audiencia);
    setDetailModalOpen(true);
  };

  const openHistorial = async (audiencia: AudienciaConHistorial) => {
    try {
      if (!audiencia.historialCambios || audiencia.historialCambios.length === 0) {
        const historial = await audienciasService.getHistorialReprogramaciones(audiencia.id);
        setSelectedAudiencia({ ...audiencia, historialCambios: historial as any });
      } else {
        setSelectedAudiencia(audiencia);
      }
      setHistorialModalOpen(true);
    } catch (error) {
      console.error("Error cargando historial:", error);
      setSelectedAudiencia(audiencia);
      setHistorialModalOpen(true);
    }
  };

  const openReprogramar = (audiencia: AudienciaConHistorial) => {
    setSelectedAudiencia(audiencia);
    setReprogramarModalOpen(true);
  };

  if (loading) {
    return (
      <FuncionariosLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2">Cargando audiencias...</span>
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
            <h1 className="text-2xl font-heading font-bold">Agenda de Audiencias</h1>
            <p className="text-muted-foreground">
              {user?.cargo === "juez" ? "Mis audiencias programadas" : "Gestión de audiencias judiciales"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refrescarDatos} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            {(user?.cargo === "secretario" || user?.cargo === "cj") && (
              <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Programar Audiencia
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Programar Nueva Audiencia</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Causa / Expediente *</Label>
                      <Select value={selectedCausa} onValueChange={setSelectedCausa}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar causa..." />
                        </SelectTrigger>
                        <SelectContent>
                          {causas.map((causa) => (
                            <SelectItem key={causa.id} value={causa.id}>
                              {causa.numeroExpediente} - {causa.materia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de Audiencia *</Label>
                      <Select value={tipoAudiencia} onValueChange={(v) => setTipoAudiencia(v as TipoAudiencia)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inicial">Audiencia Inicial</SelectItem>
                          <SelectItem value="preliminar">Audiencia Preliminar</SelectItem>
                          <SelectItem value="evaluacion">Audiencia de Evaluación</SelectItem>
                          <SelectItem value="juicio">Audiencia de Juicio</SelectItem>
                          <SelectItem value="resolucion">Audiencia de Resolución</SelectItem>
                          <SelectItem value="conciliacion">Audiencia de Conciliación</SelectItem>
                          <SelectItem value="sentencia">Audiencia de Sentencia</SelectItem>
                          <SelectItem value="otra">Otra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fecha *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {fechaAudiencia ? format(fechaAudiencia, "dd/MM/yyyy") : "Seleccionar..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={fechaAudiencia}
                              onSelect={setFechaAudiencia}
                              disabled={(date) => date < new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Hora *</Label>
                        <Input
                          type="time"
                          value={horaAudiencia}
                          onChange={(e) => setHoraAudiencia(e.target.value)}
                          min="07:00"
                          max="23:00"
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">Horario: 7:00 AM - 11:00 PM</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Sala *</Label>
                        <Select value={salaAudiencia} onValueChange={setSalaAudiencia}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar sala..." />
                          </SelectTrigger>
                          <SelectContent>
                            {salas.map((sala) => (
                              <SelectItem key={sala} value={sala}>
                                {sala.includes("Virtual") ? (
                                  <span className="flex items-center gap-2">
                                    <Video className="w-4 h-4" /> {sala}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <Building className="w-4 h-4" /> {sala}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Modalidad *</Label>
                        <Select value={modalidadAudiencia} onValueChange={(v) => setModalidadAudiencia(v as Modalidad)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="presencial">
                              <span className="flex items-center gap-2">
                                <Building className="w-4 h-4" /> Presencial
                              </span>
                            </SelectItem>
                            <SelectItem value="virtual">
                              <span className="flex items-center gap-2">
                                <Video className="w-4 h-4" /> Virtual
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {modalidadAudiencia === "virtual" && (
                      <div className="space-y-2">
                        <Label>Enlace de videoconferencia</Label>
                        <input
                          type="url"
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="https://..."
                          value={enlaceVirtual}
                          onChange={(e) => setEnlaceVirtual(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Observaciones</Label>
                      <Textarea
                        placeholder="Notas adicionales..."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleScheduleAudiencia} disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Programando...
                        </>
                      ) : (
                        "Programar Audiencia"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* HU-JZ-002: Alertas de reprogramaciones para el juez */}
        {audienciasReprogramadas.length > 0 && user?.cargo === "juez" && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">
                  {audienciasReprogramadas.length} audiencia(s) han sido reprogramadas recientemente
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {audienciasReprogramadas.slice(0, 3).map((aud) => (
                  <div key={aud.id} className="text-sm text-muted-foreground flex items-center gap-2">
                    <History className="w-3 h-3" />
                    <span>{aud.numeroExpediente || `Causa ${aud.causaId}`}</span>
                    <span>→</span>
                    <span>{format(getFechaAudiencia(aud), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  {format(currentMonth, "MMMM yyyy", { locale: es })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                    Hoy
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Days header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Add empty cells for days before month starts */}
                {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {calendarDays.map((day) => {
                  const dayAudiencias = getAudienciasForDay(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const hasReprogramada = dayAudiencias.some((a) => a.fueReprogramada || a.estado === "reprogramada");

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        aspect-square p-1 rounded-lg border transition-colors relative
                        ${isToday(day) ? "border-primary" : "border-transparent"}
                        ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}
                        ${!isSameMonth(day, currentMonth) ? "text-muted-foreground/50" : ""}
                      `}
                    >
                      <span className="text-sm">{format(day, "d")}</span>
                      {dayAudiencias.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayAudiencias.slice(0, 3).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                hasReprogramada ? "bg-warning" : "bg-info"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Audiencias del día */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDate
                  ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })
                  : "Seleccione una fecha"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-muted-foreground text-center py-8">
                  Haga clic en un día del calendario
                </p>
              ) : audienciasDelDia.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay audiencias programadas
                </p>
              ) : (
                <div className="space-y-3">
                  {audienciasDelDia.map((audiencia) => (
                    <div
                      key={audiencia.id}
                      className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => openAudienciaDetail(audiencia)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        {getTipoBadge(audiencia.tipo)}
                        {getEstadoBadge(audiencia.estado, audiencia.fueReprogramada)}
                      </div>
                      <p className="font-medium text-sm mb-1">
                        {audiencia.numeroExpediente || `Causa ${audiencia.causaId}`}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getHoraAudiencia(audiencia)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {audiencia.sala}
                        </span>
                      </div>
                      {(audiencia.fueReprogramada || (audiencia.historialCambios && audiencia.historialCambios.length > 0)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 text-xs text-warning"
                          onClick={(e) => {
                            e.stopPropagation();
                            openHistorial(audiencia);
                          }}
                        >
                          <History className="w-3 h-3 mr-1" />
                          Ver historial de cambios
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista de próximas audiencias */}
        <Card>
          <CardHeader>
            <CardTitle>Próximas Audiencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Expediente</th>
                    <th className="text-left p-3 font-medium">Tipo</th>
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Hora</th>
                    <th className="text-left p-3 font-medium">Sala</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    {(user?.cargo === "secretario" || user?.cargo === "cj") && (
                      <th className="text-left p-3 font-medium">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {audiencias
                    .filter((a) => getFechaAudiencia(a) >= new Date())
                    .slice(0, 10)
                    .map((audiencia) => (
                      <tr
                        key={audiencia.id}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => openAudienciaDetail(audiencia)}
                      >
                        <td className="p-3 font-medium">
                          {audiencia.numeroExpediente || `Causa ${audiencia.causaId}`}
                        </td>
                        <td className="p-3">{getTipoBadge(audiencia.tipo)}</td>
                        <td className="p-3 text-sm">
                          {format(getFechaAudiencia(audiencia), "dd/MM/yyyy", { locale: es })}
                        </td>
                        <td className="p-3 text-sm">{getHoraAudiencia(audiencia)}</td>
                        <td className="p-3 text-sm">
                          <span className="flex items-center gap-1">
                            {audiencia.sala?.includes("Virtual") ? (
                              <Video className="w-4 h-4 text-info" />
                            ) : (
                              <Building className="w-4 h-4 text-muted-foreground" />
                            )}
                            {audiencia.sala}
                          </span>
                        </td>
                        <td className="p-3">{getEstadoBadge(audiencia.estado, audiencia.fueReprogramada)}</td>
                        {(user?.cargo === "secretario" || user?.cargo === "cj") && (
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openReprogramar(audiencia);
                              }}
                              disabled={audiencia.estado === "cancelada" || audiencia.estado === "realizada"}
                            >
                              <History className="w-4 h-4 mr-1" />
                              Reprogramar
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
              {audiencias.filter((a) => getFechaAudiencia(a) >= new Date()).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay audiencias próximas programadas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Audiencia</DialogTitle>
          </DialogHeader>
          {selectedAudiencia && (
            <div className="space-y-4">
              {selectedAudiencia.fueReprogramada && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertCircle className="w-5 h-5 text-warning" />
                  <span className="text-sm font-medium text-warning">Esta audiencia fue reprogramada</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {getTipoBadge(selectedAudiencia.tipo)}
                {getEstadoBadge(selectedAudiencia.estado, selectedAudiencia.fueReprogramada)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Expediente</p>
                  <p className="font-medium">{selectedAudiencia.numeroExpediente || `Causa ${selectedAudiencia.causaId}`}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha y Hora</p>
                  <p className="font-medium">
                    {format(getFechaAudiencia(selectedAudiencia), "dd/MM/yyyy", { locale: es })} - {getHoraAudiencia(selectedAudiencia)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sala</p>
                  <p className="font-medium flex items-center gap-1">
                    {selectedAudiencia.sala?.includes("Virtual") ? (
                      <Video className="w-4 h-4 text-info" />
                    ) : (
                      <Building className="w-4 h-4" />
                    )}
                    {selectedAudiencia.sala || "No asignada"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modalidad</p>
                  <p className="font-medium capitalize">{selectedAudiencia.modalidad || "presencial"}</p>
                </div>
                {selectedAudiencia.partes && selectedAudiencia.partes.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Partes</p>
                    <p className="font-medium">{selectedAudiencia.partes.join(", ")}</p>
                  </div>
                )}
              </div>
              {selectedAudiencia.observaciones && (
                <div>
                  <p className="text-sm text-muted-foreground">Observaciones</p>
                  <p className="text-sm">{selectedAudiencia.observaciones}</p>
                </div>
              )}
              {selectedAudiencia.fueReprogramada && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setDetailModalOpen(false);
                    openHistorial(selectedAudiencia);
                  }}
                >
                  <History className="w-4 h-4 mr-2" />
                  Ver historial de cambios
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Historial Modal */}
      <Dialog open={historialModalOpen} onOpenChange={setHistorialModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historial de Reprogramaciones
            </DialogTitle>
          </DialogHeader>
          {selectedAudiencia && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(!selectedAudiencia.historialCambios || selectedAudiencia.historialCambios.length === 0) ? (
                <p className="text-muted-foreground text-center py-4">
                  No hay cambios registrados para esta audiencia
                </p>
              ) : (
                selectedAudiencia.historialCambios.map((cambio, index) => (
                  <div key={cambio.historialId || index} className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                        {cambio.tipoCambio || "Reprogramación"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {cambio.fecha && !isNaN(new Date(cambio.fecha).getTime()) 
                          ? format(new Date(cambio.fecha), "dd/MM/yyyy HH:mm", { locale: es })
                          : "Fecha no disponible"}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      {cambio.fechaHoraAnterior && cambio.fechaHoraNueva && 
                       !isNaN(new Date(cambio.fechaHoraAnterior).getTime()) && 
                       !isNaN(new Date(cambio.fechaHoraNueva).getTime()) && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Cambio:</span>
                          <span className="line-through text-destructive">
                            {format(new Date(cambio.fechaHoraAnterior), "dd/MM/yyyy HH:mm", { locale: es })}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                          <span className="text-success font-medium">
                            {format(new Date(cambio.fechaHoraNueva), "dd/MM/yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                      )}
                      {cambio.motivoReprogramacion && (
                        <div>
                          <span className="text-muted-foreground">Motivo: </span>
                          <span>{cambio.motivoReprogramacion}</span>
                        </div>
                      )}
                      {cambio.usuario && (
                        <div className="text-xs text-muted-foreground pt-1 border-t">
                          Modificado por: {cambio.usuario}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reprogramar Modal - Usa los mismos controles que el modal de creación */}
      <Dialog open={reprogramarModalOpen} onOpenChange={setReprogramarModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Reprogramar Audiencia
            </DialogTitle>
          </DialogHeader>
          {selectedAudiencia && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning">Atención - Trazabilidad</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta acción quedará registrada en el historial. El juez será notificado del cambio.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-sm text-muted-foreground">Audiencia actual</p>
                <p className="font-medium">{selectedAudiencia.numeroExpediente || `Causa ${selectedAudiencia.causaId}`}</p>
                <p className="text-sm">
                  {format(getFechaAudiencia(selectedAudiencia), "EEEE dd 'de' MMMM 'de' yyyy", { locale: es })} a las {getHoraAudiencia(selectedAudiencia)}
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nueva Fecha *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {nuevaFechaReprogramar ? format(nuevaFechaReprogramar, "dd/MM/yyyy") : "Seleccionar..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={nuevaFechaReprogramar}
                          onSelect={setNuevaFechaReprogramar}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Nueva Hora *</Label>
                    <Input
                      type="time"
                      value={nuevaHoraReprogramar}
                      onChange={(e) => setNuevaHoraReprogramar(e.target.value)}
                      min="07:00"
                      max="23:00"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Horario: 7:00 AM - 11:00 PM</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Motivo de Reprogramación * (mínimo 10 caracteres)</Label>
                  <Textarea
                    value={motivoReprogramar}
                    onChange={(e) => setMotivoReprogramar(e.target.value)}
                    placeholder="Explique el motivo de la reprogramación..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {motivoReprogramar.length}/10 caracteres mínimos
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReprogramarModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleReprogramarAudiencia}
                  disabled={submitting || !nuevaFechaReprogramar || !nuevaHoraReprogramar || motivoReprogramar.length < 10}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Reprogramando...
                    </>
                  ) : (
                    "Confirmar Reprogramación"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FuncionariosLayout>
  );
};

export default AgendaAudiencias;
