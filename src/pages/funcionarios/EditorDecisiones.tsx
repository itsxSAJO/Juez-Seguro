import { useState } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Save,
  Send,
  FileSignature,
  Eye,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Undo,
  Redo,
  CheckCircle2,
  Clock,
  Shield,
  Key,
  AlertTriangle,
} from "lucide-react";
import { generateMockCausas, generateMockDocumentos, Documento } from "@/lib/mockFuncionarios";

const EditorDecisiones = () => {
  const { toast } = useToast();
  const [causas] = useState(generateMockCausas(10));
  const [documentos] = useState<Documento[]>(generateMockDocumentos(20).filter(d => ["auto", "sentencia", "providencia"].includes(d.tipo)));
  
  const [selectedCausa, setSelectedCausa] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"auto" | "sentencia" | "providencia">("auto");
  const [contenido, setContenido] = useState("");
  const [estadoDocumento, setEstadoDocumento] = useState<"borrador" | "listo" | "firmado">("borrador");
  const [firmaModalOpen, setFirmaModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [pinFirma, setPinFirma] = useState("");
  const [firmando, setFirmando] = useState(false);

  const plantillas = {
    auto: `VISTOS:
Los autos y demás constancias procesales que anteceden.

CONSIDERANDO:
[Insertar consideraciones legales y de hecho]

RESUELVE:
[Insertar resolución]

Notifíquese y cúmplase.`,
    sentencia: `REPÚBLICA DEL ECUADOR
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
    providencia: `PROVIDENCIA

En atención a lo solicitado, se dispone:

[Contenido de la providencia]

Notifíquese.`
  };

  const handleUsarPlantilla = () => {
    setContenido(plantillas[tipoDocumento]);
    toast({
      title: "Plantilla aplicada",
      description: `Se ha cargado la plantilla de ${tipoDocumento}.`,
    });
  };

  const handleGuardarBorrador = () => {
    toast({
      title: "Borrador guardado",
      description: "El documento se ha guardado como borrador.",
    });
    setEstadoDocumento("borrador");
  };

  const handleMarcarListo = () => {
    if (!contenido.trim()) {
      toast({
        title: "Error",
        description: "El documento no puede estar vacío.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Documento listo",
      description: "El documento está listo para firma.",
    });
    setEstadoDocumento("listo");
  };

  const handleIniciarFirma = () => {
    if (estadoDocumento !== "listo") {
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
    if (pinFirma.length < 4) {
      toast({
        title: "PIN inválido",
        description: "Ingrese un PIN válido de al menos 4 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setFirmando(true);
    
    // Simulate signing process
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setFirmando(false);
    setFirmaModalOpen(false);
    setPinFirma("");
    setEstadoDocumento("firmado");
    
    toast({
      title: "Documento firmado",
      description: "La firma electrónica se ha aplicado correctamente.",
    });
  };

  const getEstadoBadge = () => {
    switch (estadoDocumento) {
      case "borrador":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Borrador</Badge>;
      case "listo":
        return <Badge className="bg-warning text-warning-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Listo para firma</Badge>;
      case "firmado":
        return <Badge className="bg-success text-success-foreground"><Shield className="w-3 h-3 mr-1" />Firmado</Badge>;
    }
  };

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
            {getEstadoBadge()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Documentos recientes */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Documentos Recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documentos.slice(0, 6).map((doc) => (
                <div
                  key={doc.id}
                  className="p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{doc.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{doc.tipo}</Badge>
                    {doc.estado === "firmado" && (
                      <Shield className="w-3 h-3 text-success" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Editor principal */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Causa</Label>
                    <Select value={selectedCausa} onValueChange={setSelectedCausa}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar causa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {causas.slice(0, 10).map((causa) => (
                          <SelectItem key={causa.id} value={causa.id}>
                            {causa.numeroExpediente}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <Select value={tipoDocumento} onValueChange={(v) => setTipoDocumento(v as typeof tipoDocumento)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="sentencia">Sentencia</SelectItem>
                        <SelectItem value="providencia">Providencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="outline" onClick={handleUsarPlantilla}>
                  <FileText className="w-4 h-4 mr-2" />
                  Usar Plantilla
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toolbar */}
              <div className="flex items-center gap-1 p-2 border rounded-lg bg-muted/30">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Undo className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Redo className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Bold className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Italic className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Underline className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <AlignLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <AlignCenter className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <AlignRight className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <List className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ListOrdered className="w-4 h-4" />
                </Button>
              </div>

              {/* Editor textarea */}
              <Textarea
                placeholder="Escriba el contenido del documento aquí..."
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                disabled={estadoDocumento === "firmado"}
              />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleGuardarBorrador}
                    disabled={estadoDocumento === "firmado"}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Borrador
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPreviewModalOpen(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Vista Previa
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleMarcarListo}
                    disabled={estadoDocumento === "firmado" || estadoDocumento === "listo"}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Marcar como Listo
                  </Button>
                  <Button
                    onClick={handleIniciarFirma}
                    disabled={estadoDocumento !== "listo"}
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <FileSignature className="w-4 h-4 mr-2" />
                    Firmar
                  </Button>
                </div>
              </div>

              {/* Signed document badge */}
              {estadoDocumento === "firmado" && (
                <div className="p-4 rounded-lg border-2 border-success/30 bg-success/5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-success/20">
                      <Shield className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="font-semibold text-success">Documento Firmado Electrónicamente</p>
                      <p className="text-sm text-muted-foreground">
                        Hash: SHA256:a1b2c3d4e5f6...  •  Fecha: {new Date().toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa del Documento</DialogTitle>
          </DialogHeader>
          <div className="p-6 border rounded-lg bg-white text-black">
            <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
              {contenido || "El documento está vacío."}
            </pre>
            {estadoDocumento === "firmado" && (
              <div className="mt-8 pt-4 border-t border-dashed">
                <div className="flex items-center gap-2 text-green-700">
                  <Shield className="w-5 h-5" />
                  <span className="font-semibold">FIRMADO ELECTRÓNICAMENTE</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Este documento ha sido firmado electrónicamente conforme a la Ley de Comercio Electrónico, Firmas y Mensajes de Datos.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Firma Modal */}
      <Dialog open={firmaModalOpen} onOpenChange={setFirmaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Firma Electrónica
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">Acción Irreversible</p>
                  <p className="text-sm text-muted-foreground">
                    Una vez firmado, el documento no podrá ser modificado. Asegúrese de revisar el contenido antes de firmar.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ingrese su PIN de firma</Label>
              <Input
                type="password"
                placeholder="••••••"
                value={pinFirma}
                onChange={(e) => setPinFirma(e.target.value)}
                maxLength={8}
              />
              <p className="text-xs text-muted-foreground">
                El PIN está asociado a su certificado digital.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirmaModalOpen(false)} disabled={firmando}>
              Cancelar
            </Button>
            <Button onClick={handleFirmar} disabled={firmando} className="bg-success hover:bg-success/90">
              {firmando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
    </FuncionariosLayout>
  );
};

export default EditorDecisiones;
