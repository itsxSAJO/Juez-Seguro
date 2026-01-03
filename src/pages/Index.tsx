import { Link } from "react-router-dom";
import { Scale, Users, Gavel, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          {/* Logo */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary text-primary-foreground shadow-xl mb-6">
              <Scale className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground mb-4">
              Juez Seguro
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Sistema Electrónico de Trámite Judicial del Ecuador
            </p>
            <p className="text-sm text-muted-foreground mt-2">E-SATJE 2020</p>
          </div>

          {/* Portal Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: "200ms" }}>
            {/* Portal Ciudadano */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
                  <Users className="w-8 h-8 text-info" />
                </div>
                <CardTitle className="text-2xl font-heading">Portal Ciudadano</CardTitle>
                <CardDescription className="text-base">
                  Consulta pública de procesos judiciales
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-info" />
                    Búsqueda por número de proceso
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-info" />
                    Consulta por actor/ofendido
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-info" />
                    Vista de expediente anonimizado
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-info" />
                    Acceso sin registro
                  </li>
                </ul>
                <Button asChild className="w-full" size="lg">
                  <Link to="/ciudadano">
                    Acceder a Consulta
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Portal Funcionarios */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-accent/50">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Gavel className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl font-heading">Portal Funcionarios</CardTitle>
                <CardDescription className="text-base">
                  Gestión judicial interna
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Administración de causas
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Agenda de audiencias
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Gestión de documentos
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Firma electrónica
                  </li>
                </ul>
                <Button asChild variant="outline" className="w-full border-2" size="lg">
                  <Link to="/funcionarios/login">
                    Iniciar Sesión
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Consejo de la Judicatura del Ecuador. Todos los derechos reservados.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Protección de identidad judicial conforme a políticas FIA y FDP
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
