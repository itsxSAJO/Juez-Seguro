import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, FileText, Users, Check, ChevronRight, AlertTriangle, Shield } from "lucide-react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { causasService } from "@/services/causas.service";

const causaSchema = z.object({
  materia: z.string().min(1, "Seleccione una materia"),
  tipoAccion: z.string().min(1, "Seleccione un tipo de acción"),
  unidadJudicial: z.string().min(1, "Seleccione una unidad judicial"),
  actorNombre: z.string().min(3, "Ingrese el nombre del actor"),
  actorIdentificacion: z.string().min(10, "Ingrese una identificación válida"),
  demandadoNombre: z.string().min(3, "Ingrese el nombre del demandado"),
  demandadoIdentificacion: z.string().min(10, "Ingrese una identificación válida"),
  descripcion: z.string().min(20, "La descripción debe tener al menos 20 caracteres"),
  cuantia: z.string().optional(),
});

type CausaFormData = z.infer<typeof causaSchema>;

// Catálogo de materias y sus tipos de acción
const tiposAccionPorMateria: Record<string, string[]> = {
  Civil: ["Ordinario", "Sumario", "Ejecutivo", "Verbal Sumario", "Monitorio"],
  Penal: ["Procedimiento Directo", "Procedimiento Abreviado", "Procedimiento Ordinario"],
  Laboral: ["Procedimiento Sumario", "Procedimiento Oral"],
  Familia: ["Divorcio", "Alimentos", "Tenencia", "Régimen de Visitas"],
  "Niñez y Adolescencia": ["Alimentos", "Tenencia", "Patria Potestad"],
  Tránsito: ["Contravención", "Delito de Tránsito"],
  "Contencioso Administrativo": ["Subjetivo", "Objetivo", "Lesividad"],
};

// Catálogo de unidades judiciales
const todasUnidadesJudiciales = [
  "Unidad Judicial Civil de Quito",
  "Unidad Judicial Penal de Guayaquil",
  "Unidad Judicial de Familia de Cuenca",
  "Tribunal Contencioso Administrativo de Pichincha",
  "Unidad Judicial Multicompetente de Riobamba",
  "Unidad Judicial Laboral de Quito",
];

const NuevaCausa = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState("");
  const [juezAsignado, setJuezAsignado] = useState("");
  const [scopeError, setScopeError] = useState<string | null>(null);

  // HU-SJ-001: Filtrar materias y unidades según el scope del secretario
  const materiasDisponibles = useMemo(() => {
    if (!user?.materia) return Object.keys(tiposAccionPorMateria);
    // Solo mostrar la materia del secretario
    return Object.keys(tiposAccionPorMateria).filter(
      m => m.toLowerCase().trim() === user.materia.toLowerCase().trim()
    );
  }, [user?.materia]);

  const unidadesDisponibles = useMemo(() => {
    if (!user?.unidadJudicial) return todasUnidadesJudiciales;
    // Solo mostrar la unidad del secretario
    return todasUnidadesJudiciales.filter(
      u => u.toLowerCase().trim() === user.unidadJudicial.toLowerCase().trim()
    );
  }, [user?.unidadJudicial]);

  const form = useForm<CausaFormData>({
    resolver: zodResolver(causaSchema),
    defaultValues: {
      materia: "",
      tipoAccion: "",
      unidadJudicial: "",
      actorNombre: "",
      actorIdentificacion: "",
      demandadoNombre: "",
      demandadoIdentificacion: "",
      descripcion: "",
      cuantia: "",
    },
  });

  // Pre-fill materia and unidadJudicial when user data is available
  useEffect(() => {
    if (user?.materia) {
      form.setValue("materia", user.materia);
    }
    if (user?.unidadJudicial) {
      form.setValue("unidadJudicial", user.unidadJudicial);
    }
  }, [user?.materia, user?.unidadJudicial, form]);

  const selectedMateria = form.watch("materia");
  const availableTipos = selectedMateria ? tiposAccionPorMateria[selectedMateria] || [] : [];

  const handleNext = async () => {
    setScopeError(null); // Limpiar errores previos
    if (step === 1) {
      const isValid = await form.trigger(["materia", "tipoAccion", "unidadJudicial"]);
      if (isValid) setStep(2);
    } else if (step === 2) {
      const isValid = await form.trigger([
        "actorNombre",
        "actorIdentificacion",
        "demandadoNombre",
        "demandadoIdentificacion",
      ]);
      if (isValid) setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const onSubmit = async (data: CausaFormData) => {
    setShowConfirmation(true);
  };

  /**
   * HU-SJ-001: Envía la causa a la API con validación de scope
   * La API valida que materia y unidad coincidan con los atributos del secretario
   * y asigna automáticamente un juez por sorteo
   */
  const confirmSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirmation(false);
    setScopeError(null);

    try {
      const formData = form.getValues();
      
      // Llamar a la API real - HU-SJ-001
      const resultado = await causasService.crearCausa({
        materia: formData.materia,
        tipoProceso: formData.tipoAccion,
        unidadJudicial: formData.unidadJudicial,
        descripcion: formData.descripcion,
        // Partes procesales (información pública)
        actorNombre: formData.actorNombre,
        actorIdentificacion: formData.actorIdentificacion,
        demandadoNombre: formData.demandadoNombre,
        demandadoIdentificacion: formData.demandadoIdentificacion,
      });

      // Éxito - mostrar número de proceso generado
      setGeneratedNumber(resultado.numero_proceso);
      setJuezAsignado(resultado.juezPseudonimo || resultado.juez_pseudonimo);
      setShowSuccess(true);
      
      toast({
        title: "Causa registrada exitosamente",
        description: `Número de proceso: ${resultado.numero_proceso}`,
      });
    } catch (error: any) {
      console.error("Error al crear causa:", error);
      
      // Manejar error de scope (403 Forbidden)
      if (error.message?.includes("Acceso denegado") || error.message?.includes("No tiene permisos")) {
        setScopeError(error.message);
        toast({
          title: "Acceso Denegado",
          description: error.message,
          variant: "destructive",
        });
      } else if (error.message?.includes("Sin jueces disponibles") || error.message?.includes("No hay jueces")) {
        setScopeError(error.message);
        toast({
          title: "Sin Jueces Disponibles",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error al crear la causa",
          description: error.message || "Ocurrió un error inesperado",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formData = form.getValues();

  const steps = [
    { number: 1, title: "Datos del Proceso", icon: FileText },
    { number: 2, title: "Partes Procesales", icon: Users },
    { number: 3, title: "Descripción", icon: FileText },
  ];

  return (
    <FuncionariosLayout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/funcionarios/causas")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Ingreso de Nueva Causa
          </h1>
          <p className="text-muted-foreground">HU-SJ-001: Registro de causas judiciales</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                step === s.number
                  ? "bg-primary text-primary-foreground"
                  : step > s.number
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step > s.number ? (
                <Check className="w-5 h-5" />
              ) : (
                <s.icon className="w-5 h-5" />
              )}
              <span className="hidden sm:inline font-medium">{s.title}</span>
              <span className="sm:hidden font-medium">{s.number}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-5 h-5 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Alerta de información de scope del secretario - HU-SJ-001 */}
      {user && (
        <Alert className="max-w-3xl mx-auto mb-4">
          <Shield className="h-4 w-4" />
          <AlertTitle>Validación de Scope (FIA_ATD)</AlertTitle>
          <AlertDescription>
            Solo puede registrar causas de <strong>{user.materia}</strong> en <strong>{user.unidadJudicial}</strong>. 
            El juez será asignado automáticamente por sorteo equitativo.
          </AlertDescription>
        </Alert>
      )}

      {/* Error de scope si existe */}
      {scopeError && (
        <Alert variant="destructive" className="max-w-3xl mx-auto mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error de Validación</AlertTitle>
          <AlertDescription>{scopeError}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{steps[step - 1].title}</CardTitle>
          <CardDescription>
            {step === 1 && "Ingrese los datos generales del proceso"}
            {step === 2 && "Ingrese la información de las partes procesales"}
            {step === 3 && "Describa el objeto de la demanda"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Process Data */}
              {step === 1 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="materia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Materia</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("tipoAccion", "");
                          }}
                          value={field.value}
                          disabled={materiasDisponibles.length === 1} // Deshabilitar si solo hay una opción
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione la materia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {materiasDisponibles.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {materiasDisponibles.length === 1 
                            ? "Materia asignada según su perfil"
                            : "Seleccione la materia del proceso"
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipoAccion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Acción/Procedimiento</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedMateria}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione el tipo de acción" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTipos.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Los tipos de acción disponibles dependen de la materia seleccionada
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unidadJudicial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad Judicial</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={unidadesDisponibles.length === 1} // Deshabilitar si solo hay una opción
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione la unidad judicial" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unidadesDisponibles.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {unidadesDisponibles.length === 1 
                            ? "Unidad asignada según su perfil"
                            : "Seleccione la unidad judicial"
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 2: Parties */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Actor / Demandante
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="actorNombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre Completo</FormLabel>
                            <FormControl>
                              <Input placeholder="Juan Pérez García" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="actorIdentificacion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Identificación</FormLabel>
                            <FormControl>
                              <Input placeholder="1712345678" maxLength={13} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Demandado / Procesado
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="demandadoNombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre Completo</FormLabel>
                            <FormControl>
                              <Input placeholder="María López Ruiz" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="demandadoIdentificacion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Identificación</FormLabel>
                            <FormControl>
                              <Input placeholder="0912345678" maxLength={13} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Description */}
              {step === 3 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción / Objeto de la Demanda</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describa el objeto de la demanda, los hechos y pretensiones..."
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Mínimo 20 caracteres. Sea claro y conciso.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cuantia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cuantía (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="$0.00" {...field} />
                        </FormControl>
                        <FormDescription>
                          Ingrese el monto en dólares si aplica
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={step === 1}
                >
                  Anterior
                </Button>
                {step < 3 ? (
                  <Button type="button" onClick={handleNext}>
                    Siguiente
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    Revisar y Enviar
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Registro de Causa</DialogTitle>
            <DialogDescription>
              Revise los datos ingresados antes de confirmar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Materia:</span>
                <span className="font-medium">{formData.materia}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Tipo de Acción:</span>
                <span className="font-medium">{formData.tipoAccion}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Unidad Judicial:</span>
                <span className="font-medium">{formData.unidadJudicial}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Actor:</span>
                <span className="font-medium">{formData.actorNombre}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Demandado:</span>
                <span className="font-medium">{formData.demandadoNombre}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Modificar
            </Button>
            <Button onClick={confirmSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Confirmar Registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog - HU-SJ-001 */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <DialogTitle className="text-xl">Causa Registrada Exitosamente</DialogTitle>
            <DialogDescription>
              Se ha generado el expediente electrónico con asignación automática de juez
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Número de Proceso:</p>
              <code className="text-2xl font-mono font-bold text-primary bg-primary/10 px-4 py-2 rounded-lg">
                {generatedNumber}
              </code>
            </div>
            {juezAsignado && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Juez Asignado (Pseudónimo):</p>
                <code className="text-lg font-mono font-semibold text-secondary-foreground bg-secondary px-3 py-1 rounded-lg">
                  {juezAsignado}
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  El pseudónimo protege la identidad del juez (FDP_IFF)
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => navigate("/funcionarios/causas")}>
              Ver Causas
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccess(false);
                form.reset({
                  materia: user?.materia || "",
                  tipoAccion: "",
                  unidadJudicial: user?.unidadJudicial || "",
                  actorNombre: "",
                  actorIdentificacion: "",
                  demandadoNombre: "",
                  demandadoIdentificacion: "",
                  descripcion: "",
                  cuantia: "",
                });
                setStep(1);
                setJuezAsignado("");
                setScopeError(null);
              }}
            >
              Registrar Otra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FuncionariosLayout>
  );
};

export default NuevaCausa;
