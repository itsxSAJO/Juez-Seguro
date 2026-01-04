import { useState, useCallback } from "react";
import { FuncionariosLayout } from "@/components/funcionarios/FuncionariosLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  FileCheck,
  AlertCircle,
  X,
  File,
  CheckCircle2,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { generateMockDocumentos, Documento, generateMockCausas } from "@/lib/mockFuncionarios";

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  hash?: string;
}

const GestionDocumentos = () => {
  const { toast } = useToast();
  const [documentos] = useState<Documento[]>(generateMockDocumentos(20));
  const [causas] = useState(generateMockCausas(10));
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");

  // Upload form state
  const [selectedCausa, setSelectedCausa] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [partePresenta, setPartePresenta] = useState("");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): boolean => {
    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de archivo no válido",
        description: "Solo se permiten archivos PDF y DOCX.",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        title: "Archivo muy grande",
        description: "El tamaño máximo permitido es 10MB.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const simulateUpload = (file: File) => {
    const uploadId = `upload-${Date.now()}-${Math.random()}`;
    
    setUploadingFiles((prev) => [
      ...prev,
      { id: uploadId, file, progress: 0, status: "uploading" },
    ]);

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Generate mock hash
        const hash = `SHA256:${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
        
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadId ? { ...f, progress: 100, status: "success", hash } : f
          )
        );
      } else {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadId ? { ...f, progress } : f))
        );
      }
    }, 200);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        if (validateFile(file)) {
          simulateUpload(file);
        }
      });
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => {
        if (validateFile(file)) {
          simulateUpload(file);
        }
      });
    }
  };

  const removeUploadingFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmitDocuments = () => {
    if (!selectedCausa || !tipoDocumento || !partePresenta) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete todos los campos del formulario.",
        variant: "destructive",
      });
      return;
    }

    const successFiles = uploadingFiles.filter((f) => f.status === "success");
    if (successFiles.length === 0) {
      toast({
        title: "Sin archivos",
        description: "Por favor suba al menos un archivo.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Documentos registrados",
      description: `${successFiles.length} documento(s) se han incorporado al expediente.`,
    });

    setUploadModalOpen(false);
    setUploadingFiles([]);
    setSelectedCausa("");
    setTipoDocumento("");
    setPartePresenta("");
  };

  const filteredDocumentos = documentos.filter((doc) => {
    const matchesSearch = doc.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTipo = filterTipo === "todos" || doc.tipo === filterTipo;
    const matchesEstado = filterEstado === "todos" || doc.estado === filterEstado;
    return matchesSearch && matchesTipo && matchesEstado;
  });

  const getEstadoBadge = (estado: Documento["estado"]) => {
    switch (estado) {
      case "firmado":
        return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Firmado</Badge>;
      case "pendiente":
        return <Badge className="bg-warning text-warning-foreground"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case "borrador":
        return <Badge variant="secondary">Borrador</Badge>;
      case "notificado":
        return <Badge className="bg-info text-info-foreground">Notificado</Badge>;
    }
  };

  return (
    <FuncionariosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">Gestión de Documentos</h1>
            <p className="text-muted-foreground">Incorporación de escritos y documentos al expediente</p>
          </div>
          <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Subir Documento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Incorporar Documento al Expediente</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Metadatos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Causa / Expediente *</Label>
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
                    <Label>Tipo de Documento *</Label>
                    <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="escrito">Escrito</SelectItem>
                        <SelectItem value="anexo">Anexo</SelectItem>
                        <SelectItem value="providencia">Providencia</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="sentencia">Sentencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Parte que Presenta *</Label>
                    <Select value={partePresenta} onValueChange={setPartePresenta}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar parte..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="actor">Actor / Demandante</SelectItem>
                        <SelectItem value="demandado">Demandado / Procesado</SelectItem>
                        <SelectItem value="tercero">Tercero Interesado</SelectItem>
                        <SelectItem value="judicatura">Judicatura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Drag & Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.docx"
                    multiple
                    onChange={handleFileInput}
                  />
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-1">
                      Arrastre archivos aquí o haga clic para seleccionar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Formatos permitidos: PDF, DOCX • Tamaño máximo: 10MB
                    </p>
                  </div>
                </div>

                {/* Uploading Files */}
                {uploadingFiles.length > 0 && (
                  <div className="space-y-3">
                    <Label>Archivos seleccionados</Label>
                    {uploadingFiles.map((uploadFile) => (
                      <div
                        key={uploadFile.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="p-2 rounded bg-background">
                          {uploadFile.status === "success" ? (
                            <FileCheck className="w-5 h-5 text-success" />
                          ) : uploadFile.status === "error" ? (
                            <AlertCircle className="w-5 h-5 text-destructive" />
                          ) : (
                            <File className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadFile.file.size / 1024).toFixed(1)} KB
                            {uploadFile.hash && (
                              <span className="ml-2 font-mono text-success">
                                ✓ {uploadFile.hash.slice(0, 20)}...
                              </span>
                            )}
                          </p>
                          {uploadFile.status === "uploading" && (
                            <Progress value={uploadFile.progress} className="h-1 mt-1" />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => removeUploadingFile(uploadFile.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmitDocuments}>
                  <FileCheck className="w-4 h-4 mr-2" />
                  Incorporar al Expediente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{documentos.length}</div>
              <p className="text-sm text-muted-foreground">Total Documentos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-success">
                {documentos.filter((d) => d.estado === "firmado").length}
              </div>
              <p className="text-sm text-muted-foreground">Firmados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-warning">
                {documentos.filter((d) => d.estado === "pendiente").length}
              </div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-info">
                {documentos.filter((d) => d.estado === "notificado").length}
              </div>
              <p className="text-sm text-muted-foreground">Notificados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="escrito">Escrito</SelectItem>
              <SelectItem value="providencia">Providencia</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="sentencia">Sentencia</SelectItem>
              <SelectItem value="anexo">Anexo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="firmado">Firmado</SelectItem>
              <SelectItem value="notificado">Notificado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Documents Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Documento</th>
                    <th className="text-left p-4 font-medium">Tipo</th>
                    <th className="text-left p-4 font-medium">Fecha</th>
                    <th className="text-left p-4 font-medium">Subido por</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                    <th className="text-left p-4 font-medium">Integridad</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocumentos.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{doc.nombre}</span>
                          <Badge variant="outline" className="text-xs">{doc.formato.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{doc.tamano}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{doc.tipo}</Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {format(new Date(doc.fechaSubida), "dd/MM/yyyy HH:mm", { locale: es })}
                      </td>
                      <td className="p-4 text-sm">{doc.subidoPor}</td>
                      <td className="p-4">{getEstadoBadge(doc.estado)}</td>
                      <td className="p-4">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {doc.hashIntegridad.slice(0, 16)}...
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </FuncionariosLayout>
  );
};

export default GestionDocumentos;
