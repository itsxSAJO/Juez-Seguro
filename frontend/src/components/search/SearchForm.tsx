import { useState } from "react";
import { Search, User, Users, FileText, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// Constantes de límites
const LIMITES = {
  NOMBRE_MAX: 50,
  NUMERO_PROCESO_MAX: 25,
  BUSQUEDA_MIN: 3,
};

// Patrones de validación
const PATRON_BUSQUEDA = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚüÜ\s.\-]+$/;
const PATRON_NUMERO_PROCESO = /^[0-9]{5}-[0-9]{4}-[0-9]{5}[A-Z]?$/;

export interface SearchFormData {
  searchType: "actor" | "demandado" | "proceso";
  query: string;
}

interface SearchFormProps {
  onSearch: (data: SearchFormData) => void;
  isLoading?: boolean;
}

export const SearchForm = ({ onSearch, isLoading = false }: SearchFormProps) => {
  const [searchType, setSearchType] = useState<"actor" | "demandado" | "proceso">("actor");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const getMaxLength = () => {
    return searchType === "proceso" ? LIMITES.NUMERO_PROCESO_MAX : LIMITES.NOMBRE_MAX;
  };

  const validateQuery = (value: string): boolean => {
    const cleanValue = value.trim();
    
    if (!cleanValue) {
      setError("Por favor ingrese un término de búsqueda.");
      return false;
    }

    if (cleanValue.length < LIMITES.BUSQUEDA_MIN) {
      setError(`El término de búsqueda debe tener al menos ${LIMITES.BUSQUEDA_MIN} caracteres.`);
      return false;
    }

    if (searchType === "proceso") {
      // Validar formato de número de proceso
      if (cleanValue.length > LIMITES.NUMERO_PROCESO_MAX) {
        setError(`Máximo ${LIMITES.NUMERO_PROCESO_MAX} caracteres.`);
        return false;
      }
      if (!PATRON_NUMERO_PROCESO.test(cleanValue)) {
        setError("Formato inválido. Ejemplo: 17203-2024-00001");
        return false;
      }
    } else {
      // Validar búsqueda por nombre/identificación
      if (cleanValue.length > LIMITES.NOMBRE_MAX) {
        setError(`El nombre no puede exceder ${LIMITES.NOMBRE_MAX} caracteres.`);
        return false;
      }
      if (!PATRON_BUSQUEDA.test(cleanValue)) {
        setError("No se permiten caracteres especiales (@, /, #, etc.)");
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateQuery(query)) {
      onSearch({ searchType, query: query.trim() });
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (error) {
      setError(null);
    }
  };

  const getPlaceholder = () => {
    switch (searchType) {
      case "actor":
        return "Ingrese cédula, RUC, pasaporte o nombres del actor/ofendido";
      case "demandado":
        return "Ingrese cédula, RUC, pasaporte o nombres del demandado/procesado";
      case "proceso":
        return "Ingrese el número de proceso (Ej: 17203-2023-01234G)";
    }
  };

  const getIcon = () => {
    switch (searchType) {
      case "actor":
        return <User className="w-5 h-5 text-primary" aria-hidden="true" />;
      case "demandado":
        return <Users className="w-5 h-5 text-primary" aria-hidden="true" />;
      case "proceso":
        return <FileText className="w-5 h-5 text-primary" aria-hidden="true" />;
    }
  };

  return (
    <div className="card-search p-6 md:p-8">
      <form onSubmit={handleSubmit} noValidate>
        <Tabs 
          value={searchType} 
          onValueChange={(value) => setSearchType(value as typeof searchType)}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-3 mb-6 bg-muted/50 p-1 rounded-lg h-auto">
            <TabsTrigger 
              value="actor" 
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <User className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Actor/Ofendido</span>
              <span className="sm:hidden">Actor</span>
            </TabsTrigger>
            <TabsTrigger 
              value="demandado"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Users className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Demandado</span>
              <span className="sm:hidden">Demandado</span>
            </TabsTrigger>
            <TabsTrigger 
              value="proceso"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">N° Proceso</span>
              <span className="sm:hidden">Proceso</span>
            </TabsTrigger>
          </TabsList>

          {["actor", "demandado", "proceso"].map((type) => (
            <TabsContent key={type} value={type} className="mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`search-${type}`} className="sr-only">
                    {type === "actor" 
                      ? "Buscar por Actor/Ofendido" 
                      : type === "demandado"
                      ? "Buscar por Demandado/Procesado"
                      : "Buscar por Número de Proceso"
                    }
                  </Label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {getIcon()}
                    </div>
                    <Input
                      id={`search-${type}`}
                      type="text"
                      value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      placeholder={getPlaceholder()}
                      maxLength={getMaxLength()}
                      className={cn(
                        "pl-12 pr-4 h-14 text-base input-focus-ring",
                        error && "border-destructive focus:ring-destructive/30"
                      )}
                      disabled={isLoading}
                      aria-invalid={!!error}
                      aria-describedby={error ? "search-error" : "search-help"}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mt-4" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription id="search-error">{error}</AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        <p id="search-help" className="text-sm text-muted-foreground mt-4 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Para mejores resultados, ingrese letras y/o números sin caracteres especiales 
            (@,/,#, etc.), excepto (., -)
          </span>
        </p>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full mt-6 h-12 text-base font-semibold"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2" aria-hidden="true">⏳</span>
              Buscando...
            </>
          ) : (
            <>
              <Search className="w-5 h-5 mr-2" aria-hidden="true" />
              Buscar Procesos
            </>
          )}
        </Button>
      </form>
    </div>
  );
};
