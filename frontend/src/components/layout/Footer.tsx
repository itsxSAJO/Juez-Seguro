import { Scale, ExternalLink } from "lucide-react";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border mt-auto" role="contentinfo">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Scale className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="font-heading font-bold text-foreground">Juez Seguro</p>
                <p className="text-xs text-muted-foreground">Sistema de Consulta Judicial</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Sistema orientado a fortalecer la confidencialidad de la información judicial en Ecuador.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="font-heading font-semibold text-foreground">Enlaces Institucionales</h3>
            <nav aria-label="Enlaces institucionales">
              <ul className="space-y-2">
                <li>
                  <a 
                    href="https://www.funcionjudicial.gob.ec/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    Consejo de la Judicatura
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    <span className="sr-only">(abre en nueva ventana)</span>
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.cortenacional.gob.ec/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    Corte Nacional de Justicia
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    <span className="sr-only">(abre en nueva ventana)</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Security Notice */}
          <div className="space-y-4">
            <h3 className="font-heading font-semibold text-foreground">Aviso de Seguridad</h3>
            <p className="text-sm text-muted-foreground">
              Este sistema implementa políticas de anonimización para proteger la identidad de los actores judiciales 
              conforme a las clases FIA y FDP de seguridad.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground text-center md:text-left">
              © {currentYear} Juez Seguro - Escuela Politécnica Nacional. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4">
              <a 
                href="#" 
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Política de Privacidad
              </a>
              <a 
                href="#" 
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Términos de Uso
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
