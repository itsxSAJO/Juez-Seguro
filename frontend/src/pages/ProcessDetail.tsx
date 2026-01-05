import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { JudicialProcess } from "@/components/search/ResultsTable";
import { getProcessById, getActuaciones, Actuacion } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  Gavel,
  User,
  Users,
  Clock,
  Download,
  Printer,
  Shield,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ProcessDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [process, setProcess] = useState<JudicialProcess | null>(null);
  const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const [processData, actuacionesData] = await Promise.all([
          getProcessById(id),
          getActuaciones(id),
        ]);
        setProcess(processData);
        setActuaciones(actuacionesData);
      } catch (error) {
        console.error("Error fetching process data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const getStatusBadge = (estado: JudicialProcess["estado"]) => {
    const config = {
      activo: { className: "badge-active", label: "Activo", icon: Clock },
      archivado: { className: "badge-archived", label: "Archivado", icon: FileText },
      pendiente: { className: "badge-pending", label: "Pendiente", icon: AlertTriangle },
    };
    
    const { className, label, icon: Icon } = config[estado];
    return (
      <Badge variant="outline" className={cn("font-medium text-base px-4 py-2", className)}>
        <Icon className="w-4 h-4 mr-2" aria-hidden="true" />
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded-xl" />
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!process) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-destructive" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-3">
              Proceso no encontrado
            </h1>
            <p className="text-muted-foreground mb-6">
              El proceso judicial solicitado no existe o no está disponible.
            </p>
            <Link to="/">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Volver a búsqueda
              </Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b border-border py-4">
        <div className="container mx-auto px-4">
          <nav aria-label="Navegación de migas de pan">
            <ol className="flex items-center gap-2 text-sm">
              <li>
                <Link 
                  to="/" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Inicio
                </Link>
              </li>
              <li className="text-muted-foreground">/</li>
              <li>
                <Link 
                  to="/" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Búsqueda
                </Link>
              </li>
              <li className="text-muted-foreground">/</li>
              <li className="text-foreground font-medium" aria-current="page">
                {process.numeroExpediente}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <Link to="/" className="inline-flex mb-6">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver a resultados
          </Button>
        </Link>

        {/* Process Header */}
        <div className="card-search p-6 md:p-8 mb-6 animate-fade-in">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Número de Expediente</p>
                  <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground font-mono">
                    {process.numeroExpediente}
                  </h1>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(process.estado)}
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {process.materia}
                </Badge>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {process.tipoAccion}
                </Badge>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Process Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <span>Fecha de Ingreso</span>
              </div>
              <p className="font-medium text-foreground pl-6">{process.fechaIngreso}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Building2 className="w-4 h-4" aria-hidden="true" />
                <span>Dependencia Judicial</span>
              </div>
              <p className="font-medium text-foreground pl-6">{process.dependencia}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Gavel className="w-4 h-4" aria-hidden="true" />
                <span>Juez Asignado</span>
              </div>
              <p className="pl-6">
                <span className="identifier-anonymous">{process.juezAnonimo}</span>
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <User className="w-4 h-4" aria-hidden="true" />
                <span>Actor / Ofendido</span>
              </div>
              <p className="pl-6">
                <span className="identifier-anonymous">{process.actorAnonimo}</span>
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="w-4 h-4" aria-hidden="true" />
                <span>Demandado / Procesado</span>
              </div>
              <p className="pl-6">
                <span className="identifier-anonymous">{process.demandadoAnonimo}</span>
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-info-muted rounded-lg flex items-start gap-3">
            <Shield className="w-5 h-5 text-info shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-info">Información Anonimizada</p>
              <p className="text-sm text-info/80">
                Los identificadores mostrados (Ej: JK-542) son códigos únicos generados por el sistema 
                Juez Seguro para proteger la identidad real de los actores judiciales.
              </p>
            </div>
          </div>
        </div>

        {/* Actuaciones Section */}
        <Tabs defaultValue="actuaciones" className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <TabsList className="w-full max-w-md grid grid-cols-2 mb-6">
            <TabsTrigger value="actuaciones" className="gap-2">
              <FileText className="w-4 h-4" aria-hidden="true" />
              Actuaciones ({actuaciones.length})
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2">
              <Download className="w-4 h-4" aria-hidden="true" />
              Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actuaciones" className="mt-0">
            <div className="card-search divide-y divide-border overflow-hidden">
              {actuaciones.length === 0 ? (
                <div className="p-8 text-center">
                  <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                  <p className="text-muted-foreground">No hay actuaciones registradas</p>
                </div>
              ) : (
                actuaciones.map((actuacion, index) => (
                  <article 
                    key={actuacion.id}
                    className="p-4 md:p-6 hover:bg-muted/30 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex items-center gap-3 md:w-48 shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{actuacion.tipo}</p>
                          <p className="text-xs text-muted-foreground">{actuacion.fecha}</p>
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <p className="text-sm text-muted-foreground">{actuacion.descripcion}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Responsable:</span>
                          <span className="identifier-anonymous text-xs">{actuacion.responsableAnonimo}</span>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm" className="shrink-0">
                        <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
                        Ver
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="mt-0">
            <div className="card-search p-8 text-center">
              <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
              <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
                Documentos del Proceso
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Los documentos adjuntos al proceso están disponibles para descarga. 
                Seleccione una actuación para ver los documentos asociados.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default ProcessDetail;
