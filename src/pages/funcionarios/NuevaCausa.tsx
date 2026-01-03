import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, FileText, Users, Check, ChevronRight } from "lucide-react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const materias = [
  "Civil",
  "Penal",
  "Laboral",
  "Familia",
  "Niñez y Adolescencia",
  "Tránsito",
  "Contencioso Administrativo",
];

const tiposAccion: Record<string, string[]> = {
  Civil: ["Ordinario", "Sumario", "Ejecutivo", "Verbal Sumario", "Monitorio"],
  Penal: ["Procedimiento Directo", "Procedimiento Abreviado", "Procedimiento Ordinario"],
  Laboral: ["Procedimiento Sumario", "Procedimiento Oral"],
  Familia: ["Divorcio", "Alimentos", "Tenencia", "Régimen de Visitas"],
  "Niñez y Adolescencia": ["Alimentos", "Tenencia", "Patria Potestad"],
  Tránsito: ["Contravención", "Delito de Tránsito"],
  "Contencioso Administrativo": ["Subjetivo", "Objetivo", "Lesividad"],
};

const unidadesJudiciales = [
  "Unidad Judicial Civil de Quito",
  "Unidad Judicial Penal de Guayaquil",
  "Unidad Judicial de Familia de Cuenca",
  "Tribunal Contencioso Administrativo de Pichincha",
  "Unidad Judicial Multicompetente de Riobamba",
  "Unidad Judicial Laboral de Quito",
];

const NuevaCausa = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState("");

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

  const selectedMateria = form.watch("materia");
  const availableTipos = selectedMateria ? tiposAccion[selectedMateria] || [] : [];

  const handleNext = async () => {
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

  const confirmSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirmation(false);

    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));

    // Generate case number
    const provincia = "17";
    const juzgado = Math.floor(Math.random() * 900) + 100;
    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
    const letter = "ABCDEFGHJK"[Math.floor(Math.random() * 10)];
    const number = `${provincia}${juzgado}-${year}-${seq}${letter}`;

    setGeneratedNumber(number);
    setIsSubmitting(false);
    setShowSuccess(true);
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
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione la materia" />
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione la unidad judicial" />
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

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <DialogTitle className="text-xl">Causa Registrada Exitosamente</DialogTitle>
            <DialogDescription>
              Se ha generado el expediente electrónico
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <p className="text-sm text-muted-foreground mb-2">Número de Proceso:</p>
            <code className="text-2xl font-mono font-bold text-primary bg-primary/10 px-4 py-2 rounded-lg">
              {generatedNumber}
            </code>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => navigate("/funcionarios/causas")}>
              Ver Causas
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccess(false);
                form.reset();
                setStep(1);
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
