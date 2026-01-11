import { Link } from "react-router-dom";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText, Calendar, Building2, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JudicialProcess {
  id: string;
  numeroExpediente: string;
  fechaIngreso: string;
  dependencia: string;
  materia: string;
  tipoAccion: string;
  estado: string; // Puede ser: activo, archivado, pendiente, INICIADA, EN_TRAMITE, etc.
  actorAnonimo: string;
  demandadoAnonimo: string;
  juezAnonimo: string;
}

interface ResultsTableProps {
  results: JudicialProcess[];
  isLoading?: boolean;
}

export const ResultsTable = ({ results, isLoading = false }: ResultsTableProps) => {
  const getStatusBadge = (estado: string) => {
    // Normalizar estado del backend a formato de display
    const estadoNormalizado = estado?.toLowerCase() || "pendiente";
    
    const config: Record<string, { className: string; label: string }> = {
      // Estados del frontend mock
      activo: { className: "badge-active", label: "Activo" },
      archivado: { className: "badge-archived", label: "Archivado" },
      pendiente: { className: "badge-pending", label: "Pendiente" },
      // Estados del backend real (en minúsculas después de normalizar)
      iniciada: { className: "badge-pending", label: "Iniciada" },
      en_tramite: { className: "badge-active", label: "En Trámite" },
      resuelta: { className: "badge-archived", label: "Resuelta" },
      archivada: { className: "badge-archived", label: "Archivada" },
      suspendida: { className: "badge-pending", label: "Suspendida" },
    };
    
    const { className, label } = config[estadoNormalizado] || { className: "badge-pending", label: estado || "Desconocido" };
    return (
      <Badge variant="outline" className={cn("font-medium", className)}>
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="card-search overflow-hidden" role="status" aria-live="polite" aria-label="Cargando resultados">
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-full h-16 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="card-search overflow-hidden animate-fade-in">
      {/* Mobile Cards View */}
      <div className="md:hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="font-heading font-semibold text-foreground">
            Resultados ({results.length})
          </h2>
        </div>
        <div className="divide-y divide-border">
          {results.map((process, index) => (
            <article 
              key={process.id}
              className="p-4 hover:bg-muted/30 transition-colors animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {process.numeroExpediente}
                  </span>
                </div>
                {getStatusBadge(process.estado)}
              </div>
              
              <dl className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <dt className="sr-only">Fecha de ingreso</dt>
                  <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <dd>{process.fechaIngreso}</dd>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <dt className="sr-only">Dependencia</dt>
                  <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <dd className="line-clamp-1">{process.dependencia}</dd>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <dt className="sr-only">Juez asignado</dt>
                  <Gavel className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <dd>
                    <span className="identifier-anonymous">{process.juezAnonimo}</span>
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {process.materia}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {process.tipoAccion}
                </Badge>
              </div>

              <Link to={`/ciudadano/proceso/${encodeURIComponent(process.numeroExpediente)}`} className="mt-4 block">
                <Button variant="outline" size="sm" className="w-full">
                  <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                  Ver Detalle
                </Button>
              </Link>
            </article>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-heading font-semibold">N° Expediente</TableHead>
              <TableHead className="font-heading font-semibold">Fecha Ingreso</TableHead>
              <TableHead className="font-heading font-semibold">Dependencia</TableHead>
              <TableHead className="font-heading font-semibold">Materia</TableHead>
              <TableHead className="font-heading font-semibold">Juez</TableHead>
              <TableHead className="font-heading font-semibold">Estado</TableHead>
              <TableHead className="font-heading font-semibold text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((process, index) => (
              <TableRow 
                key={process.id}
                className="table-row-hover animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TableCell className="font-mono text-sm font-semibold">
                  {process.numeroExpediente}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {process.fechaIngreso}
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={process.dependencia}>
                  {process.dependencia}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {process.materia}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="identifier-anonymous">{process.juezAnonimo}</span>
                </TableCell>
                <TableCell>
                  {getStatusBadge(process.estado)}
                </TableCell>
                <TableCell className="text-center">
                  <Link to={`/ciudadano/proceso/${encodeURIComponent(process.numeroExpediente)}`}>
                    <Button variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                      <Eye className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      Ver
                      <span className="sr-only">proceso {process.numeroExpediente}</span>
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
