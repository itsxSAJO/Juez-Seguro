import { useState, useEffect, useCallback } from "react";
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
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldCheck,
  Lock,
  Mail,
  Clock,
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
import { getFuncionarios, mockFuncionarios, Funcionario } from "@/lib/funcionarios-data";
import { usuariosService } from "@/services";
import { cn } from "@/lib/utils";

// Mapeo de roles UI a IDs de rol del backend
const rolIdMap: Record<string, number> = {
  cj: 1,      // ADMIN_CJ
  juez: 2,    // JUEZ
  secretario: 3, // SECRETARIO
};

// Dominio institucional fijo
const DOMINIO_INSTITUCIONAL = "@judicatura.gob.ec";

const funcionarioSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  identificacion: z.string().length(10, "La identificación debe tener 10 dígitos"),
  cargo: z.enum(["cj", "juez", "secretario"], {
    required_error: "Seleccione un cargo",
  }),
  unidadJudicial: z.string().min(1, "Seleccione una unidad judicial"),
  materia: z.string().min(1, "Seleccione una materia"),
  emailPrefix: z.string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(30, "El usuario no puede tener más de 30 caracteres")
    .regex(/^[a-z0-9._-]+$/, "Solo letras minúsculas, números, puntos, guiones y guiones bajos"),
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
  
  // Estados para verificación de disponibilidad de correo
  const [emailDisponibilidad, setEmailDisponibilidad] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // ============================================================================
  // ESTADOS PARA PROTECCIÓN OTP (Siempre activo - datos encriptados en BD)
  // ============================================================================
  const [funcionariosProtegidos, setFuncionariosProtegidos] = useState<any[]>([]);
  const [funcionariosDesprotegidos, setFuncionariosDesprotegidos] = useState<Map<number, any>>(new Map());
  // Temporizadores para auto-proteger datos después de 30 segundos
  const [tiemposVisibilidad, setTiemposVisibilidad] = useState<Map<number, number>>(new Map());
  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
  const [funcionarioOtpId, setFuncionarioOtpId] = useState<number | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpEnviando, setOtpEnviando] = useState(false);
  const [otpValidando, setOtpValidando] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpMensaje, setOtpMensaje] = useState("");
  
  // Constante para tiempo de visibilidad de datos (30 segundos)
  const TIEMPO_VISIBILIDAD_DATOS = 30;

  const form = useForm<FuncionarioFormData>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: {
      nombre: "",
      identificacion: "",
      cargo: undefined,
      unidadJudicial: "",
      materia: "",
      emailPrefix: "",
    },
  });

  // Función para verificar disponibilidad del correo con debounce
  const verificarDisponibilidadEmail = useCallback(async (prefix: string) => {
    if (prefix.length < 3) {
      setEmailDisponibilidad("idle");
      return;
    }

    setEmailDisponibilidad("checking");
    
    try {
      const correoCompleto = `${prefix.toLowerCase()}${DOMINIO_INSTITUCIONAL}`;
      const resultado = await usuariosService.verificarDisponibilidad(correoCompleto);
      setEmailDisponibilidad(resultado.disponible ? "available" : "taken");
    } catch {
      setEmailDisponibilidad("idle");
    }
  }, []);

  // Observar cambios en el campo emailPrefix
  const emailPrefixValue = form.watch("emailPrefix");
  
  useEffect(() => {
    // Limpiar timeout anterior
    if (emailCheckTimeout) {
      clearTimeout(emailCheckTimeout);
    }

    // Si estamos editando, no verificar
    if (editingFuncionario) {
      setEmailDisponibilidad("idle");
      return;
    }

    // Debounce de 500ms
    const timeout = setTimeout(() => {
      verificarDisponibilidadEmail(emailPrefixValue);
    }, 500);

    setEmailCheckTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [emailPrefixValue, editingFuncionario, verificarDisponibilidadEmail]);

  // NOTA: La carga inicial ahora se hace en el useEffect de modoProtegido

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

  // ============================================================================
  // FUNCIONES PARA PROTECCIÓN OTP
  // ============================================================================
  
  // Cargar funcionarios en modo protegido (datos ofuscados)
  const loadFuncionariosProtegidos = async () => {
    setIsLoading(true);
    try {
      const resultado = await usuariosService.getUsuariosProtegidos();
      setFuncionariosProtegidos(resultado.data || []);
    } catch (error) {
      console.error("Error loading funcionarios protegidos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los funcionarios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Solicitar OTP para ver datos de un funcionario
  const solicitarOTP = async (funcionarioId: number) => {
    setFuncionarioOtpId(funcionarioId);
    setOtpEnviando(true);
    setOtpMensaje("");
    setOtpInput("");
    
    try {
      const resultado = await usuariosService.solicitarOTP(funcionarioId);
      
      if (resultado.success) {
        setOtpMensaje(resultado.message);
        setOtpCountdown(resultado.expiresIn);
        setIsOtpDialogOpen(true);
        
        // Iniciar countdown
        const interval = setInterval(() => {
          setOtpCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast({
          title: "Error",
          description: resultado.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el OTP",
        variant: "destructive",
      });
    } finally {
      setOtpEnviando(false);
    }
  };
  
  // Validar OTP y obtener datos completos
  const validarOTP = async () => {
    if (!funcionarioOtpId || !otpInput || otpInput.length !== 6) {
      toast({
        title: "OTP inválido",
        description: "Ingrese un código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }
    
    setOtpValidando(true);
    
    try {
      const funcionarioCompleto = await usuariosService.validarOTP(funcionarioOtpId, otpInput);
      const funcId = funcionarioOtpId;
      
      // Guardar el funcionario desprotegido
      setFuncionariosDesprotegidos(prev => {
        const nuevo = new Map(prev);
        nuevo.set(funcId, funcionarioCompleto);
        return nuevo;
      });
      
      // Iniciar temporizador de visibilidad (30 segundos)
      setTiemposVisibilidad(prev => {
        const nuevo = new Map(prev);
        nuevo.set(funcId, TIEMPO_VISIBILIDAD_DATOS);
        return nuevo;
      });
      
      // Iniciar countdown para auto-proteger
      const interval = setInterval(() => {
        setTiemposVisibilidad(prev => {
          const nuevo = new Map(prev);
          const tiempoActual = nuevo.get(funcId) || 0;
          
          if (tiempoActual <= 1) {
            // Tiempo expirado - volver a proteger los datos
            nuevo.delete(funcId);
            setFuncionariosDesprotegidos(prevDesp => {
              const nuevoDesp = new Map(prevDesp);
              nuevoDesp.delete(funcId);
              return nuevoDesp;
            });
            clearInterval(interval);
            toast({
              title: "Datos protegidos",
              description: `Los datos del funcionario #${funcId} han sido protegidos automáticamente.`,
            });
          } else {
            nuevo.set(funcId, tiempoActual - 1);
          }
          
          return nuevo;
        });
      }, 1000);
      
      setIsOtpDialogOpen(false);
      setOtpInput("");
      
      toast({
        title: "Acceso autorizado",
        description: `Los datos serán visibles por ${TIEMPO_VISIBILIDAD_DATOS} segundos.`,
      });
    } catch (error) {
      toast({
        title: "OTP inválido",
        description: error instanceof Error ? error.message : "El código es incorrecto o ha expirado",
        variant: "destructive",
      });
    } finally {
      setOtpValidando(false);
    }
  };
  
  // Obtener datos de un funcionario (protegido o desprotegido)
  const getFuncionarioData = (funcionario: any) => {
    const funcId = funcionario.funcionario_id ?? funcionario.id;
    // Si tenemos datos desprotegidos, usarlos
    // NOTA: El backend devuelve datos en camelCase (nombresCompletos, correoInstitucional, etc.)
    const desprotegido = funcionariosDesprotegidos.get(funcId);
    if (desprotegido) {
      return {
        id: funcId,
        nombre: desprotegido.nombresCompletos || desprotegido.nombres_completos || "N/A",
        identificacion: desprotegido.identificacion || "N/A",
        email: desprotegido.correoInstitucional || desprotegido.correo_institucional || "N/A",
        cargo: desprotegido.rolNombre?.toLowerCase() || desprotegido.rol_nombre?.toLowerCase() || funcionario.rol_nombre?.toLowerCase() || "cj",
        estado: (desprotegido.estado || desprotegido.estado_cuenta || funcionario.estado_cuenta || "ACTIVA").toLowerCase(),
        unidadJudicial: desprotegido.unidadJudicial || desprotegido.unidad_judicial || funcionario.unidad_judicial || "N/A",
        protegido: false,
      };
    }
    
    // Datos protegidos
    return {
      id: funcId,
      nombre: "***PROTEGIDO***",
      identificacion: "***PROTEGIDO***",
      email: "***PROTEGIDO***",
      cargo: funcionario.rol_nombre?.toLowerCase() || "cj",
      estado: (funcionario.estado_cuenta || "ACTIVA").toLowerCase(),
      unidadJudicial: funcionario.unidad_judicial || "N/A",
      protegido: true,
    };
  };

  // Cargar datos al iniciar (siempre en modo protegido)
  useEffect(() => {
    loadFuncionariosProtegidos();
  }, []);

  const openCreateDialog = () => {
    setEditingFuncionario(null);
    setEmailDisponibilidad("idle");
    form.reset({
      nombre: "",
      identificacion: "",
      cargo: undefined,
      unidadJudicial: "",
      materia: "",
      emailPrefix: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (funcionario: Funcionario) => {
    setEditingFuncionario(funcionario);
    setEmailDisponibilidad("idle");
    // Extraer el prefijo del correo (antes del @)
    const emailPrefix = funcionario.email.split("@")[0] || "";
    form.reset({
      nombre: funcionario.nombre,
      identificacion: funcionario.identificacion,
      cargo: funcionario.cargo,
      unidadJudicial: funcionario.unidadJudicial,
      materia: funcionario.materia,
      emailPrefix: emailPrefix,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: FuncionarioFormData) => {
    // Verificar disponibilidad antes de enviar (solo para creación)
    if (!editingFuncionario && emailDisponibilidad === "taken") {
      toast({
        title: "Correo no disponible",
        description: "El usuario de correo ya está en uso. Por favor, elija otro.",
        variant: "destructive",
      });
      return;
    }

    // Construir el correo completo
    const correoCompleto = `${data.emailPrefix.toLowerCase()}${DOMINIO_INSTITUCIONAL}`;

    try {
      if (editingFuncionario) {
        // Para edición, usamos el servicio de actualización
        await usuariosService.actualizarUsuario(editingFuncionario.id, {
          nombresCompletos: data.nombre,
          correoInstitucional: correoCompleto,
          rolId: rolIdMap[data.cargo],
          unidadJudicial: data.unidadJudicial,
          materia: data.materia,
        });
        
        // Actualizar estado local
        setFuncionarios((prev) =>
          prev.map((f) =>
            f.id === editingFuncionario.id ? { ...f, ...data, email: correoCompleto } : f
          )
        );
        toast({
          title: "Funcionario actualizado",
          description: `Los datos de ${data.nombre} han sido actualizados.`,
        });
      } else {
        // Llamar al servicio real - la contraseña se genera automáticamente en el backend
        const nuevoFuncionario = await usuariosService.crearUsuario({
          identificacion: data.identificacion,
          nombresCompletos: data.nombre,
          correoInstitucional: correoCompleto,
          rolId: rolIdMap[data.cargo],
          unidadJudicial: data.unidadJudicial,
          materia: data.materia,
        });

        // Refrescar la lista
        await loadFuncionarios();
        
        toast({
          title: "Funcionario creado",
          description: `${data.nombre} ha sido registrado. Se ha enviado un correo con las credenciales a ${correoCompleto}.`,
        });
      }

      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error al guardar funcionario:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar el funcionario",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = (id: string, newStatus: Funcionario["estado"]) => {
    setPendingStatusChange({ id, newStatus });
    setIsConfirmDialogOpen(true);
  };

  // Mapeo de estados frontend a backend
  const estadoFrontendToBackendMap: Record<string, string> = {
    activa: "ACTIVA",
    habilitable: "HABILITABLE",
    suspendida: "SUSPENDIDA",
    inactiva: "INACTIVA",
    bloqueada: "BLOQUEADA",
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;

    try {
      // Mapear el estado del frontend al formato del backend
      const estadoBackend = estadoFrontendToBackendMap[pendingStatusChange.newStatus];
      
      await usuariosService.actualizarUsuario(pendingStatusChange.id, {
        estado: estadoBackend,
      });

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
    } catch (error) {
      toast({
        title: "Error al cambiar estado",
        description: error instanceof Error ? error.message : "Error al actualizar el estado",
        variant: "destructive",
      });
    } finally {
      setIsConfirmDialogOpen(false);
      setPendingStatusChange(null);
    }
  };

  const getEstadoBadge = (estado: Funcionario["estado"]) => {
    switch (estado) {
      case "activa":
        return <Badge className="bg-success/10 text-success border-success/20">Activa</Badge>;
      case "habilitable":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Pendiente Activación</Badge>;
      case "suspendida":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Suspendida</Badge>;
      case "bloqueada":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Bloqueada</Badge>;
      case "inactiva":
        return <Badge className="bg-muted text-muted-foreground">Inactiva</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">{estado}</Badge>;
    }
  };

  const getCargoBadge = (cargo: Funcionario["cargo"]) => {
    switch (cargo) {
      case "cj":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Consejo de la Judicatura</Badge>;
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
        <div className="flex gap-2">
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Funcionario
          </Button>
        </div>
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
                <SelectItem value="cj">Consejo de la Judicatura</SelectItem>
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
                <SelectItem value="habilitable">Pendiente Activación</SelectItem>
                <SelectItem value="activa">Activa</SelectItem>
                <SelectItem value="suspendida">Suspendida</SelectItem>
                <SelectItem value="bloqueada">Bloqueada</SelectItem>
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
              {funcionariosProtegidos.length} funcionarios (datos encriptados en BD)
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
            // ========== TABLA CON DATOS PROTEGIDOS (Encriptados en BD) ==========
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Identificación</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funcionariosProtegidos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron funcionarios
                      </TableCell>
                    </TableRow>
                  ) : (
                    funcionariosProtegidos.map((funcionario, index) => {
                      const datos = getFuncionarioData(funcionario);
                      const funcId = funcionario.funcionario_id ?? funcionario.id ?? index;
                      return (
                        <TableRow key={funcId}>
                          <TableCell className="font-mono text-sm font-bold">
                            #{funcId}
                          </TableCell>
                          <TableCell>
                            {datos.protegido ? (
                              <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-amber-500" />
                                <span className="text-amber-600 italic">Protegido</span>
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium">{datos.nombre}</p>
                                <p className="text-xs text-muted-foreground">{datos.email}</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {datos.protegido ? (
                              <span className="text-amber-600 italic">***</span>
                            ) : (
                              datos.identificacion
                            )}
                          </TableCell>
                          <TableCell>{getCargoBadge(datos.cargo as any)}</TableCell>
                          <TableCell>{getEstadoBadge(datos.estado as any)}</TableCell>
                          <TableCell className="text-right">
                            {datos.protegido ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => solicitarOTP(funcId)}
                                disabled={otpEnviando && funcionarioOtpId === funcId}
                              >
                                {otpEnviando && funcionarioOtpId === funcId ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <Eye className="w-4 h-4 mr-2" />
                                )}
                                Ver
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                                  <ShieldCheck className="w-3 h-3 mr-1" />
                                  Visible
                                </Badge>
                                <Badge variant="outline" className="text-amber-600 border-amber-400 animate-pulse">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {tiemposVisibilidad.get(funcId) || 0}s
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OTP Dialog */}
      <Dialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Verificación OTP
            </DialogTitle>
            <DialogDescription>
              Se ha enviado un código de verificación a su correo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {otpMensaje && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">{otpMensaje}</p>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className={otpCountdown <= 10 ? "text-red-500 font-bold" : "text-amber-600"}>
                Expira en: {otpCountdown}s
              </span>
            </div>
            
            <div>
              <label className="text-sm font-medium">Código OTP (6 dígitos)</label>
              <Input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl font-mono tracking-widest mt-2"
                autoFocus
              />
            </div>
            
            {otpCountdown === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">
                  El código ha expirado. Cierre este diálogo y solicite uno nuevo.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOtpDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={validarOTP} 
              disabled={otpValidando || otpInput.length !== 6 || otpCountdown === 0}
            >
              {otpValidando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                "Verificar OTP"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                          <SelectItem value="cj">Consejo de la Judicatura</SelectItem>
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
                name="emailPrefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico Institucional</FormLabel>
                    <div className="flex items-center gap-0">
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="usuario"
                          className="rounded-r-none border-r-0"
                          {...field}
                          onChange={(e) => {
                            // Convertir a minúsculas y eliminar espacios
                            const value = e.target.value.toLowerCase().replace(/\s/g, "");
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <div className="flex items-center px-3 h-10 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground">
                        {DOMINIO_INSTITUCIONAL}
                      </div>
                      {/* Indicador de disponibilidad */}
                      <div className="ml-2 flex items-center">
                        {emailDisponibilidad === "checking" && (
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        )}
                        {emailDisponibilidad === "available" && !editingFuncionario && (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        )}
                        {emailDisponibilidad === "taken" && !editingFuncionario && (
                          <XCircle className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                    </div>
                    {emailDisponibilidad === "taken" && !editingFuncionario && (
                      <p className="text-sm text-destructive mt-1">
                        Este usuario ya está en uso
                      </p>
                    )}
                    {emailDisponibilidad === "available" && !editingFuncionario && (
                      <p className="text-sm text-success mt-1">
                        Usuario disponible
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nota informativa sobre la contraseña */}
              {!editingFuncionario && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  📧 Se generará una contraseña automáticamente y se enviará al correo electrónico del funcionario.
                </p>
              )}

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
