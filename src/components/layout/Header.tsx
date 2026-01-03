import { Link } from "react-router-dom";
import { Scale, HelpCircle, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="header-institutional sticky top-0 z-50">
      {/* Skip link for accessibility */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo and Title */}
          <Link 
            to="/" 
            className="flex items-center gap-3 group"
            aria-label="Inicio - Juez Seguro"
          >
            <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-lg bg-accent/20 group-hover:bg-accent/30 transition-colors">
              <Scale className="w-5 h-5 md:w-6 md:h-6 text-accent" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg md:text-xl font-heading font-bold tracking-tight">
                Juez Seguro
              </h1>
              <p className="text-xs md:text-sm text-primary-foreground/70 font-medium">
                E-SATJE 2020 - Consulta de Procesos
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Navegación principal">
            <Link 
              to="/ciudadano" 
              className="text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground transition-colors"
            >
              Búsqueda
            </Link>
            <Link 
              to="/ayuda" 
              className="text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4" aria-hidden="true" />
              Ayuda
            </Link>
            <Link 
              to="/funcionarios/login" 
              className="text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground transition-colors"
            >
              Funcionarios
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav 
            id="mobile-menu"
            className="md:hidden py-4 border-t border-primary-foreground/20 animate-slide-down"
            aria-label="Navegación móvil"
          >
            <div className="flex flex-col gap-2">
              <Link 
                to="/ciudadano" 
                className="px-4 py-2 text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Búsqueda
              </Link>
              <Link 
                to="/ayuda" 
                className="px-4 py-2 text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10 rounded-md transition-colors flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                Ayuda
              </Link>
              <Link 
                to="/funcionarios/login" 
                className="px-4 py-2 text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Funcionarios
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
