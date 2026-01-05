import { FileQuestion, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type: "initial" | "no-results";
  searchQuery?: string;
  onReset?: () => void;
}

export const EmptyState = ({ type, searchQuery, onReset }: EmptyStateProps) => {
  if (type === "initial") {
    return (
      <div 
        className="card-search p-8 md:p-12 text-center animate-fade-in"
        role="status"
        aria-label="Ingrese un término de búsqueda"
      >
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Search className="w-10 h-10 text-primary" aria-hidden="true" />
          </div>
        </div>
        <h2 className="font-heading text-xl md:text-2xl font-semibold text-foreground mb-3">
          Consulta de Procesos Judiciales
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
          Utilice el formulario de búsqueda para consultar procesos judiciales por actor/ofendido, 
          demandado/procesado o número de expediente.
        </p>
        <div className="mt-6 p-4 bg-info-muted rounded-lg max-w-lg mx-auto">
          <p className="text-sm text-info">
            <strong>Nota:</strong> Los identificadores de actores judiciales se muestran de forma 
            anonimizada para proteger su privacidad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="card-search p-8 md:p-12 text-center animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-warning-muted flex items-center justify-center">
          <FileQuestion className="w-10 h-10 text-warning" aria-hidden="true" />
        </div>
      </div>
      <h2 className="font-heading text-xl md:text-2xl font-semibold text-foreground mb-3">
        No se encontraron resultados
      </h2>
      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-6">
        No se encontraron procesos judiciales para la búsqueda: {" "}
        <span className="font-semibold text-foreground">"{searchQuery}"</span>
      </p>
      
      <div className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg text-left max-w-md mx-auto">
          <p className="text-sm font-medium text-foreground mb-2">Sugerencias:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Verifique que los datos ingresados sean correctos</li>
            <li>Intente con menos caracteres o palabras</li>
            <li>Use el número de cédula o RUC sin guiones</li>
            <li>Pruebe con el formato de número de proceso correcto</li>
          </ul>
        </div>
        
        {onReset && (
          <Button variant="outline" onClick={onReset} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Nueva búsqueda
          </Button>
        )}
      </div>
    </div>
  );
};
