import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Search,
  Plus,
  Edit,
  UserCheck,
  UserX,
  UserMinus,
  Filter,
  Download,
  MoreHorizontal,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { getFuncionarios, Funcionario, mockFuncionarios } from "@/lib/mockFuncionarios";
import { cn } from "@/lib/utils";

const funcionarioSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  identificacion: z.string().length(10, "La identificación debe tener 10 dígitos"),
  cargo: z.enum(["admin", "juez", "secretario"], {
    required_error: "Seleccione un cargo",
  }),
  unidadJudicial: z.string().min(1, "Seleccione una unidad judicial"),
  materia: z.string().min(1, "Seleccione una materia"),
  email: z.string().email("Ingrese un correo válido"),
});

type FuncionarioFormData = z.infer<typeof funcionarioSchema>;

const unidadesJudiciales = [
  "Consejo de la Judicatura",
  "Unidad Judicial Civil de Quito",
  "Unidad Judicial Penal de Guayaquil",
  "Unidad Judicial de Familia de Cuenca",
  "Tribunal Contencioso Administrativo de Pichincha",
  "Unidad Judicial Multicompetente de Riobamba",
  "Unidad Judicial Laboral de Quito",
];

const materias = [
  "Administración",
  "Civil",
  "Penal",
  "Laboral",
  "Familia",
  "Niñez y Adolescencia",
  "Tránsito",
  "Contencioso Administrativo",
];

const GestionCuentas = () => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [filteredFuncionarios, setFilteredFuncionarios] = useState<Funcionario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCargo, setFilterCargo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    id: string;
    newStatus: Funcionario["estado"];
  } | null>(null);

  const form = useForm<FuncionarioFormData>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: {
      nombre: "",
      identificacion: "",
      cargo: undefined,
      unidadJudicial: "",
      materia: "",
      email: "",
    },
  });

  useEffect(() => {
    loadFuncionarios();
  }, []);

  useEffect(() => {
    let filtered = funcionarios;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.nombre.toLowerCase().includes(query) ||
          f.identificacion.includes(query) ||
          f.cargo.toLowerCase().includes(query)
      );
    }

    if (filterCargo !== "todos") {
      filtered = filtered.filter((f) => f.cargo === filterCargo);
    }

    if (filterEstado !== "todos") {
      filtered = filtered.filter((f) => f.estado === filterEstado);
    }

    setFilteredFuncionarios(filtered);
  }, [funcionarios, searchQuery, filterCargo, filterEstado]);

  const loadFuncionarios = async () => {
    setIsLoading(true);
    try {
      const data = await getFuncionarios();
      setFuncionarios(data);
    } catch (error) {
      console.error("Error loading funcionarios:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingFuncionario(null);
    form.reset({
      nombre: "",
      identificacion: "",
      cargo: undefined,
      unidadJudicial: "",
      materia: "",
      email: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (funcionario: Funcionario) => {
    setEditingFuncionario(funcionario);
    form.reset({
      nombre: funcionario.nombre,
      identificacion: funcionario.identificacion,
      cargo: funcionario.cargo,
      unidadJudicial: funcionario.unidadJudicial,
      materia: funcionario.materia,
      email: funcionario.email,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: FuncionarioFormData) => {
    // Simulate API call
    await new Promise((r) => setTimeout(r, 500));

    if (editingFuncionario) {
      setFuncionarios((prev) =>
        prev.map((f) =>
          f.id === editingFuncionario.id ? { ...f, ...data } : f
        )
      );
      toast({
        title: "Funcionario actualizado",
        description: `Los datos de ${data.nombre} han sido actualizados.`,
      });
    } else {
      const newFuncionario: Funcionario = {
        id: `new-${Date.now()}`,
        nombre: data.nombre,
        identificacion: data.identificacion,
        cargo: data.cargo,
        unidadJudicial: data.unidadJudicial,
        materia: data.materia,
        email: data.email,
        estado: "activa",
        fechaCreacion: new Date().toISOString().split("T")[0],
        ultimoAcceso: "-",
        intentosFallidos: 0,
      };
      setFuncionarios((prev) => [newFuncionario, ...prev]);
      toast({
        title: "Funcionario creado",
        description: `${data.nombre} ha sido registrado exitosamente.`,
      });
    }

    setIsDialogOpen(false);
  };

  const handleStatusChange = (id: string, newStatus: Funcionario["estado"]) => {
    setPendingStatusChange({ id, newStatus });
    setIsConfirmDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;

    await new Promise((r) => setTimeout(r, 500));

    setFuncionarios((prev) =>
      prev.map((f) =>
        f.id === pendingStatusChange.id
          ? { ...f, estado: pendingStatusChange.newStatus }
          : f
      )
    );

    const funcionario = funcionarios.find((f) => f.id === pendingStatusChange.id);
    toast({
      title: "Estado actualizado",
      description: `La cuenta de ${funcionario?.nombre} ahora está ${pendingStatusChange.newStatus}.`,
    });

    setIsConfirmDialogOpen(false);
    setPendingStatusChange(null);
  };

  const getEstadoBadge = (estado: Funcionario["estado"]) => {
    switch (estado) {
      case "activa":
        return <Badge className="bg-success/10 text-success border-success/20">Activa</Badge>;
      case "suspendida":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Suspendida</Badge>;
      case "inactiva":
        return <Badge className="bg-muted text-muted-foreground">Inactiva</Badge>;
    }
  };

  const getCargoBadge = (cargo: Funcionario["cargo"]) => {
    switch (cargo) {
      case "admin":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Administrador</Badge>;
      case "juez":
        return <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent/20">Juez</Badge>;
      case "secretario":
        return <Badge variant="outline" className="bg-info/10 text-info border-info/20">Secretario</Badge>;
    }
  };

  return (
    <FuncionariosLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Administración de Cuentas
          </h1>
          <p className="text-muted-foreground">
            Gestione los funcionarios del sistema judicial
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Funcionario
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, identificación o cargo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCargo} onValueChange={setFilterCargo}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los cargos</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="juez">Juez</SelectItem>
                <SelectItem value="secretario">Secretario</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="activa">Activa</SelectItem>
                <SelectItem value="suspendida">Suspendida</SelectItem>
                <SelectItem value="inactiva">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Funcionarios Registrados</CardTitle>
            <CardDescription>
              {filteredFuncionarios.length} de {funcionarios.length} funcionarios
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Identificación</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="hidden md:table-cell">Unidad Judicial</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Último Acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFuncionarios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron funcionarios
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFuncionarios.map((funcionario) => (
                      <TableRow key={funcionario.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{funcionario.nombre}</p>
                            <p className="text-xs text-muted-foreground">{funcionario.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {funcionario.identificacion}
                        </TableCell>
                        <TableCell>{getCargoBadge(funcionario.cargo)}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                          {funcionario.unidadJudicial}
                        </TableCell>
                        <TableCell>{getEstadoBadge(funcionario.estado)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {funcionario.ultimoAcceso
                            ? new Date(funcionario.ultimoAcceso).toLocaleDateString("es-EC")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(funcionario)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {funcionario.estado !== "activa" && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(funcionario.id, "activa")}
                                >
                                  <UserCheck className="w-4 h-4 mr-2 text-success" />
                                  Activar
                                </DropdownMenuItem>
                              )}
                              {funcionario.estado !== "suspendida" && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(funcionario.id, "suspendida")}
                                >
                                  <UserMinus className="w-4 h-4 mr-2 text-warning" />
                                  Suspender
                                </DropdownMenuItem>
                              )}
                              {funcionario.estado !== "inactiva" && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(funcionario.id, "inactiva")}
                                >
                                  <UserX className="w-4 h-4 mr-2 text-destructive" />
                                  Desactivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFuncionario ? "Editar Funcionario" : "Nuevo Funcionario"}
            </DialogTitle>
            <DialogDescription>
              {editingFuncionario
                ? "Actualice los datos del funcionario."
                : "Complete los datos para registrar un nuevo funcionario."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Juan Pérez García" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="identificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identificación</FormLabel>
                      <FormControl>
                        <Input placeholder="1712345678" maxLength={10} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cargo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="juez">Juez</SelectItem>
                          <SelectItem value="secretario">Secretario</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="unidadJudicial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad Judicial</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una unidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unidadesJudiciales.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="materia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Materia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una materia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {materias.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="usuario@judicatura.gob.ec"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingFuncionario ? "Guardar Cambios" : "Registrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirm Status Change Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar cambio de estado</DialogTitle>
            <DialogDescription>
              {pendingStatusChange?.newStatus === "suspendida" &&
                "Esta acción bloqueará el acceso del funcionario al sistema."}
              {pendingStatusChange?.newStatus === "inactiva" &&
                "Esta acción desactivará permanentemente la cuenta del funcionario."}
              {pendingStatusChange?.newStatus === "activa" &&
                "Esta acción restaurará el acceso del funcionario al sistema."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmStatusChange}
              variant={
                pendingStatusChange?.newStatus === "activa"
                  ? "default"
                  : pendingStatusChange?.newStatus === "suspendida"
                  ? "outline"
                  : "destructive"
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FuncionariosLayout>
  );
};

export default GestionCuentas;
