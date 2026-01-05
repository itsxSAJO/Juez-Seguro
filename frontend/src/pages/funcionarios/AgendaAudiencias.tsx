import { useState, useMemo } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  History,
  AlertTriangle,
  Video,
  Building,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { getAudiencias, getCausas, Audiencia, generateMockAudiencias_compat as generateMockAudiencias, generateMockCausas_compat as generateMockCausas } from "@/lib/funcionarios-data";

const AgendaAudiencias = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [audiencias] = useState<Audiencia[]>(generateMockAudiencias(30));
  const [causas] = useState(generateMockCausas(10));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAudiencia, setSelectedAudiencia] = useState<Audiencia | null>(null);
  const [historialModalOpen, setHistorialModalOpen] = useState(false);

  // Form state
  const [selectedCausa, setSelectedCausa] = useState("");
  const [tipoAudiencia, setTipoAudiencia] = useState("");
  const [fechaAudiencia, setFechaAudiencia] = useState<Date>();
  const [horaAudiencia, setHoraAudiencia] = useState("");
  const [salaAudiencia, setSalaAudiencia] = useState("");

  const salas = ["Sala 1A", "Sala 2B", "Sala 3C", "Sala Virtual 1", "Sala Virtual 2"];
  const horas = Array.from({ length: 10 }, (_, i) => `${8 + i}:00`);

  // Calendar days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get audiencias for a specific day
  const getAudienciasForDay = (date: Date) => {
    return audiencias.filter((aud) => isSameDay(parseISO(aud.fecha), date));
  };

  // Audiencias for selected date
  const audienciasDelDia = selectedDate ? getAudienciasForDay(selectedDate) : [];

  // Audiencias con cambios recientes (reprogramadas)
  const audienciasReprogramadas = audiencias.filter(
    (aud) => aud.estado === "reprogramada" || aud.historialCambios.length > 0
  );

  const getEstadoBadge = (estado: Audiencia["estado"]) => {
    switch (estado) {
      case "programada":
        return <Badge className="bg-info text-info-foreground">Programada</Badge>;
      case "realizada":
        return <Badge className="bg-success text-success-foreground">Realizada</Badge>;
      case "reprogramada":
        return <Badge className="bg-warning text-warning-foreground"><History className="w-3 h-3 mr-1" />Reprogramada</Badge>;
      case "cancelada":
        return <Badge variant="destructive">Cancelada</Badge>;
    }
  };

  const getTipoBadge = (tipo: Audiencia["tipo"]) => {
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
    }
  };

  const handleScheduleAudiencia = () => {
    if (!selectedCausa || !tipoAudiencia || !fechaAudiencia || !horaAudiencia || !salaAudiencia) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete todos los campos.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Audiencia programada",
      description: `Audiencia de ${tipoAudiencia} programada para el ${format(fechaAudiencia, "dd/MM/yyyy")} a las ${horaAudiencia}.`,
    });

    setScheduleModalOpen(false);
    setSelectedCausa("");
    setTipoAudiencia("");
    setFechaAudiencia(undefined);
    setHoraAudiencia("");
    setSalaAudiencia("");
  };

  const openAudienciaDetail = (audiencia: Audiencia) => {
    setSelectedAudiencia(audiencia);
    setDetailModalOpen(true);
  };

  const openHistorial = (audiencia: Audiencia) => {
    setSelectedAudiencia(audiencia);
    setHistorialModalOpen(true);
  };

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
          {user?.cargo === "secretario" && (
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
                        {causas.slice(0, 10).map((causa) => (
                          <SelectItem key={causa.id} value={causa.id}>
                            {causa.numeroExpediente} - {causa.materia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Audiencia *</Label>
                    <Select value={tipoAudiencia} onValueChange={setTipoAudiencia}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inicial">Audiencia Inicial</SelectItem>
                        <SelectItem value="evaluacion">Audiencia de Evaluación</SelectItem>
                        <SelectItem value="juicio">Audiencia de Juicio</SelectItem>
                        <SelectItem value="resolucion">Audiencia de Resolución</SelectItem>
                        <SelectItem value="conciliacion">Audiencia de Conciliación</SelectItem>
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
                      <Select value={horaAudiencia} onValueChange={setHoraAudiencia}>
                        <SelectTrigger>
                          <SelectValue placeholder="Hora..." />
                        </SelectTrigger>
                        <SelectContent>
                          {horas.map((hora) => (
                            <SelectItem key={hora} value={hora}>{hora}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

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
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleScheduleAudiencia}>
                    Programar Audiencia
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Alertas de reprogramaciones */}
        {audienciasReprogramadas.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">
                  {audienciasReprogramadas.length} audiencia(s) han sido reprogramadas recientemente
                </span>
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
                  const hasReprogramada = dayAudiencias.some((a) => a.estado === "reprogramada");

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
                        {getEstadoBadge(audiencia.estado)}
                      </div>
                      <p className="font-medium text-sm mb-1">{audiencia.numeroExpediente}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {audiencia.hora}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {audiencia.sala}
                        </span>
                      </div>
                      {audiencia.historialCambios.length > 0 && (
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
                  </tr>
                </thead>
                <tbody>
                  {audiencias
                    .filter((a) => new Date(a.fecha) >= new Date())
                    .slice(0, 10)
                    .map((audiencia) => (
                      <tr
                        key={audiencia.id}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => openAudienciaDetail(audiencia)}
                      >
                        <td className="p-3 font-medium">{audiencia.numeroExpediente}</td>
                        <td className="p-3">{getTipoBadge(audiencia.tipo)}</td>
                        <td className="p-3 text-sm">
                          {format(parseISO(audiencia.fecha), "dd/MM/yyyy", { locale: es })}
                        </td>
                        <td className="p-3 text-sm">{audiencia.hora}</td>
                        <td className="p-3 text-sm">
                          <span className="flex items-center gap-1">
                            {audiencia.sala.includes("Virtual") ? (
                              <Video className="w-4 h-4 text-info" />
                            ) : (
                              <Building className="w-4 h-4 text-muted-foreground" />
                            )}
                            {audiencia.sala}
                          </span>
                        </td>
                        <td className="p-3">{getEstadoBadge(audiencia.estado)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de Audiencia</DialogTitle>
          </DialogHeader>
          {selectedAudiencia && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getTipoBadge(selectedAudiencia.tipo)}
                {getEstadoBadge(selectedAudiencia.estado)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Expediente</p>
                  <p className="font-medium">{selectedAudiencia.numeroExpediente}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha y Hora</p>
                  <p className="font-medium">
                    {format(parseISO(selectedAudiencia.fecha), "dd/MM/yyyy")} - {selectedAudiencia.hora}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sala</p>
                  <p className="font-medium flex items-center gap-1">
                    {selectedAudiencia.sala.includes("Virtual") ? (
                      <Video className="w-4 h-4 text-info" />
                    ) : (
                      <Building className="w-4 h-4" />
                    )}
                    {selectedAudiencia.sala}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Partes</p>
                  <p className="font-medium">{selectedAudiencia.partes.join(", ")}</p>
                </div>
              </div>
              {selectedAudiencia.notas && (
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm">{selectedAudiencia.notas}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Historial Modal */}
      <Dialog open={historialModalOpen} onOpenChange={setHistorialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de Cambios</DialogTitle>
          </DialogHeader>
          {selectedAudiencia && (
            <div className="space-y-3">
              {selectedAudiencia.historialCambios.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No hay cambios registrados
                </p>
              ) : (
                selectedAudiencia.historialCambios.map((cambio, index) => (
                  <div key={index} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{cambio.usuario}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cambio.fecha), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm">{cambio.cambio}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FuncionariosLayout>
  );
};

export default AgendaAudiencias;
