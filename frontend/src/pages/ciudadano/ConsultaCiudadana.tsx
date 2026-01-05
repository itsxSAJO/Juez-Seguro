import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { SearchForm, SearchFormData } from "@/components/search/SearchForm";
import { ResultsTable, JudicialProcess } from "@/components/search/ResultsTable";
import { PaginationControls } from "@/components/search/PaginationControls";
import { EmptyState } from "@/components/search/EmptyState";
import { searchProcesses } from "@/lib/data";
import { Shield, FileText, Users, Lock } from "lucide-react";
import { useCallback, useMemo } from "react";

const ConsultaCiudadana = () => {
  const [results, setResults] = useState<JudicialProcess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSearch = useCallback(async (data: SearchFormData) => {
    setIsLoading(true);
    setHasSearched(true);
    setLastQuery(data.query);
    setCurrentPage(1);

    try {
      const searchResults = await searchProcesses(data.query, data.searchType);
      setResults(searchResults);
    } catch (error) {
      console.error("Error searching processes:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setResults([]);
    setHasSearched(false);
    setLastQuery("");
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return results.slice(start, end);
  }, [results, currentPage, pageSize]);

  const totalPages = Math.ceil(results.length / pageSize);

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/5 via-background to-background py-8 md:py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-8 md:mb-12 animate-fade-in">
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Consulta de Procesos Judiciales
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Sistema E-SATJE 2020 - Consulta electrónica de procesos judiciales del Ecuador
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8 md:mb-12 animate-slide-up">
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-full border border-border shadow-sm">
              <Shield className="w-4 h-4 text-success" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Identidad Protegida</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-full border border-border shadow-sm">
              <FileText className="w-4 h-4 text-info" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Documentos Públicos</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-full border border-border shadow-sm">
              <Lock className="w-4 h-4 text-warning" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Datos Anonimizados</span>
            </div>
          </div>

          <div className="max-w-3xl mx-auto animate-scale-in" style={{ animationDelay: "100ms" }}>
            <SearchForm onSearch={handleSearch} isLoading={isLoading} />
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section id="results-section" className="py-8 md:py-12" aria-label="Resultados de búsqueda">
        <div className="container mx-auto px-4">
          {isLoading && <ResultsTable results={[]} isLoading={true} />}

          {!isLoading && !hasSearched && <EmptyState type="initial" />}

          {!isLoading && hasSearched && results.length === 0 && (
            <EmptyState type="no-results" searchQuery={lastQuery} onReset={handleReset} />
          )}

          {!isLoading && hasSearched && results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg md:text-xl font-semibold text-foreground">
                  {results.length} {results.length === 1 ? "proceso encontrado" : "procesos encontrados"}
                </h2>
              </div>

              <ResultsTable results={paginatedResults} />

              {totalPages > 1 && (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalResults={results.length}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 md:py-16 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3">
              Sistema Juez Seguro
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Protección de identidad judicial conforme a las políticas FIA y FDP
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-success" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
                Anonimización Controlada
              </h3>
              <p className="text-sm text-muted-foreground">
                Los identificadores de actores judiciales son códigos únicos e irrepetibles que protegen la identidad real de los funcionarios.
              </p>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-info" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
                Transparencia Procesal
              </h3>
              <p className="text-sm text-muted-foreground">
                Los documentos y resoluciones judiciales mantienen su carácter público, asegurando la transparencia del proceso.
              </p>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-warning" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
                Seguridad Reforzada
              </h3>
              <p className="text-sm text-muted-foreground">
                Implementación de políticas FIA (Identificación y Autenticación) y FDP (Protección de Datos) para máxima seguridad.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default ConsultaCiudadana;
