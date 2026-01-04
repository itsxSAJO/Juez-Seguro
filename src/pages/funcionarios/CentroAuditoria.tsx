import { useState, useMemo } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Calendar as CalendarIcon,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Clock,
  Activity,
  Filter,
  Globe,
  FileJson,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { generateMockLogs, LogAuditoria, mockFuncionarios } from "@/lib/mockFuncionarios";

const CentroAuditoria = () => {
  const { toast } = useToast();
  const [logs] = useState<LogAuditoria[]>(generateMockLogs(100));
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUsuario, setFilterUsuario] = useState<string>("todos");
  const [filterAccion, setFilterAccion] = useState<string>("todos");
  const [filterResultado, setFilterResultado] = useState<string>("todos");
  const [fechaInicio, setFechaInicio] = useState<Date>(subDays(new Date(), 7));
  const [fechaFin, setFechaFin] = useState<Date>(new Date());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const acciones = [...new Set(logs.map((l) => l.accion))];
  const modulos = [...new Set(logs.map((l) => l.modulo))];

  // Stats
  const stats = useMemo(() => {
    const total = logs.length;
    const exitosas = logs.filter((l) => l.resultado === "exito").length;
    const errores = logs.filter((l) => l.resultado === "error").length;
    const denegadas = logs.filter((l) => l.resultado === "denegado").length;
    return { total, exitosas, errores, denegadas };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logDate = new Date(log.fecha);
      const matchesSearch =
        log.usuario.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.accion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.modulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.detalle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUsuario = filterUsuario === "todos" || log.usuario === filterUsuario;
      const matchesAccion = filterAccion === "todos" || log.accion === filterAccion;
      const matchesResultado = filterResultado === "todos" || log.resultado === filterResultado;
      const matchesFecha = logDate >= fechaInicio && logDate <= fechaFin;
      return matchesSearch && matchesUsuario && matchesAccion && matchesResultado && matchesFecha;
    });
  }, [logs, searchQuery, filterUsuario, filterAccion, filterResultado, fechaInicio, fechaFin]);

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getResultadoBadge = (resultado: LogAuditoria["resultado"]) => {
    switch (resultado) {
      case "exito":
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Éxito
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case "denegado":
        return (
          <Badge className="bg-warning text-warning-foreground">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Denegado
          </Badge>
        );
    }
  };

  const handleExportar = (formato: "pdf" | "csv") => {
    toast({
      title: `Exportando a ${formato.toUpperCase()}`,
      description: `Se están exportando ${filteredLogs.length} registros...`,
    });

    // Simulate export
    setTimeout(() => {
      toast({
        title: "Exportación completada",
        description: `El archivo de auditoría se ha descargado correctamente.`,
      });
    }, 1500);
  };

  const limpiarFiltros = () => {
    setSearchQuery("");
    setFilterUsuario("todos");
    setFilterAccion("todos");
    setFilterResultado("todos");
    setFechaInicio(subDays(new Date(), 7));
    setFechaFin(new Date());
  };

  return (
    <FuncionariosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">Centro de Auditoría</h1>
            <p className="text-muted-foreground">Revisión de registros de actividad del sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleExportar("csv")}>
              <FileJson className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExportar("pdf")}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-sm text-muted-foreground">Total Registros</p>
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
                  <div className="text-2xl font-bold text-success">{stats.exitosas}</div>
                  <p className="text-sm text-muted-foreground">Exitosas</p>
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
                  <div className="text-2xl font-bold text-destructive">{stats.errores}</div>
                  <p className="text-sm text-muted-foreground">Errores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{stats.denegadas}</div>
                  <p className="text-sm text-muted-foreground">Denegadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros Avanzados
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-2 lg:col-span-2">
                <Label>Búsqueda</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar en logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Usuario */}
              <div className="space-y-2">
                <Label>Usuario</Label>
                <Select value={filterUsuario} onValueChange={setFilterUsuario}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los usuarios</SelectItem>
                    {mockFuncionarios.map((f) => (
                      <SelectItem key={f.id} value={f.email}>
                        {f.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Acción */}
              <div className="space-y-2">
                <Label>Acción</Label>
                <Select value={filterAccion} onValueChange={setFilterAccion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas las acciones</SelectItem>
                    {acciones.map((accion) => (
                      <SelectItem key={accion} value={accion}>
                        {accion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resultado */}
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select value={filterResultado} onValueChange={setFilterResultado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="exito">Éxito</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="denegado">Denegado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha Inicio */}
              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(fechaInicio, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fechaInicio} onSelect={(d) => d && setFechaInicio(d)} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Fecha Fin */}
              <div className="space-y-2">
                <Label>Fecha Fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(fechaFin, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fechaFin} onSelect={(d) => d && setFechaFin(d)} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredLogs.length} de {logs.length} registros
          </p>
        </div>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-8 p-4"></th>
                    <th className="text-left p-4 font-medium">Fecha/Hora</th>
                    <th className="text-left p-4 font-medium">Usuario</th>
                    <th className="text-left p-4 font-medium">Acción</th>
                    <th className="text-left p-4 font-medium">Módulo</th>
                    <th className="text-left p-4 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.slice(0, 50).map((log) => (
                    <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                      <>
                        <CollapsibleTrigger asChild>
                          <tr
                            className="border-b hover:bg-muted/30 cursor-pointer"
                            onClick={() => toggleRowExpanded(log.id)}
                          >
                            <td className="p-4">
                              {expandedRows.has(log.id) ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </td>
                            <td className="p-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                {format(new Date(log.fecha), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{log.usuario}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">{log.accion}</Badge>
                            </td>
                            <td className="p-4 text-sm">{log.modulo}</td>
                            <td className="p-4">{getResultadoBadge(log.resultado)}</td>
                          </tr>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr className="bg-muted/20 border-b">
                            <td colSpan={6} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Detalle</p>
                                  <p>{log.detalle}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Información Técnica</p>
                                  <div className="space-y-1">
                                    <p className="flex items-center gap-2">
                                      <Globe className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-mono text-xs">IP: {log.ip}</span>
                                    </p>
                                    <p className="flex items-center gap-2">
                                      <Activity className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-mono text-xs">ID: {log.id}</span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {filteredLogs.length > 50 && (
          <p className="text-center text-sm text-muted-foreground">
            Mostrando los primeros 50 resultados. Use los filtros para refinar la búsqueda.
          </p>
        )}
      </div>
    </FuncionariosLayout>
  );
};

export default CentroAuditoria;
