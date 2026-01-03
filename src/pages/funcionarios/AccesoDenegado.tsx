import { Link } from "react-router-dom";
import { ShieldX, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AccesoDenegado = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-heading">Acceso Denegado</CardTitle>
          <CardDescription>
            No tiene permisos para acceder a este recurso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Su rol actual no le permite acceder a esta sección del sistema. 
            Si considera que esto es un error, contacte al administrador.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" asChild>
              <Link to="/funcionarios">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link to="/">
                <Home className="w-4 h-4 mr-2" />
                Ir al Inicio
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccesoDenegado;
