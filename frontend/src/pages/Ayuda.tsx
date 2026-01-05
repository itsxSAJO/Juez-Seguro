import { MainLayout } from "@/components/layout/MainLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  Search,
  Shield,
  FileText,
  Users,
  AlertCircle,
  Lock,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

const Ayuda = () => {
  return (
    <MainLayout>
      {/* Header */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Link to="/" className="inline-flex mb-6">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Volver a búsqueda
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <HelpCircle className="w-8 h-8 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
                Centro de Ayuda
              </h1>
              <p className="text-lg text-muted-foreground">
                Guía de uso del sistema Juez Seguro
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              {/* How to search */}
              <div className="card-search p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <Search className="w-5 h-5 text-info" aria-hidden="true" />
                  </div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Cómo realizar una búsqueda
                  </h2>
                </div>

                <div className="space-y-4 text-muted-foreground">
                  <p>
                    El sistema permite buscar procesos judiciales de tres formas diferentes:
                  </p>

                  <div className="grid gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">Por Actor/Ofendido</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Ingrese el número de cédula, RUC o pasaporte</li>
                        <li>Puede buscar también por nombres y apellidos</li>
                        <li>No use caracteres especiales excepto (.) y (-)</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">Por Demandado/Procesado</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Ingrese el número de cédula, RUC o pasaporte</li>
                        <li>Puede buscar también por nombres y apellidos</li>
                        <li>No use caracteres especiales excepto (.) y (-)</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">Por Número de Proceso</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Formato: 17203-2023-01234G</li>
                        <li>Puede ingresar con o sin guiones</li>
                        <li>Ejemplo: 17203202301234G o 17203-2023-01234G</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="card-search p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-warning" aria-hidden="true" />
                  </div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Preguntas Frecuentes
                  </h2>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-left">
                      ¿Por qué veo códigos en lugar de nombres?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      El sistema Juez Seguro implementa una política de anonimización para proteger 
                      la identidad de los actores judiciales. Los códigos como "JK-542" representan 
                      identificadores únicos que reemplazan los nombres reales de jueces, secretarios 
                      y demás funcionarios judiciales.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-left">
                      ¿Los documentos del proceso son públicos?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Sí, los documentos y resoluciones judiciales mantienen su carácter público 
                      conforme a la ley. Lo que se protege es la identidad de las personas involucradas, 
                      no el contenido de los documentos procesales.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-left">
                      ¿Qué significa el estado del proceso?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <ul className="list-disc list-inside space-y-2">
                        <li><strong>Activo:</strong> El proceso está en trámite y puede recibir actuaciones.</li>
                        <li><strong>Pendiente:</strong> El proceso está a la espera de una acción o resolución.</li>
                        <li><strong>Archivado:</strong> El proceso ha concluido y se encuentra archivado.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-left">
                      ¿Qué hago si no encuentro mi proceso?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <ul className="list-disc list-inside space-y-2">
                        <li>Verifique que los datos ingresados sean correctos</li>
                        <li>Intente con diferentes formatos (con/sin guiones)</li>
                        <li>Si el proceso es muy antiguo, puede no estar digitalizado</li>
                        <li>Contacte a la Unidad Judicial correspondiente para más información</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-5">
                    <AccordionTrigger className="text-left">
                      ¿Cómo puedo obtener copias certificadas?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Para obtener copias certificadas debe acudir personalmente a la Unidad Judicial 
                      donde se tramita el proceso, presentar su identificación y solicitar las copias 
                      en la ventanilla de atención al usuario.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Security info */}
              <div className="card-search p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-5 h-5 text-success" aria-hidden="true" />
                  <h3 className="font-heading font-semibold text-foreground">
                    Sobre la Seguridad
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Este sistema implementa las políticas de seguridad FIA (Identificación y Autenticación) 
                  y FDP (Protección de Datos del Usuario) para garantizar la confidencialidad.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground">Datos encriptados</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground">Identidades protegidas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground">Documentos públicos</span>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="card-search p-6">
                <h3 className="font-heading font-semibold text-foreground mb-4">
                  ¿Necesita más ayuda?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Contacte al Consejo de la Judicatura para asistencia adicional.
                </p>
                <a
                  href="https://www.funcionjudicial.gob.ec/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    Visitar sitio web
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default Ayuda;
