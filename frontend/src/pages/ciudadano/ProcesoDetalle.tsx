import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { getProcessById, getActuaciones } from "@/lib/data";
import { consultaCiudadanaService } from "@/services/consulta-ciudadana.service";
import type { Actuacion, ProcesoPublico } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Scale,
  FileText,
  User,
  Shield,
  Clock,
  Download,
  Eye,
} from "lucide-react";

const ProcesoDetalle = () => {
  const { numeroProceso } = useParams<{ numeroProceso: string }>();
  const [process, setProcess] = useState<ProcesoPublico | null>(null);
  const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!numeroProceso) return;
      setIsLoading(true);
      try {
        // Decodificar el número de proceso de la URL
        const decodedNumeroProceso = decodeURIComponent(numeroProceso);
        const [processData, actuacionesData] = await Promise.all([
          getProcessById(decodedNumeroProceso),
          getActuaciones(decodedNumeroProceso),
        ]);
        setProcess(processData);
        setActuaciones(actuacionesData);
      } catch (error) {
        console.error("Error loading process:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [numeroProceso]);

  // Función para ver documento en nueva pestaña
  const handleVerDocumento = (documentoId: string) => {
    consultaCiudadanaService.verDocumento(documentoId);
  };

  // Función para descargar documento
  const handleDescargarDocumento = async (documentoId: string, nombreArchivo: string) => {
    try {
      await consultaCiudadanaService.descargarDocumento(documentoId, nombreArchivo);
    } catch (error) {
      console.error("Error al descargar:", error);
      alert("No se pudo descargar el documento");
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "activo":
        return <Badge className="badge-active">Activo</Badge>;
      case "pendiente":
        return <Badge className="badge-pending">Pendiente</Badge>;
      case "archivado":
        return <Badge className="badge-archived">Archivado</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!process) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-heading font-bold mb-4">Proceso no encontrado</h1>
          <p className="text-muted-foreground mb-6">
            El proceso solicitado no existe o no está disponible.
          </p>
          <Button asChild>
            <Link to="/ciudadano">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a búsqueda
            </Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/ciudadano">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Expediente {process.numeroExpediente}
            </h1>
            <p className="text-muted-foreground">Vista pública del expediente judicial</p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {/* Main Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Información del Proceso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Fecha de Ingreso</p>
                    <p className="text-sm text-muted-foreground">{process.fechaIngreso}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Dependencia</p>
                    <p className="text-sm text-muted-foreground">{process.dependencia}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Scale className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Materia</p>
                    <p className="text-sm text-muted-foreground">{process.materia}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Tipo de Acción</p>
                    <p className="text-sm text-muted-foreground">{process.tipoAccion}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 sm:col-span-2">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Estado</p>
                    <div className="mt-1">{getEstadoBadge(process.estado)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actors Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-success" />
                Actores Anonimizados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" /> Actor/Ofendido
                </p>
                <code className="identifier-anonymous">{process.actorAnonimo}</code>
              </div>
              <div>
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" /> Demandado/Procesado
                </p>
                <code className="identifier-anonymous">{process.demandadoAnonimo}</code>
              </div>
              <div>
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  <Scale className="w-4 h-4" /> Juez Asignado
                </p>
                <code className="identifier-anonymous">{process.juezAnonimo}</code>
              </div>
              <p className="text-xs text-muted-foreground mt-4 p-2 bg-muted rounded">
                Los identificadores protegen la identidad real conforme a la política FDP.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Actuaciones Procesales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actuaciones.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay actuaciones registradas para este proceso.
              </p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-6">
                  {actuaciones.map((act) => (
                    <div key={act.id || `act-${act.fecha}-${act.tipo}`} className="relative pl-10">
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                      <div className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant="outline">{act.tipo}</Badge>
                          <span className="text-xs text-muted-foreground">{act.fecha}</span>
                          <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {act.responsableAnonimo || act.funcionario}
                          </code>
                        </div>
                        <p className="text-sm text-foreground mb-3">{act.descripcion}</p>
                        
                        {/* Botones de Ver y Descargar */}
                        {act.tieneArchivo && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerDocumento(act.id)}
                              className="text-xs"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Ver documento
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDescargarDocumento(act.id, act.descripcion)}
                              className="text-xs"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Descargar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ProcesoDetalle;
