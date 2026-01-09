import { useState, useEffect, useCallback } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Save,
  Send,
  FilePenLine,
  Eye,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Shield,
  AlertTriangle,
  History,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Undo,
  Redo,
  Clock,
  CheckCircle2,
  Download,
  Trash2,
  FileSignature,
} from "lucide-react";

// Servicios reales
import { decisionesService, DecisionJudicial, TipoDecision, EstadoDecision, FirmaResult, VerificacionFirma, HistorialDecision } from "@/services/decisiones.service";
import { causasService } from "@/services/causas.service";
import type { Causa } from "@/types";

const EditorDecisiones = () => {
  const { toast } = useToast();
  
  // Estados para datos reales
  const [causas, setCausas] = useState<Causa[]>([]);
  const [decisiones, setDecisiones] = useState<DecisionJudicial[]>([]);
  const [decisionActual, setDecisionActual] = useState<DecisionJudicial | null>(null);
  const [historial, setHistorial] = useState<HistorialDecision[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  
  // Estados del formulario
  const [selectedCausa, setSelectedCausa] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<TipoDecision>("AUTO");
  const [contenido, setContenido] = useState("");
  
  // Modales
  const [firmaModalOpen, setFirmaModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [verificacionModalOpen, setVerificacionModalOpen] = useState(false);
  
  // Resultado de verificación
  const [verificacionResult, setVerificacionResult] = useState<VerificacionFirma | null>(null);

  // Plantillas para cada tipo de documento
  const plantillas: Record<TipoDecision, string> = {
    AUTO: `VISTOS:
Los autos y demás constancias procesales que anteceden.

CONSIDERANDO:
[Insertar consideraciones legales y de hecho]

RESUELVE:
[Insertar resolución]

Notifíquese y cúmplase.`,
    SENTENCIA: `REPÚBLICA DEL ECUADOR
FUNCIÓN JUDICIAL

SENTENCIA

VISTOS:
[Antecedentes del caso]

CONSIDERANDO:
PRIMERO.- [Competencia]
SEGUNDO.- [Hechos probados]
TERCERO.- [Fundamentos de derecho]

FALLO:
[Decisión]

Notifíquese.`,
    PROVIDENCIA: `PROVIDENCIA

En atención a lo solicitado, se dispone:

[Contenido de la providencia]

Notifíquese.`
  };

  // ============================================================================
  // CARGA DE DATOS
  // ============================================================================

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar causas del juez
      const causasResponse = await causasService.getCausas();
      setCausas(causasResponse.data || []);

      // Cargar decisiones del juez
      const decisionesData = await decisionesService.listarMisDecisiones();
      setDecisiones(decisionesData);
    } catch (error) {
      console.error("Error cargando datos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSeleccionarDecision = async (decision: DecisionJudicial) => {
    // Si ya está seleccionada, deseleccionar y limpiar para crear nueva
    if (decisionActual?.decisionId === decision.decisionId) {
      setDecisionActual(null);
      setSelectedCausa("");
      setTipoDocumento("AUTO");
      setContenido("");
      toast({
        title: "Documento deseleccionado",
        description: "Ahora puede crear una nueva decisión.",
      });
      return;
    }

    try {
      // Cargar el detalle completo de la decisión (incluyendo contenidoBorrador)
      const decisionCompleta = await decisionesService.obtenerDecision(decision.decisionId);
      setDecisionActual(decisionCompleta);
      setSelectedCausa(decisionCompleta.causaId.toString());
      setTipoDocumento(decisionCompleta.tipoDecision);
      setContenido(decisionCompleta.contenidoBorrador || "");
    } catch (error) {
      console.error("Error al cargar decisión:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el contenido de la decisión.",
        variant: "destructive",
      });
    }
  };

  // Función para limpiar y crear nueva decisión
  const handleNuevaDecision = () => {
    setDecisionActual(null);
    setSelectedCausa("");
    setTipoDocumento("AUTO");
    setContenido("");
  };

  const handleUsarPlantilla = () => {
    setContenido(plantillas[tipoDocumento]);
    toast({
      title: "Plantilla aplicada",
      description: `Se ha cargado la plantilla de ${tipoDocumento.toLowerCase()}.`,
    });
  };

  const handleCausaChange = async (causaId: string) => {
    setSelectedCausa(causaId);
    
    // Buscar si ya existe una decisión para esta causa
    const decisionExistente = decisiones.find(d => d.causaId.toString() === causaId && d.estado === "BORRADOR");
    
    if (decisionExistente) {
      // Cargar el detalle completo de la decisión
      try {
        const decisionCompleta = await decisionesService.obtenerDecision(decisionExistente.decisionId);
        setDecisionActual(decisionCompleta);
        setTipoDocumento(decisionCompleta.tipoDecision);
        setContenido(decisionCompleta.contenidoBorrador || "");
        toast({
          title: "Borrador encontrado",
          description: "Se ha cargado un borrador existente para esta causa.",
        });
      } catch (error) {
        console.error("Error al cargar borrador:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar el borrador existente.",
          variant: "destructive",
        });
      }
    } else {
      // Si no hay borrador, preparar para crear nuevo
      setDecisionActual(null);
      setContenido("");
    }
  };

  const handleGuardarBorrador = async () => {
    if (!selectedCausa) {
      toast({
        title: "Error",
        description: "Debe seleccionar una causa.",
        variant: "destructive",
      });
      return;
    }

    if (!contenido.trim()) {
      toast({
        title: "Error",
        description: "El documento no puede estar vacío.",
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);
    try {
      if (decisionActual && decisionActual.estado === "BORRADOR") {
        // Actualizar borrador existente
        const actualizada = await decisionesService.actualizarDecision(decisionActual.decisionId, {
          contenidoBorrador: contenido,
        });

        setDecisionActual(actualizada);
        setDecisiones(prev => prev.map(d => 
          d.decisionId === actualizada.decisionId ? actualizada : d
        ));

        toast({
          title: "Borrador guardado",
          description: `Versión ${actualizada.version} guardada correctamente.`,
        });
      } else {
        // Crear nueva decisión
        const causa = causas.find(c => c.id === selectedCausa);
        const nuevaDecision = await decisionesService.crearDecision({
          causaId: parseInt(selectedCausa),
          tipoDecision: tipoDocumento,
          titulo: `${tipoDocumento} - ${causa?.numeroExpediente || "Nueva decisión"}`,
          contenidoBorrador: contenido,
        });

        setDecisiones(prev => [nuevaDecision, ...prev]);
        setDecisionActual(nuevaDecision);

        toast({
          title: "Borrador creado",
          description: "La decisión se ha creado como borrador.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  const handleMarcarListaParaFirma = async () => {
    if (!decisionActual) {
      // Si no hay decisión actual, primero guardar
      await handleGuardarBorrador();
      return;
    }

    if (decisionActual.estado !== "BORRADOR") {
      toast({
        title: "Error",
        description: "Solo se pueden marcar borradores como listos para firma.",
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);
    try {
      // Primero guardar el contenido actual
      await decisionesService.actualizarDecision(decisionActual.decisionId, {
        contenidoBorrador: contenido,
      });

      // Luego marcar como lista para firma
      const actualizada = await decisionesService.marcarListaParaFirma(decisionActual.decisionId);

      setDecisionActual(actualizada);
      setDecisiones(prev => prev.map(d => 
        d.decisionId === actualizada.decisionId ? actualizada : d
      ));

      toast({
        title: "Decisión lista para firma",
        description: "El documento está listo para ser firmado electrónicamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al marcar como lista",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  const handleIniciarFirma = () => {
    if (!decisionActual || decisionActual.estado !== "LISTA_PARA_FIRMA") {
      toast({
        title: "Error",
        description: "El documento debe estar marcado como listo para firmar.",
        variant: "destructive",
      });
      return;
    }
    setFirmaModalOpen(true);
  };

  const handleFirmar = async () => {
    if (!decisionActual) return;

    setFirmando(true);
    try {
      const resultado: FirmaResult = await decisionesService.firmarDecision(decisionActual.decisionId);

      setDecisionActual(resultado.decision);
      setDecisiones(prev => prev.map(d => 
        d.decisionId === resultado.decision.decisionId ? resultado.decision : d
      ));

      setFirmaModalOpen(false);

      toast({
        title: "✅ Documento firmado electrónicamente",
        description: `Firmado el ${new Date().toLocaleString()}. El documento ha sido vinculado al expediente.`,
      });
    } catch (error) {
      toast({
        title: "Error al firmar",
        description: error instanceof Error ? error.message : "No se pudo completar la firma",
        variant: "destructive",
      });
    } finally {
      setFirmando(false);
    }
  };

  const handleVerificarFirma = async () => {
    if (!decisionActual || decisionActual.estado !== "FIRMADA") return;

    setVerificando(true);
    try {
      const resultado = await decisionesService.verificarFirma(decisionActual.decisionId);
      setVerificacionResult(resultado);
      setVerificacionModalOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al verificar firma",
        variant: "destructive",
      });
    } finally {
      setVerificando(false);
    }
  };

  const handleVerHistorial = async () => {
    if (!decisionActual) return;

    try {
      const historialData = await decisionesService.obtenerHistorial(decisionActual.decisionId);
      setHistorial(historialData);
      setHistorialModalOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el historial",
        variant: "destructive",
      });
    }
  };

  const handleDescargarPdf = async () => {
    if (!decisionActual || decisionActual.estado !== "FIRMADA") return;

    try {
      const blob = await decisionesService.descargarPdfFirmado(decisionActual.decisionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `decision_${decisionActual.decisionId}_firmada.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el PDF",
        variant: "destructive",
      });
    }
  };

  const handleEliminarDecision = async () => {
    if (!decisionActual || decisionActual.estado !== "BORRADOR") {
      toast({
        title: "Error",
        description: "Solo se pueden eliminar decisiones en borrador.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("¿Está seguro de eliminar esta decisión?")) return;

    try {
      await decisionesService.eliminarDecision(decisionActual.decisionId);
      setDecisiones(prev => prev.filter(d => d.decisionId !== decisionActual.decisionId));
      setDecisionActual(null);
      setContenido("");
      setSelectedCausa("");

      toast({
        title: "Decisión eliminada",
        description: "La decisión ha sido eliminada.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar",
        variant: "destructive",
      });
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getEstadoBadge = (estado: EstadoDecision) => {
    switch (estado) {
      case "BORRADOR":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Borrador</Badge>;
      case "LISTA_PARA_FIRMA":
        return <Badge className="bg-warning text-warning-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Lista para firma</Badge>;
      case "FIRMADA":
        return <Badge className="bg-success text-success-foreground"><Shield className="w-3 h-3 mr-1" />Firmada</Badge>;
      case "ANULADA":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Anulada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const esEditable = !decisionActual || decisionActual.estado === "BORRADOR";
  const puedeMarcarListo = decisionActual && decisionActual.estado === "BORRADOR" && contenido.trim().length > 0;
  const puedeFirmar = decisionActual && decisionActual.estado === "LISTA_PARA_FIRMA";

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <FuncionariosLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Skeleton className="h-96 lg:col-span-1" />
            <Skeleton className="h-96 lg:col-span-3" />
          </div>
        </div>
      </FuncionariosLayout>
    );
  }

  return (
    <FuncionariosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">Editor de Decisiones</h1>
            <p className="text-muted-foreground">Elaboración y firma de autos y sentencias</p>
          </div>
          <div className="flex items-center gap-2">
            {decisionActual ? (
              <>
                {getEstadoBadge(decisionActual.estado)}
                {decisionActual.estado === "FIRMADA" && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleVerificarFirma} disabled={verificando}>
                      {verificando ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 mr-1" />
                      )}
                      Verificar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDescargarPdf}>
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  </>
                )}
                {decisionActual.estado === "BORRADOR" && (
                  <Button variant="outline" size="sm" onClick={handleEliminarDecision}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleVerHistorial}>
                  <History className="w-4 h-4 mr-1" />
                  Historial
                </Button>
              </>
            ) : (
              <Badge variant="secondary">
                <Clock className="w-3 h-3 mr-1" />
                Borrador
              </Badge>
            )}
          </div>
        </div>

        {/* Grid: Sidebar + Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar - Documentos Recientes */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Documentos Recientes</CardTitle>
              </div>
              {/* Botón Nueva Decisión */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNuevaDecision}
                className="w-full mt-2"
              >
                <FilePenLine className="w-4 h-4 mr-2" />
                Nueva Decisión
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {decisiones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay documentos recientes.
                </p>
              ) : (
                decisiones.slice(0, 8).map((decision) => {
                  const isSelected = decisionActual?.decisionId === decision.decisionId;
                  return (
                    <div
                      key={decision.decisionId}
                      onClick={() => handleSeleccionarDecision(decision)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-primary/10 border-primary ring-2 ring-primary/20" 
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium truncate ${isSelected ? "text-primary" : ""}`}>
                          {decision.titulo || `${decision.tipoDecision}_${decision.decisionId}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                          {decision.tipoDecision.toLowerCase()}
                        </Badge>
                        {decision.estado === "FIRMADA" && (
                          <Shield className="w-3 h-3 text-success" />
                        )}
                        {isSelected && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            (click para deseleccionar)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Editor Principal */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Selectores de Causa y Tipo */}
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Causa</Label>
                    <Select value={selectedCausa} onValueChange={handleCausaChange} disabled={!esEditable}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar causa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {causas.map((causa) => (
                          <SelectItem key={causa.id} value={causa.id}>
                            {causa.numeroExpediente} - {causa.materia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <Select value={tipoDocumento} onValueChange={(v) => setTipoDocumento(v as TipoDecision)} disabled={!esEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO">Auto</SelectItem>
                        <SelectItem value="SENTENCIA">Sentencia</SelectItem>
                        <SelectItem value="PROVIDENCIA">Providencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Botón Usar Plantilla */}
                <Button variant="outline" onClick={handleUsarPlantilla} disabled={!esEditable}>
                  <FileText className="w-4 h-4 mr-2" />
                  Usar Plantilla
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Toolbar de formato */}
              <div className="flex items-center gap-1 p-2 border rounded-lg bg-muted/30">
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <Undo className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <Redo className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <Bold className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <Italic className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <Underline className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <AlignLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <AlignCenter className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <AlignRight className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <List className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!esEditable}>
                  <ListOrdered className="w-4 h-4" />
                </Button>
              </div>

              {/* Textarea del contenido */}
              <Textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Escriba el contenido del documento aquí..."
                className="min-h-[550px] h-[60vh] font-mono text-sm resize-y"
                disabled={!esEditable}
              />

              {/* Badge de documento firmado */}
              {decisionActual?.estado === "FIRMADA" && (
                <div className="p-4 rounded-lg border-2 border-success/30 bg-success/5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-success/20">
                      <Shield className="w-6 h-6 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-success">Documento Firmado Electrónicamente</p>
                      <p className="text-sm text-muted-foreground">
                        Firmado: {decisionActual.fechaFirma ? new Date(decisionActual.fechaFirma).toLocaleString() : "N/A"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Este documento cumple con la Ley de Comercio Electrónico y es legalmente vinculante.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                {/* Izquierda: Guardar y Vista Previa */}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGuardarBorrador} disabled={guardando || !esEditable}>
                    {guardando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar Borrador
                  </Button>
                  <Button variant="outline" onClick={() => setPreviewModalOpen(true)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Vista Previa
                  </Button>
                </div>

                {/* Derecha: Marcar Listo y Firmar */}
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={handleMarcarListaParaFirma} 
                    disabled={guardando || !puedeMarcarListo}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Marcar como Listo
                  </Button>
                  <Button 
                    className="bg-success hover:bg-success/90 text-success-foreground"
                    onClick={handleIniciarFirma}
                    disabled={!puedeFirmar}
                  >
                    <FilePenLine className="w-4 h-4 mr-2" />
                    Firmar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal: Vista Previa */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa del Documento</DialogTitle>
          </DialogHeader>
          <div className="p-6 border rounded-lg bg-white text-black">
            <h2 className="text-center font-bold text-lg mb-4">
              {tipoDocumento} - {causas.find(c => c.id === selectedCausa)?.numeroExpediente || "Sin causa"}
            </h2>
            <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
              {contenido || "El documento está vacío."}
            </pre>
            {decisionActual?.estado === "FIRMADA" && (
              <div className="mt-8 pt-4 border-t border-dashed">
                <div className="flex items-center gap-2 text-green-700">
                  <Shield className="w-5 h-5" />
                  <span className="font-semibold">FIRMADO ELECTRÓNICAMENTE</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Este documento ha sido firmado electrónicamente conforme a la Ley de Comercio Electrónico, Firmas y Mensajes de Datos.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Fecha de firma: {decisionActual.fechaFirma ? new Date(decisionActual.fechaFirma).toLocaleString() : "N/A"}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Firma */}
      <Dialog open={firmaModalOpen} onOpenChange={setFirmaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5" />
              Firma Electrónica con Certificado PKI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">Acción Irreversible</p>
                  <p className="text-sm text-muted-foreground">
                    Una vez firmado, el documento quedará sellado con su certificado digital y no podrá ser modificado.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2">Información de firma:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Algoritmo: SHA256 con RSA</li>
                <li>• Certificado: PKI del sistema judicial</li>
                <li>• Tipo: {tipoDocumento}</li>
                <li>• Causa: {causas.find(c => c.id === selectedCausa)?.numeroExpediente || "N/A"}</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              Al hacer clic en "Confirmar Firma", el sistema aplicará su firma electrónica utilizando el certificado PKI del servidor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirmaModalOpen(false)} disabled={firmando}>
              Cancelar
            </Button>
            <Button onClick={handleFirmar} disabled={firmando} className="bg-success hover:bg-success/90">
              {firmando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Firmando...
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4 mr-2" />
                  Confirmar Firma
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial */}
      <Dialog open={historialModalOpen} onOpenChange={setHistorialModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historial de Cambios
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {historial.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay historial disponible.</p>
            ) : (
              <div className="space-y-3">
                {historial.map((item) => (
                  <div key={item.historialId} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Versión {item.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.fechaCambio).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{item.estadoAnterior}</Badge>
                      <span>→</span>
                      <Badge>{item.estadoNuevo}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.descripcionCambio}</p>
                    <p className="text-xs text-muted-foreground mt-1">Por: {item.usuarioPseudonimo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Verificación de Firma */}
      <Dialog open={verificacionModalOpen} onOpenChange={setVerificacionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {verificacionResult?.valida ? (
                <ShieldCheck className="w-5 h-5 text-success" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-destructive" />
              )}
              Verificación de Firma
            </DialogTitle>
          </DialogHeader>
          {verificacionResult && (
            <div className="space-y-4 py-4">
              <div className={`p-4 rounded-lg ${verificacionResult.valida ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"} border`}>
                <p className={`font-semibold ${verificacionResult.valida ? "text-success" : "text-destructive"}`}>
                  {verificacionResult.valida ? "✅ Firma válida" : "❌ Firma inválida"}
                </p>
                <p className="text-sm text-muted-foreground">{verificacionResult.mensaje}</p>
              </div>

              {verificacionResult.detalles && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Firmante:</span>
                    <span>{verificacionResult.detalles.firmante}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Certificado válido:</span>
                    <span>{verificacionResult.detalles.certificadoValido ? "Sí" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha de firma:</span>
                    <span>{new Date(verificacionResult.detalles.fechaFirma).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hash coincide:</span>
                    <span className={verificacionResult.detalles.hashCoincide ? "text-success" : "text-destructive"}>
                      {verificacionResult.detalles.hashCoincide ? "✅ Sí" : "❌ No"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FuncionariosLayout>
  );
};

export default EditorDecisiones;
