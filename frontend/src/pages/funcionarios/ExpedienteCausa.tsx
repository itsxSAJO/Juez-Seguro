import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getCausaById, getDocumentos, Causa, Documento } from "@/lib/funcionarios-data";
import { audienciasService, AudienciaConHistorial } from "@/services/audiencias.service";
import { causasService, HistorialReprogramacion } from "@/services/causas.service";
import { notificacionesProcesalesService, NotificacionProcesal } from "@/services/notificaciones-procesales.service";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Clock,
  User,
  Scale,
  Search,
  Filter,
  Download,
  Eye,
  Gavel,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSignature,
  Bell,
  Upload,
  Plus,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Actuacion {
  id: string;
  tipo: "escrito" | "providencia" | "auto" | "sentencia" | "audiencia" | "notificacion" | "reprogramacion" | "notificacion_procesal";
  titulo: string;
  fecha: string;
  descripcion: string;
  autor: string;
  documentoId?: string;
}

const ExpedienteCausa = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [causa, setCausa] = useState<Causa | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [audiencias, setAudiencias] = useState<AudienciaConHistorial[]>([]);
  const [historialReprogramaciones, setHistorialReprogramaciones] = useState<HistorialReprogramacion[]>([]);
  const [notificacionesProcesales, setNotificacionesProcesales] = useState<NotificacionProcesal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchActuacion, setSearchActuacion] = useState("");
  const [filtroTipoActuacion, setFiltroTipoActuacion] = useState<string>("todos");
  
  // Estado para el diálogo de subir documento
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Cargar datos en paralelo con manejo de errores individual
        const [causaResult, docsResult, audResult, historialResult, notifProcResult] = await Promise.allSettled([
          getCausaById(id),
          getDocumentos(id),
          audienciasService.getAudiencias({ causaId: id }),
          causasService.getHistorialReprogramaciones(id),
          notificacionesProcesalesService.listarPorCausa(parseInt(id)),
        ]);
        
        // Procesar resultado de causa
        if (causaResult.status === 'fulfilled' && causaResult.value) {
          setCausa(causaResult.value);
        } else {
          console.error("Error cargando causa:", causaResult.status === 'rejected' ? causaResult.reason : 'No data');
        }
        
        // Procesar resultado de documentos (puede estar vacío)
        if (docsResult.status === 'fulfilled' && docsResult.value) {
          setDocumentos(docsResult.value);
        } else {
          console.warn("No se pudieron cargar documentos:", docsResult.status === 'rejected' ? docsResult.reason : 'No data');
          setDocumentos([]); // Establecer array vacío en lugar de fallar
        }
        
        // Procesar resultado de audiencias
        if (audResult.status === 'fulfilled' && audResult.value) {
          // El servicio ya filtra por causaId, solo tomamos los datos
          setAudiencias(audResult.value.data || []);
        } else {
          console.warn("No se pudieron cargar audiencias:", audResult.status === 'rejected' ? audResult.reason : 'No data');
          setAudiencias([]);
        }

        // Procesar resultado de historial de reprogramaciones
        if (historialResult.status === 'fulfilled' && historialResult.value) {
          setHistorialReprogramaciones(historialResult.value);
        } else {
          console.warn("No se pudieron cargar reprogramaciones:", historialResult.status === 'rejected' ? historialResult.reason : 'No data');
          setHistorialReprogramaciones([]);
        }

        // HU-SJ-004: Procesar resultado de notificaciones procesales
        if (notifProcResult.status === 'fulfilled' && notifProcResult.value) {
          setNotificacionesProcesales(notifProcResult.value);
        } else {
          console.warn("No se pudieron cargar notificaciones procesales:", notifProcResult.status === 'rejected' ? notifProcResult.reason : 'No data');
          setNotificacionesProcesales([]);
        }
      } catch (error) {
        console.error("Error general cargando datos:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id]);

  // Generate timeline actuaciones from documents, audiencias, and reprogramaciones
  // Ordenamos por fecha de creación/modificación del registro, no por fecha del evento
  const actuaciones: Actuacion[] = [
    ...documentos.map((doc) => ({
      id: doc.id,
      tipo: doc.tipo as Actuacion["tipo"],
      titulo: doc.nombre,
      fecha: doc.fechaSubida, // Fecha de subida del documento
      descripcion: `Documento ${doc.tipo} subido al expediente`,
      autor: doc.subidoPor,
      documentoId: doc.id,
    })),
    ...audiencias.map((aud) => {
      // Para la línea del tiempo, usamos fecha de creación (cuándo se programó)
      // No la fecha programada de la audiencia
      const fechaCreacion = aud.fechaCreacion || aud.fecha_creacion || new Date().toISOString();
      const fechaProgramada = aud.fechaHora || aud.fecha_hora || aud.fecha || new Date().toISOString();
      const tipoCapitalizado = aud.tipo ? aud.tipo.charAt(0).toUpperCase() + aud.tipo.slice(1) : 'Audiencia';
      const fechaFormateada = format(new Date(fechaProgramada), "dd/MM/yyyy HH:mm", { locale: es });
      return {
        id: aud.id,
        tipo: "audiencia" as const,
        titulo: `Audiencia de ${tipoCapitalizado} programada`,
        fecha: fechaCreacion, // Usamos fecha de creación para el ordenamiento
        descripcion: `Programada para ${fechaFormateada} - ${aud.sala || 'Sin sala asignada'}${aud.modalidad ? ` (${aud.modalidad})` : ''}`,
        autor: "Sistema",
      };
    }),
    // HU-SJ-003: Agregar reprogramaciones a la línea del tiempo
    ...historialReprogramaciones.map((rep) => {
      const tipoAudiencia = rep.tipoAudiencia ? rep.tipoAudiencia.charAt(0).toUpperCase() + rep.tipoAudiencia.slice(1).toLowerCase() : 'Audiencia';
      const fechaAnterior = rep.fechaHoraAnterior ? format(new Date(rep.fechaHoraAnterior), "dd/MM/yyyy HH:mm", { locale: es }) : '';
      const fechaNueva = rep.fechaHoraNueva ? format(new Date(rep.fechaHoraNueva), "dd/MM/yyyy HH:mm", { locale: es }) : '';
      return {
        id: `rep-${rep.historialId}`,
        tipo: "reprogramacion" as const,
        titulo: `🔄 Audiencia de ${tipoAudiencia} reprogramada`,
        fecha: rep.fechaModificacion, // Fecha de cuando se reprogramó
        descripcion: `De: ${fechaAnterior} → A: ${fechaNueva}. Motivo: ${rep.motivoReprogramacion?.split('\n')[0] || 'Sin motivo especificado'}`,
        autor: "Secretario",
      };
    }),
    // HU-SJ-004: Agregar notificaciones procesales a la línea del tiempo
    ...notificacionesProcesales.map((notif) => {
      const estadoBadge = notif.estado === 'ENTREGADA' ? '✅' : 
                          notif.estado === 'ENVIADA' ? '📨' : 
                          notif.estado === 'FALLIDA' ? '❌' : '⏳';
      return {
        id: `notif-proc-${notif.notificacionId}`,
        tipo: "notificacion_procesal" as const,
        titulo: `${estadoBadge} Notificación: ${notif.tipoNotificacion}`,
        fecha: notif.fechaCreacion,
        descripcion: `${notif.asunto} - Destinatario: ${notif.destinatarioNombre} (${notif.destinatarioTipo}) - Estado: ${notif.estado}`,
        autor: notif.creadoPorNombre || "Secretario",
      };
    }),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const filteredActuaciones = actuaciones.filter((act) => {
    const matchesSearch =
      act.titulo.toLowerCase().includes(searchActuacion.toLowerCase()) ||
      act.descripcion.toLowerCase().includes(searchActuacion.toLowerCase());
    const matchesTipo = filtroTipoActuacion === "todos" || act.tipo === filtroTipoActuacion;
    return matchesSearch && matchesTipo;
  });

  // Función para manejar la subida de documentos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar que sea PDF
      if (file.type !== "application/pdf") {
        alert("Solo se permiten archivos PDF");
        return;
      }
      // Validar tamaño (50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert("El archivo no debe exceder 50MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !tipoDocumento || !id) {
      alert("Por favor complete todos los campos");
      return;
    }

    setUploading(true);
    try {
      // Convertir archivo a Base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      
      reader.onload = async () => {
        try {
          const base64 = reader.result?.toString().split(",")[1];
          if (!base64) {
            throw new Error("Error al leer el archivo");
          }

          // Obtener token del contexto o sessionStorage
          const authToken = user ? sessionStorage.getItem("auth_token") : null;
          
          if (!authToken) {
            throw new Error("No hay sesión activa. Por favor inicie sesión nuevamente.");
          }

          const payload = {
            causaId: id,
            tipo: tipoDocumento,
            nombreOriginal: selectedFile.name,
            contenido: base64,
          };

          console.log("📤 Enviando documento:", {
            causaId: payload.causaId,
            tipo: payload.tipo,
            nombreOriginal: payload.nombreOriginal,
            contenidoLength: payload.contenido.length,
          });

          // Enviar al backend
          const response = await fetch("http://localhost:3000/api/documentos", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const error = await response.json();
            console.error("❌ Error del servidor:", error);
            throw new Error(error.error || error.details?.[0]?.message || "Error al subir el documento");
          }

          const result = await response.json();
          console.log("✅ Documento subido:", result);
          
          // Actualizar lista de documentos
          const updatedDocs = await getDocumentos(id);
          setDocumentos(updatedDocs);

          // Cerrar diálogo y limpiar
          setDialogOpen(false);
          setSelectedFile(null);
          setTipoDocumento("");
          
          alert("Documento subido exitosamente");
        } catch (error) {
          console.error("Error uploading document:", error);
          alert(error instanceof Error ? error.message : "Error al subir el documento");
          setUploading(false);
        }
      };

      reader.onerror = () => {
        alert("Error al leer el archivo");
        setUploading(false);
      };
    } catch (error) {
      console.error("Error uploading document:", error);
      alert(error instanceof Error ? error.message : "Error al subir el documento");
      setUploading(false);
    }
  };

  // Función para ver un documento en una nueva pestaña
  const handleVerDocumento = async (docId: string) => {
    try {
      const token = sessionStorage.getItem("auth_token");
      const response = await fetch(`http://localhost:3000/api/documentos/${docId}/ver`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al obtener el documento");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Limpiar URL después de un tiempo
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error("Error al ver documento:", error);
      alert("No se pudo abrir el documento");
    }
  };

  // Función para descargar un documento
  const handleDescargarDocumento = async (docId: string, nombreArchivo: string) => {
    try {
      const token = sessionStorage.getItem("auth_token");
      const response = await fetch(`http://localhost:3000/api/documentos/${docId}/descargar`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al descargar el documento");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Crear enlace temporal para descargar
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Limpiar URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar documento:", error);
      alert("No se pudo descargar el documento");
    }
  };

  const getActuacionIcon = (tipo: Actuacion["tipo"]) => {
    switch (tipo) {
      case "escrito":
        return <FileText className="w-4 h-4" />;
      case "providencia":
        return <Gavel className="w-4 h-4" />;
      case "auto":
        return <FileSignature className="w-4 h-4" />;
      case "sentencia":
        return <Scale className="w-4 h-4" />;
      case "audiencia":
        return <Calendar className="w-4 h-4" />;
      case "notificacion":
        return <Bell className="w-4 h-4" />;
      case "notificacion_procesal":
        return <Bell className="w-4 h-4" />;
      case "reprogramacion":
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getActuacionColor = (tipo: Actuacion["tipo"]) => {
    switch (tipo) {
      case "escrito":
        return "bg-info/20 text-info border-info/30";
      case "providencia":
        return "bg-primary/20 text-primary border-primary/30";
      case "auto":
        return "bg-accent/20 text-accent-foreground border-accent/30";
      case "sentencia":
        return "bg-success/20 text-success border-success/30";
      case "audiencia":
        return "bg-warning/20 text-warning border-warning/30";
      case "notificacion":
        return "bg-secondary/20 text-secondary-foreground border-secondary/30";
      case "notificacion_procesal":
        return "bg-purple-500/20 text-purple-600 border-purple-500/30";
      case "reprogramacion":
        return "bg-orange-500/20 text-orange-600 border-orange-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getEstadoBadge = (estado: Causa["estado"]) => {
    switch (estado) {
      case "en_tramite":
        return <Badge className="bg-info text-info-foreground">En Trámite</Badge>;
      case "resuelto":
        return <Badge className="bg-success text-success-foreground">Resuelto</Badge>;
      case "archivado":
        return <Badge variant="secondary">Archivado</Badge>;
      case "suspendido":
        return <Badge className="bg-warning text-warning-foreground">Suspendido</Badge>;
    }
  };

  if (loading) {
    return (
      <FuncionariosLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </FuncionariosLayout>
    );
  }

  if (!causa) {
    return (
      <FuncionariosLayout>
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Causa no encontrada</h2>
          <p className="text-muted-foreground mb-4">No se encontró la causa solicitada.</p>
          <Button onClick={() => navigate("/funcionarios/causas")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Mis Causas
          </Button>
        </div>
      </FuncionariosLayout>
    );
  }

  return (
    <FuncionariosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/funcionarios/causas")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-heading font-bold">{causa.numeroExpediente}</h1>
              <p className="text-muted-foreground">Expediente Electrónico</p>
            </div>
          </div>
          {getEstadoBadge(causa.estado)}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Scale className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Materia</p>
                  <p className="font-medium">{causa.materia}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <FileText className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Acción</p>
                  <p className="font-medium">{causa.tipoAccion}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Clock className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado Procesal</p>
                  <p className="font-medium">{causa.estadoProcesal}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Calendar className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Ingreso</p>
                  <p className="font-medium">{format(new Date(causa.fechaIngreso), "dd MMM yyyy", { locale: es })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Partes Procesales y Funcionarios */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Partes Procesales y Funcionarios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Partes procesales - Información pública (nombres reales) */}
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-3 font-semibold tracking-wider">
                Partes del Proceso (Información Pública)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground mb-1">Actor / Demandante</p>
                  <p className="font-medium">{causa.actorNombre}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground mb-1">Demandado / Procesado</p>
                  <p className="font-medium">{causa.demandadoNombre}</p>
                </div>
              </div>
            </div>
            
            {/* Funcionarios judiciales - Pseudonimizados */}
            <div className="pt-4 border-t">
              <p className="text-xs uppercase text-muted-foreground mb-3 font-semibold tracking-wider">
                Funcionarios Judiciales (Identidad Protegida)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Juez Asignado (Pseudónimo)</p>
                  <p className="font-medium">{causa.juezAsignadoNombre}</p>
                </div>
                <div className="p-4 rounded-lg bg-info/5 border border-info/20">
                  <p className="text-sm text-muted-foreground mb-1">Registrado por (Pseudónimo)</p>
                  <p className="font-medium">{causa.secretarioPseudonimo || "Secretario Judicial"}</p>
                </div>
              </div>
            </div>

            {/* Descripción del caso */}
            {causa.descripcion && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Descripción del Caso</p>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <p className="text-sm">{causa.descripcion}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs: Timeline y Documentos */}
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="timeline">Línea de Tiempo</TabsTrigger>
            <TabsTrigger value="documentos">Documentos ({documentos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4 space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en actuaciones..."
                  value={searchActuacion}
                  onChange={(e) => setSearchActuacion(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filtroTipoActuacion} onValueChange={setFiltroTipoActuacion}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tipo de actuación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="escrito">Escritos</SelectItem>
                  <SelectItem value="providencia">Providencias</SelectItem>
                  <SelectItem value="auto">Autos</SelectItem>
                  <SelectItem value="sentencia">Sentencias</SelectItem>
                  <SelectItem value="audiencia">Audiencias</SelectItem>
                  <SelectItem value="reprogramacion">Reprogramaciones</SelectItem>
                  <SelectItem value="notificacion">Notificaciones Internas</SelectItem>
                  <SelectItem value="notificacion_procesal">Notificaciones Procesales</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {filteredActuaciones.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No se encontraron actuaciones</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredActuaciones.map((act, index) => (
                    <div key={act.id} className="relative pl-14">
                      <div
                        className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${getActuacionColor(act.tipo)}`}
                      >
                        {getActuacionIcon(act.tipo)}
                      </div>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={getActuacionColor(act.tipo)}>
                                  {act.tipo.charAt(0).toUpperCase() + act.tipo.slice(1)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(act.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                                </span>
                              </div>
                              <h4 className="font-medium">{act.titulo}</h4>
                              <p className="text-sm text-muted-foreground">{act.descripcion}</p>
                              <p className="text-xs text-muted-foreground mt-1">Por: {act.autor}</p>
                            </div>
                            {act.documentoId && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleVerDocumento(act.documentoId!)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Documentos del Expediente</CardTitle>
                {user?.rol === "SECRETARIO" && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="w-4 h-4 mr-2" />
                        Subir Documento
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Subir Documento al Expediente</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="tipo">Tipo de Documento *</Label>
                          <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione el tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="demanda">Demanda</SelectItem>
                              <SelectItem value="contestacion">Contestación</SelectItem>
                              <SelectItem value="prueba">Prueba</SelectItem>
                              <SelectItem value="sentencia">Sentencia</SelectItem>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="providencia">Providencia</SelectItem>
                              <SelectItem value="otro">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="file">Archivo PDF *</Label>
                          <Input
                            id="file"
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            disabled={uploading}
                          />
                          {selectedFile && (
                            <p className="text-sm text-muted-foreground">
                              Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          )}
                        </div>

                        <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                          <p className="text-sm text-info">
                            <strong>Validaciones de seguridad:</strong>
                          </p>
                          <ul className="text-sm text-info/80 mt-1 space-y-1 list-disc list-inside">
                            <li>Solo archivos PDF permitidos</li>
                            <li>Tamaño máximo: 50MB</li>
                            <li>Verificación de integridad con SHA-256</li>
                          </ul>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setDialogOpen(false);
                              setSelectedFile(null);
                              setTipoDocumento("");
                            }}
                            disabled={uploading}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleUploadDocument}
                            disabled={uploading || !selectedFile || !tipoDocumento}
                          >
                            {uploading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Subiendo...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Subir
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {documentos.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No hay documentos en este expediente</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-4 font-medium">Documento</th>
                          <th className="text-left p-4 font-medium">Tipo</th>
                          <th className="text-left p-4 font-medium">Subido por</th>
                          <th className="text-left p-4 font-medium">Fecha</th>
                          <th className="text-left p-4 font-medium">Estado</th>
                          <th className="text-left p-4 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentos.map((doc) => (
                          <tr key={doc.id} className="border-b hover:bg-muted/30">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-destructive" />
                                <div>
                                  <span className="font-medium block">{doc.nombre}</span>
                                  {doc.tamano && (
                                    <span className="text-xs text-muted-foreground">
                                      {typeof doc.tamano === 'number' 
                                        ? `${Math.round(doc.tamano / 1024)} KB`
                                        : doc.tamano}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className="capitalize">{doc.tipo}</Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm">{doc.subidoPorNombre || doc.subidoPor || "Secretario"}</span>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {doc.fechaSubida ? format(new Date(doc.fechaSubida), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}
                            </td>
                            <td className="p-4">
                              {doc.estado === "firmado" ? (
                                <Badge className="bg-success text-success-foreground">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Firmado
                                </Badge>
                              ) : doc.estado === "pendiente" ? (
                                <Badge className="bg-warning text-warning-foreground">Pendiente</Badge>
                              ) : doc.estado === "borrador" ? (
                                <Badge variant="secondary">Borrador</Badge>
                              ) : (
                                <Badge className="bg-info text-info-foreground">Notificado</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="Ver documento"
                                  onClick={() => handleVerDocumento(doc.id)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="Descargar"
                                  onClick={() => handleDescargarDocumento(doc.id, doc.nombre)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </FuncionariosLayout>
  );
};

export default ExpedienteCausa;
