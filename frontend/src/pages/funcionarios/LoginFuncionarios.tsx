import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Scale, Eye, EyeOff, AlertCircle, Lock, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("Ingrese un correo electrónico válido"),
  password: z.string().min(1, "Ingrese su contraseña"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginFuncionarios = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para obtener la ruta del dashboard según el rol
  const getDashboardRoute = (cargo: string): string => {
    // Siempre redirigir al dashboard principal de funcionarios
    // El dashboard se encarga de mostrar contenido según el rol
    return "/funcionarios";
  };

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    const result = await login(data.email, data.password);

    setIsLoading(false);

    if (result.success && result.user) {
      // Redirigir al dashboard según el rol del usuario
      const dashboardRoute = getDashboardRoute(result.user.cargo);
      navigate(dashboardRoute, { replace: true });
    } else {
      setError(result.error || "Error al iniciar sesión");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground shadow-lg group-hover:shadow-xl transition-shadow">
              <Scale className="w-7 h-7" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-heading font-bold text-foreground">Juez Seguro</h1>
              <p className="text-sm text-muted-foreground">Portal de Funcionarios</p>
            </div>
          </Link>
        </div>

        <Card className="shadow-xl border-border/50">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-2xl font-heading">Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingrese sus credenciales institucionales
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="usuario@judicatura.gob.ec"
                            className="pl-10"
                            autoComplete="email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            autoComplete="current-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
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

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Verificando...
                    </span>
                  ) : (
                    "Ingresar"
                  )}
                </Button>
              </form>
            </Form>

            {/* Demo credentials */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Credenciales de prueba:</p>
              <div className="space-y-1 text-xs text-muted-foreground font-mono">
                <p><span className="text-foreground font-semibold">Admin CJ:</span> admin.cj@judicatura.gob.ec</p>
                <p><span className="text-foreground font-semibold">Juez:</span> juez.gutierrez@judicatura.gob.ec</p>
                <p><span className="text-foreground font-semibold">Secretario:</span> secretario.paredes@judicatura.gob.ec</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back link */}
        <div className="text-center mt-6">
          <Link to="/ciudadano" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Volver a consulta pública
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginFuncionarios;
