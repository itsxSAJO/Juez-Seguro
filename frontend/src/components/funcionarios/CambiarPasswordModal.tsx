// ============================================================================
// Modal de Cambio de Contraseña - Primer Login
// Se muestra cuando un usuario con estado HABILITABLE inicia sesión
// ============================================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Esquema de validación para cambio de contraseña
const cambiarPasswordSchema = z.object({
  passwordActual: z.string()
    .min(1, "Ingrese su contraseña temporal")
    .max(128, "Máximo 128 caracteres"),
  passwordNueva: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(128, "Máximo 128 caracteres")
    .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
    .regex(/[a-z]/, "Debe incluir al menos una minúscula")
    .regex(/[0-9]/, "Debe incluir al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe incluir al menos un caracter especial"),
  confirmarPassword: z.string()
    .min(1, "Confirme su nueva contraseña")
    .max(128, "Máximo 128 caracteres"),
}).refine((data) => data.passwordNueva === data.confirmarPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmarPassword"],
}).refine((data) => data.passwordActual !== data.passwordNueva, {
  message: "La nueva contraseña debe ser diferente a la actual",
  path: ["passwordNueva"],
});

type CambiarPasswordFormData = z.infer<typeof cambiarPasswordSchema>;

interface CambiarPasswordModalProps {
  open: boolean;
  onSuccess: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const CambiarPasswordModal = ({ open, onSuccess }: CambiarPasswordModalProps) => {
  const { token, logout, completarCambioPassword } = useAuth();
  const [showPasswordActual, setShowPasswordActual] = useState(false);
  const [showPasswordNueva, setShowPasswordNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CambiarPasswordFormData>({
    resolver: zodResolver(cambiarPasswordSchema),
    defaultValues: {
      passwordActual: "",
      passwordNueva: "",
      confirmarPassword: "",
    },
  });

  const onSubmit = async (data: CambiarPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/cambiar-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          passwordActual: data.passwordActual,
          passwordNueva: data.passwordNueva,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Error al cambiar la contraseña");
        setIsLoading(false);
        return;
      }

      // Si se recibe un nuevo token, actualizar la autenticación
      if (result.token && result.user) {
        // Limpiar todo el almacenamiento local
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        sessionStorage.removeItem("auth_token");
        sessionStorage.removeItem("requiereCambioPassword");
        
        // Redirigir al login para que inicie sesión con la nueva contraseña
        window.location.href = "/login";
        return;
      }

      // Éxito - marcar que se completó el cambio de contraseña
      completarCambioPassword();
      onSuccess();
    } catch (err) {
      setError("Error de conexión. Intente nuevamente.");
      setIsLoading(false);
    }
  };

  const handleCancelLogout = () => {
    // Si el usuario cancela, cerramos la sesión por seguridad
    logout();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Cambio de Contraseña Obligatorio</DialogTitle>
              <DialogDescription>
                Es su primer inicio de sesión. Por seguridad, debe establecer una nueva contraseña.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="passwordActual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña Temporal</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showPasswordActual ? "text" : "password"}
                        placeholder="Ingrese la contraseña temporal"
                        className="pl-10 pr-10"
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPasswordActual(!showPasswordActual)}
                      >
                        {showPasswordActual ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passwordNueva"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showPasswordNueva ? "text" : "password"}
                        placeholder="Ingrese su nueva contraseña"
                        className="pl-10 pr-10"
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPasswordNueva(!showPasswordNueva)}
                      >
                        {showPasswordNueva ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 caracter especial
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmarPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Nueva Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showConfirmar ? "text" : "password"}
                        placeholder="Confirme su nueva contraseña"
                        className="pl-10 pr-10"
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmar(!showConfirmar)}
                      >
                        {showConfirmar ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCancelLogout}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  "Cambiar Contraseña"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CambiarPasswordModal;
