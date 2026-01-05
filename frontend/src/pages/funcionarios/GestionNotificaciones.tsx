import { useState, useMemo } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Mail,
  FileText,
  Building,
  Search,
  Filter,
} from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { getNotificaciones, getCausas, Notificacion } from "@/lib/funcionarios-data";

const GestionNotificaciones = () => {
  const { toast } = useToast();
  const [notificaciones] = useState<Notificacion[]>(generateMockNotificaciones(25));
  const [causas] = useState(generateMockCausas(10));
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterMedio, setFilterMedio] = useState<string>("todos");

  // Form state
  const [selectedCausa, setSelectedCausa] = useState("");
  const [tipoNotificacion, setTipoNotificacion] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [medio, setMedio] = useState("");
  const [fechaEnvio, setFechaEnvio] = useState<Date>();

  // Calculate stats
  const stats = useMemo(() => {
    const hoy = new Date();
    const pendientes = notificaciones.filter((n) => n.estado === "pendiente").length;
    const enviadas = notificaciones.filter((n) => n.estado === "enviada").length;
    const vencidas = notificaciones.filter((n) => n.estado === "vencida" || isPast(new Date(n.fechaLimite))).length;
    const proximasVencer = notificaciones.filter((n) => {
      const diasRestantes = differenceInDays(new Date(n.fechaLimite), hoy);
      return diasRestantes >= 0 && diasRestantes <= 3 && n.estado !== "vencida";
    }).length;
    return { pendientes, enviadas, vencidas, proximasVencer };
  }, [notificaciones]);

  const getEstadoBadge = (notif: Notificacion) => {
    const diasRestantes = differenceInDays(new Date(notif.fechaLimite), new Date());
    
    if (notif.estado === "vencida" || (isPast(new Date(notif.fechaLimite)) && notif.estado !== "recibida")) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Vencida
        </Badge>
      );
    }
    if (notif.estado === "recibida") {
      return (
        <Badge className="bg-success text-success-foreground flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Recibida
        </Badge>
      );
    }
    if (diasRestantes <= 3 && diasRestantes >= 0) {
      return (
        <Badge className="bg-warning text-warning-foreground flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Por vencer ({diasRestantes}d)
        </Badge>
      );
    }
    if (notif.estado === "enviada") {
      return (
        <Badge className="bg-info text-info-foreground">
          Enviada
        </Badge>
      );
    }
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const getMedioBadge = (medio: Notificacion["medio"]) => {
    switch (medio) {
      case "electronico":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            Electrónico
          </Badge>
        );
      case "fisico":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Físico
          </Badge>
        );
      case "judicial":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Building className="w-3 h-3" />
            Judicial
          </Badge>
        );
    }
  };

  const getTipoBadge = (tipo: Notificacion["tipo"]) => {
    switch (tipo) {
      case "citacion":
        return <Badge className="bg-primary/20 text-primary">Citación</Badge>;
      case "notificacion":
        return <Badge className="bg-info/20 text-info">Notificación</Badge>;
      case "emplazamiento":
        return <Badge className="bg-warning/20 text-warning">Emplazamiento</Badge>;
      case "recordatorio":
        return <Badge className="bg-secondary">Recordatorio</Badge>;
    }
  };

  const handleCrearNotificacion = () => {
    if (!selectedCausa || !tipoNotificacion || !destinatario || !medio || !fechaEnvio) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete todos los campos.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Notificación registrada",
      description: `La ${tipoNotificacion} ha sido registrada para envío.`,
    });

    setCreateModalOpen(false);
    setSelectedCausa("");
    setTipoNotificacion("");
    setDestinatario("");
    setMedio("");
    setFechaEnvio(undefined);
  };

  const filteredNotificaciones = notificaciones.filter((notif) => {
    const matchesSearch = notif.destinatario.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEstado = filterEstado === "todos" || notif.estado === filterEstado;
    const matchesMedio = filterMedio === "todos" || notif.medio === filterMedio;
    return matchesSearch && matchesEstado && matchesMedio;
  });

  // Sort by urgency (vencidas first, then por vencer, then rest)
  const sortedNotificaciones = [...filteredNotificaciones].sort((a, b) => {
    const diasA = differenceInDays(new Date(a.fechaLimite), new Date());
    const diasB = differenceInDays(new Date(b.fechaLimite), new Date());
    return diasA - diasB;
  });

  return (
    <FuncionariosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">Notificaciones y Plazos</h1>
            <p className="text-muted-foreground">Gestión de notificaciones y control de plazos procesales</p>
          </div>
          <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Notificación
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Notificación</DialogTitle>
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
                          {causa.numeroExpediente}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={tipoNotificacion} onValueChange={setTipoNotificacion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="citacion">Citación</SelectItem>
                      <SelectItem value="notificacion">Notificación</SelectItem>
                      <SelectItem value="emplazamiento">Emplazamiento</SelectItem>
                      <SelectItem value="recordatorio">Recordatorio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Destinatario *</Label>
                  <Input
                    placeholder="Nombre del destinatario"
                    value={destinatario}
                    onChange={(e) => setDestinatario(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Medio de Notificación *</Label>
                  <Select value={medio} onValueChange={setMedio}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar medio..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronico">
                        <span className="flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Electrónico
                        </span>
                      </SelectItem>
                      <SelectItem value="fisico">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Físico
                        </span>
                      </SelectItem>
                      <SelectItem value="judicial">
                        <span className="flex items-center gap-2">
                          <Building className="w-4 h-4" /> Judicial
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Envío *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaEnvio ? format(fechaEnvio, "dd/MM/yyyy") : "Seleccionar fecha..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaEnvio}
                        onSelect={setFechaEnvio}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCrearNotificacion}>
                  Registrar Notificación
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats - Tablero de Plazos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Clock className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.pendientes}</div>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/20">
                  <Bell className="w-5 h-5 text-info" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-info">{stats.enviadas}</div>
                  <p className="text-sm text-muted-foreground">Enviadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.proximasVencer > 0 ? "border-warning" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{stats.proximasVencer}</div>
                  <p className="text-sm text-muted-foreground">Por Vencer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.vencidas > 0 ? "border-destructive" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-destructive">{stats.vencidas}</div>
                  <p className="text-sm text-muted-foreground">Vencidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas urgentes */}
        {(stats.vencidas > 0 || stats.proximasVencer > 0) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
                <div>
                  <p className="font-semibold text-warning">Atención: Plazos Críticos</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.vencidas > 0 && `${stats.vencidas} notificación(es) vencida(s). `}
                    {stats.proximasVencer > 0 && `${stats.proximasVencer} notificación(es) próxima(s) a vencer.`}
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
              placeholder="Buscar por destinatario..."
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
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="recibida">Recibida</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterMedio} onValueChange={setFilterMedio}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Medio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="electronico">Electrónico</SelectItem>
              <SelectItem value="fisico">Físico</SelectItem>
              <SelectItem value="judicial">Judicial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notificaciones Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Notificaciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Tipo</th>
                    <th className="text-left p-4 font-medium">Destinatario</th>
                    <th className="text-left p-4 font-medium">Medio</th>
                    <th className="text-left p-4 font-medium">Fecha Envío</th>
                    <th className="text-left p-4 font-medium">Fecha Límite</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedNotificaciones.map((notif) => (
                    <tr key={notif.id} className="border-b hover:bg-muted/30">
                      <td className="p-4">{getTipoBadge(notif.tipo)}</td>
                      <td className="p-4 font-medium">{notif.destinatario}</td>
                      <td className="p-4">{getMedioBadge(notif.medio)}</td>
                      <td className="p-4 text-sm">
                        {format(new Date(notif.fechaEnvio), "dd/MM/yyyy", { locale: es })}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(notif.fechaLimite), "dd/MM/yyyy", { locale: es })}
                        </div>
                      </td>
                      <td className="p-4">{getEstadoBadge(notif)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </FuncionariosLayout>
  );
};

export default GestionNotificaciones;
