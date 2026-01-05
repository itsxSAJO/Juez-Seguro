import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { getCausaById, getDocumentos, getAudiencias, Causa, Documento, Audiencia } from "@/lib/funcionarios-data";
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
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Actuacion {
  id: string;
  tipo: "escrito" | "providencia" | "auto" | "sentencia" | "audiencia" | "notificacion";
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
  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchActuacion, setSearchActuacion] = useState("");
  const [filtroTipoActuacion, setFiltroTipoActuacion] = useState<string>("todos");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [causaData, docsData, audData] = await Promise.all([
        getCausaById(id || ""),
        getDocumentos(id),
        getAudiencias(),
      ]);
      setCausa(causaData);
      setDocumentos(docsData);
      setAudiencias(audData.filter((a) => a.causaId === id).slice(0, 5));
      setLoading(false);
    };
    loadData();
  }, [id]);

  // Generate timeline actuaciones from documents and audiencias
  const actuaciones: Actuacion[] = [
    ...documentos.map((doc) => ({
      id: doc.id,
      tipo: doc.tipo as Actuacion["tipo"],
      titulo: doc.nombre,
      fecha: doc.fechaSubida,
      descripcion: `Documento ${doc.tipo} subido al expediente`,
      autor: doc.subidoPor,
      documentoId: doc.id,
    })),
    ...audiencias.map((aud) => ({
      id: aud.id,
      tipo: "audiencia" as const,
      titulo: `Audiencia de ${aud.tipo}`,
      fecha: `${aud.fecha}T${aud.hora}`,
      descripcion: `${aud.tipo.charAt(0).toUpperCase() + aud.tipo.slice(1)} - ${aud.sala}`,
      autor: "Sistema",
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const filteredActuaciones = actuaciones.filter((act) => {
    const matchesSearch =
      act.titulo.toLowerCase().includes(searchActuacion.toLowerCase()) ||
      act.descripcion.toLowerCase().includes(searchActuacion.toLowerCase());
    const matchesTipo = filtroTipoActuacion === "todos" || act.tipo === filtroTipoActuacion;
    return matchesSearch && matchesTipo;
  });

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

        {/* Partes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Partes Procesales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-1">Actor / Ofendido</p>
                <p className="font-medium">{causa.actorPseudonimo}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-1">Demandado / Procesado</p>
                <p className="font-medium">{causa.demandadoPseudonimo}</p>
              </div>
            </div>
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
                  <SelectItem value="notificacion">Notificaciones</SelectItem>
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
                              <Button variant="outline" size="sm">
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
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-4 font-medium">Documento</th>
                        <th className="text-left p-4 font-medium">Tipo</th>
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
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{doc.nombre}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{doc.tipo}</Badge>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {format(new Date(doc.fechaSubida), "dd/MM/yyyy")}
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
                              <Button variant="ghost" size="icon">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </FuncionariosLayout>
  );
};

export default ExpedienteCausa;
