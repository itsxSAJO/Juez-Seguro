// ============================================================================
// JUEZ SEGURO - Centro de Auditoría
// HU-CJ-003: Revisión de registros de actividad
// ============================================================================

import { useState, useMemo, useEffect, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Shield,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { auditoriaService, type FiltrosAuditoriaExtendidos } from "@/services/auditoria.service";

// Tipo local para logs de auditoría
interface LogAuditoriaLocal {
  id: string;
  usuario: string;
  accion: string;
  modulo: string;
  detalle: string;
  ip: string;
  fecha: string;
  resultado: "exito" | "error" | "denegado";
}

const CentroAuditoria = () => {
  const { toast } = useToast();
  
  // Estado de datos
  const [logs, setLogs] = useState<LogAuditoriaLocal[]>([]);
  const [total, setTotal] = useState(0);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [tiposEvento, setTiposEvento] = useState<string[]>([]);
  const [modulos, setModulos] = useState<string[]>([]);
  const [estadisticas, setEstadisticas] = useState({ total: 0, exitosas: 0, errores: 0, denegadas: 0 });
  
  // Estado de UI
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUsuario, setFilterUsuario] = useState<string>("todos");
  const [filterTipoEvento, setFilterTipoEvento] = useState<string>("todos");
  const [filterModulo, setFilterModulo] = useState<string>("todos");
  const [filterResultado, setFilterResultado] = useState<string>("todos");
  const [fechaInicio, setFechaInicio] = useState<Date>(subDays(new Date(), 7));
  const [fechaFin, setFechaFin] = useState<Date>(new Date());
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Función auxiliar para mapear resultado
  const mapearResultado = (tipoEvento: string): "exito" | "error" | "denegado" => {
    if (!tipoEvento) return "exito";
    const tipo = tipoEvento.toLowerCase();
    if (tipo.includes("error") || tipo.includes("fallido")) return "error";
    if (tipo.includes("denegado") || tipo.includes("rechazado") || tipo.includes("acceso_denegado")) return "denegado";
    return "exito";
  };

  // Cargar datos iniciales (catálogos)
  useEffect(() => {
    const loadCatalogos = async () => {
      try {
        const [usuariosRes, tiposRes, modulosRes] = await Promise.all([
          auditoriaService.getUsuariosEnLogs(),
          auditoriaService.getTiposEvento(),
          auditoriaService.getModulos(),
        ]);
        
        // getUsuariosEnLogs devuelve un array de strings (correos)
        setUsuarios(usuariosRes || []);
        setTiposEvento(tiposRes || []);
        setModulos(modulosRes || []);
      } catch (error) {
        console.error("Error cargando catálogos:", error);
      }
    };
    loadCatalogos();
  }, []);

  // Función para cargar logs con filtros
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const filtros: FiltrosAuditoriaExtendidos = {
        page: currentPage,
        pageSize: pageSize,
        fechaDesde: fechaInicio.toISOString(),
        fechaHasta: fechaFin.toISOString(),
      };
      
      if (filterUsuario !== "todos") {
        filtros.usuarioCorreo = filterUsuario;
      }
      if (filterTipoEvento !== "todos") {
        filtros.tipoEvento = filterTipoEvento;
      }
      if (filterModulo !== "todos") {
        filtros.moduloAfectado = filterModulo;
      }
      
      // Cargar logs y estadísticas en paralelo
      const [response, statsResponse] = await Promise.all([
        auditoriaService.getLogs(filtros) as any,
        auditoriaService.getEstadisticasGlobales({
          fechaDesde: fechaInicio.toISOString(),
          fechaHasta: fechaFin.toISOString(),
          usuarioCorreo: filterUsuario !== "todos" ? filterUsuario : undefined,
          tipoEvento: filterTipoEvento !== "todos" ? filterTipoEvento : undefined,
          moduloAfectado: filterModulo !== "todos" ? filterModulo : undefined,
        }),
      ]);
      
      // Mapear datos del backend al formato esperado
      const logsFormateados: LogAuditoriaLocal[] = (response.data || []).map((log: any) => ({
        id: log.log_id?.toString() || "",
        usuario: log.usuario_correo || `ID: ${log.usuario_id || "Sistema"}`,
        accion: log.tipo_evento || "",
        modulo: log.modulo_afectado || "SISTEMA",
        detalle: log.descripcion_evento || "",
        ip: log.ip_origen || "desconocida",
        fecha: log.fecha_evento || "",
        resultado: mapearResultado(log.tipo_evento),
      }));
      
      setLogs(logsFormateados);
      setEstadisticas(statsResponse);
      // El backend devuelve total en el root, no en pagination
      setTotal(response.total || response.pagination?.total || response.data?.length || 0);
    } catch (error) {
      console.error("Error cargando logs:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los logs de auditoría",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, filterUsuario, filterTipoEvento, filterModulo, fechaInicio, fechaFin, toast]);

  // Cargar logs cuando cambien los filtros o la página
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Filtrado local para búsqueda de texto y resultado
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = searchQuery === "" ||
        log.usuario.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.accion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.modulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.detalle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesResultado = filterResultado === "todos" || log.resultado === filterResultado;
      return matchesSearch && matchesResultado;
    });
  }, [logs, searchQuery, filterResultado]);

  // Stats globales (del backend)
  const stats = useMemo(() => {
    return { 
      total: estadisticas.total, 
      exitosas: estadisticas.exitosas, 
      errores: estadisticas.errores, 
      denegadas: estadisticas.denegadas,
      enPagina: filteredLogs.length 
    };
  }, [estadisticas, filteredLogs.length]);

  // Paginación
  const totalPages = Math.ceil(total / pageSize);
  const startRecord = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(currentPage * pageSize, total);

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getResultadoBadge = (resultado: "exito" | "error" | "denegado") => {
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

  const handleExportarCSV = async () => {
    setIsExporting(true);
    try {
      const filtros: FiltrosAuditoriaExtendidos = {
        fechaDesde: fechaInicio.toISOString(),
        fechaHasta: fechaFin.toISOString(),
      };
      
      if (filterUsuario !== "todos") {
        filtros.usuarioCorreo = filterUsuario;
      }
      if (filterTipoEvento !== "todos") {
        filtros.tipoEvento = filterTipoEvento;
      }
      if (filterModulo !== "todos") {
        filtros.moduloAfectado = filterModulo;
      }
      
      const blob = await auditoriaService.exportarLogs(filtros);
      
      // Descargar archivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Exportación completada",
        description: "El archivo CSV se ha descargado correctamente.",
      });
    } catch (error) {
      console.error("Error exportando:", error);
      toast({
        title: "Error",
        description: "No se pudo exportar los logs",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const limpiarFiltros = () => {
    setSearchQuery("");
    setFilterUsuario("todos");
    setFilterTipoEvento("todos");
    setFilterModulo("todos");
    setFilterResultado("todos");
    setFechaInicio(subDays(new Date(), 7));
    setFechaFin(new Date());
    setCurrentPage(1);
  };

  // Generar números de página visibles
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (currentPage > 3) pages.push("...");
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push("...");
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <FuncionariosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" />
              Centro de Auditoría
            </h1>
            <p className="text-muted-foreground">
              Revisión de registros de actividad del sistema (HU-CJ-003)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => loadLogs()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              variant="outline"
              onClick={handleExportarCSV}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4 mr-2" />
              )}
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold">{stats.total.toLocaleString()}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Registros</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-success/20">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-success">{stats.exitosas}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Exitosas (total)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/20">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-destructive">{stats.errores}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Errores (total)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-warning/20">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-warning">{stats.denegadas}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Denegadas (total)</p>
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
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Búsqueda */}
              <div className="space-y-2 sm:col-span-2 lg:col-span-2">
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

              {/* Usuario - Carga correos desde logs de auditoría */}
              <div className="space-y-2">
                <Label>Usuario</Label>
                <Select value={filterUsuario} onValueChange={(v) => { setFilterUsuario(v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los usuarios</SelectItem>
                    {usuarios
                      .filter((correo: string) => correo && correo.trim() !== '')
                      .map((correo: string, index: number) => (
                      <SelectItem 
                        key={`user-${index}`} 
                        value={correo}
                      >
                        {correo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Evento */}
              <div className="space-y-2">
                <Label>Tipo de Evento</Label>
                <Select value={filterTipoEvento} onValueChange={(v) => { setFilterTipoEvento(v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los eventos</SelectItem>
                    {tiposEvento.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Módulo */}
              <div className="space-y-2">
                <Label>Módulo</Label>
                <Select value={filterModulo} onValueChange={(v) => { setFilterModulo(v); setCurrentPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los módulos</SelectItem>
                    {modulos.map((modulo) => (
                      <SelectItem key={modulo} value={modulo}>
                        {modulo}
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
                    <Calendar
                      mode="single"
                      selected={fechaInicio}
                      onSelect={(d) => { if (d) { setFechaInicio(d); setCurrentPage(1); } }}
                    />
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
                    <Calendar
                      mode="single"
                      selected={fechaFin}
                      onSelect={(d) => { if (d) { setFechaFin(d); setCurrentPage(1); } }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Primera fila: Mostrando registros y selector de página */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Mostrando {startRecord}-{endRecord} de {total.toLocaleString()} registros
              </p>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                <Label className="text-xs sm:text-sm hidden sm:inline">Por página:</Label>
                <div className="flex gap-1">
                  {[10, 25, 50, 100].map((size) => (
                    <Button
                      key={size}
                      variant={pageSize === size ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 sm:h-8 sm:px-3 text-xs sm:text-sm"
                      onClick={() => { setPageSize(size); setCurrentPage(1); }}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Segunda fila: Navegación de páginas */}
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 border-t pt-3 sm:pt-4">
              {/* Primera página */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-7 px-2 sm:h-8 sm:px-3"
              >
                <ChevronsLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Primera</span>
              </Button>
              
              {/* Anterior */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2 sm:h-8 sm:px-3"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Ant</span>
              </Button>
              
              {/* Números de página */}
              <div className="flex items-center gap-1">
                {getVisiblePages().map((page, idx) => (
                  typeof page === "number" ? (
                    <Button
                      key={`page-${page}`}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-7 w-7 sm:h-8 sm:w-10 p-0 text-xs sm:text-sm"
                    >
                      {page}
                    </Button>
                  ) : (
                    <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">...</span>
                  )
                ))}
              </div>
              
              {/* Siguiente */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-7 px-2 sm:h-8 sm:px-3"
              >
                <span className="hidden sm:inline mr-1">Sig</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              {/* Última */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-7 px-2 sm:h-8 sm:px-3"
              >
                <span className="hidden sm:inline mr-1">Última</span>
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Tercera fila: Ir a página y página actual */}
            <div className="flex flex-wrap items-center justify-center gap-2 border-t pt-3 sm:pt-4">
              <Label className="text-xs sm:text-sm whitespace-nowrap">Ir a:</Label>
              <Input
                type="number"
                min={1}
                max={totalPages}
                placeholder="#"
                className="w-14 sm:w-20 h-7 sm:h-8 text-xs sm:text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const target = e.target as HTMLInputElement;
                    const page = parseInt(target.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                      target.value = "";
                    }
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 sm:h-8 sm:px-3"
                onClick={(e) => {
                  const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                  if (input && input.value) {
                    const page = parseInt(input.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                      input.value = "";
                    }
                  }
                }}
              >
                Ir
              </Button>
              <span className="text-xs sm:text-sm text-muted-foreground">
                Pág. {currentPage}/{totalPages || 1}
              </span>
            </div>
          </div>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No se encontraron registros con los filtros aplicados
              </div>
            ) : (
              <>
                {/* Vista de tabla para pantallas medianas y grandes */}
                <div className="hidden md:block overflow-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b bg-muted/50">
                        <th className="w-8 p-4"></th>
                        <th className="text-left p-4 font-medium">Fecha/Hora</th>
                        <th className="text-left p-4 font-medium">Usuario</th>
                        <th className="text-left p-4 font-medium">Evento</th>
                        <th className="text-left p-4 font-medium">Módulo</th>
                        <th className="text-left p-4 font-medium">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
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
                                    {log.fecha ? format(new Date(log.fecha), "dd/MM/yyyy HH:mm:ss", { locale: es }) : "-"}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm truncate max-w-[200px]">{log.usuario}</span>
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
                                    <p>{log.detalle || "Sin detalle adicional"}</p>
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

              {/* Vista de tarjetas para móviles */}
              <div className="md:hidden divide-y max-h-[500px] overflow-auto">
                {filteredLogs.map((log) => (
                  <div
                    key={`mobile-${log.id}`}
                    className="p-3 space-y-2 hover:bg-muted/30 cursor-pointer"
                    onClick={() => toggleRowExpanded(log.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {log.fecha ? format(new Date(log.fecha), "dd/MM/yy HH:mm", { locale: es }) : "-"}
                      </div>
                      {getResultadoBadge(log.resultado)}
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm truncate">{log.usuario}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{log.accion}</Badge>
                      <span className="text-xs text-muted-foreground">{log.modulo}</span>
                    </div>
                    {expandedRows.has(log.id) && (
                      <div className="pt-2 mt-2 border-t text-xs space-y-1">
                        <p className="text-muted-foreground">Detalle: {log.detalle || "Sin detalle"}</p>
                        <p className="text-muted-foreground">IP: {log.ip}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </FuncionariosLayout>
  );
};

export default CentroAuditoria;
