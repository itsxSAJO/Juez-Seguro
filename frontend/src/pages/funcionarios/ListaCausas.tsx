import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Eye,
  Calendar,
  FileText,
  Gavel,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCausas, Causa } from "@/lib/funcionarios-data";
import { cn } from "@/lib/utils";

const ListaCausas = () => {
  const { user } = useAuth();
  const [causas, setCausas] = useState<Causa[]>([]);
  const [filteredCausas, setFilteredCausas] = useState<Causa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterMateria, setFilterMateria] = useState<string>("todas");

  useEffect(() => {
    loadCausas();
  }, [user?.id]);

  useEffect(() => {
    let filtered = causas;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.numeroExpediente.toLowerCase().includes(query) ||
          c.actor.toLowerCase().includes(query) ||
          c.demandado.toLowerCase().includes(query)
      );
    }

    if (filterEstado !== "todos") {
      filtered = filtered.filter((c) => c.estado === filterEstado);
    }

    if (filterMateria !== "todas") {
      filtered = filtered.filter((c) => c.materia === filterMateria);
    }

    setFilteredCausas(filtered);
  }, [causas, searchQuery, filterEstado, filterMateria]);

  const loadCausas = async () => {
    setIsLoading(true);
    try {
      const data = await getCausas(user?.cargo === "juez" ? user.id : undefined);
      setCausas(data);
    } catch (error) {
      console.error("Error loading causas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEstadoBadge = (estado: Causa["estado"]) => {
    switch (estado) {
      case "en_tramite":
        return <Badge className="bg-success/10 text-success border-success/20">En Trámite</Badge>;
      case "resuelto":
        return <Badge className="bg-info/10 text-info border-info/20">Resuelto</Badge>;
      case "archivado":
        return <Badge className="bg-muted text-muted-foreground">Archivado</Badge>;
      case "suspendido":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Suspendido</Badge>;
    }
  };

  const getPrioridadIcon = (prioridad: Causa["prioridad"]) => {
    switch (prioridad) {
      case "urgente":
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case "alta":
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };

  const materias = [...new Set(causas.map((c) => c.materia))];

  return (
    <FuncionariosLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {user?.cargo === "juez" ? "Mis Causas" : "Gestión de Causas"}
          </h1>
          <p className="text-muted-foreground">
            {user?.cargo === "juez"
              ? "Causas asignadas a su despacho"
              : "Administre las causas judiciales"}
          </p>
        </div>
        {user?.cargo === "secretario" && (
          <Button asChild>
            <Link to="/funcionarios/causas/nueva">
              <FileText className="w-4 h-4 mr-2" />
              Nueva Causa
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards for Juez */}
      {user?.cargo === "juez" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Gavel className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {causas.filter((c) => c.estado === "en_tramite").length}
                  </p>
                  <p className="text-xs text-muted-foreground">En Trámite</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {causas.filter((c) => c.prioridad === "urgente").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Urgentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {causas.filter((c) => c.estado === "resuelto").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Resueltos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{causas.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, actor o demandado..."
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
                <SelectItem value="en_tramite">En Trámite</SelectItem>
                <SelectItem value="resuelto">Resuelto</SelectItem>
                <SelectItem value="archivado">Archivado</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMateria} onValueChange={setFilterMateria}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Materia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {materias.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Causas</CardTitle>
          <CardDescription>
            {filteredCausas.length} de {causas.length} causas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Número</TableHead>
                    <TableHead>Materia</TableHead>
                    <TableHead className="hidden md:table-cell">Estado Procesal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCausas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron causas
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCausas.map((causa) => (
                      <TableRow key={causa.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPrioridadIcon(causa.prioridad)}
                            <div>
                              <p className="font-mono font-medium text-sm">
                                {causa.numeroExpediente}
                              </p>
                              <p className="text-xs text-muted-foreground">{causa.tipoAccion}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{causa.materia}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {causa.estadoProcesal}
                        </TableCell>
                        <TableCell>{getEstadoBadge(causa.estado)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {new Date(causa.fechaIngreso).toLocaleDateString("es-EC")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/funcionarios/causas/${causa.id}`}>
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                              <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </FuncionariosLayout>
  );
};

export default ListaCausas;
