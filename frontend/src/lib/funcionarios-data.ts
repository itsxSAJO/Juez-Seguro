// ============================================================================
// JUEZ SEGURO - Adaptador de Datos para Funcionarios
// Permite alternar entre datos mock (desarrollo) y API real (producción)
// ============================================================================

import {
  causasService,
  documentosService,
  audienciasService,
  notificacionesService,
  usuariosService,
  auditoriaService,
} from "@/services";
import type {
  Causa,
  CausaDetalle,
  Documento,
  Audiencia,
  Notificacion,
  Usuario,
  LogAuditoria,
} from "@/types";

// Re-exportar tipos para compatibilidad
export type { Causa, Documento, Audiencia, Notificacion, LogAuditoria } from "@/types";

// Tipo de funcionario (compatible con el anterior)
export interface Funcionario extends Usuario {
  fechaCreacion: string;
  ultimoAcceso: string;
}

// Determina si usar datos mock o API real
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

// ============================================================================
// DATOS MOCK (para desarrollo sin backend)
// ============================================================================

const generateDate = (daysAgo: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
};

const generateDateTime = (daysAgo: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const materias = ["Civil", "Penal", "Laboral", "Familia", "Tránsito"];
const tiposAccion = ["Ordinario", "Sumario", "Ejecutivo", "Especial"];
const unidadesJudiciales = [
  "Unidad Judicial Civil de Quito",
  "Unidad Judicial Penal de Guayaquil",
  "Unidad Judicial de Familia de Cuenca",
];
const salas = ["Sala 1A", "Sala 2B", "Sala Virtual 1", "Sala de Audiencias Principal"];

// Mock funcionarios base
export const mockFuncionarios: Funcionario[] = [
  {
    id: "1",
    nombre: "Dr. María García López",
    identificacion: "1712345678",
    cargo: "cj",
    unidadJudicial: "Consejo de la Judicatura",
    materia: "Administración",
    email: "cj@judicatura.gob.ec",
    estado: "activa",
    fechaCreacion: "2023-01-15",
    ultimoAcceso: generateDateTime(0),
    intentosFallidos: 0,
  },
  {
    id: "2",
    nombre: "Dr. Carlos Mendoza Ruiz",
    identificacion: "0912345678",
    cargo: "juez",
    unidadJudicial: "Unidad Judicial Civil de Quito",
    materia: "Civil",
    email: "juez@judicatura.gob.ec",
    estado: "activa",
    fechaCreacion: "2023-02-20",
    ultimoAcceso: generateDateTime(1),
    intentosFallidos: 0,
  },
  {
    id: "3",
    nombre: "Lic. Ana Martínez Silva",
    identificacion: "0612345678",
    cargo: "secretario",
    unidadJudicial: "Unidad Judicial Penal de Guayaquil",
    materia: "Penal",
    email: "secretario@judicatura.gob.ec",
    estado: "activa",
    fechaCreacion: "2023-03-10",
    ultimoAcceso: generateDateTime(0),
    intentosFallidos: 0,
  },
];

// Generadores mock - Use UUID-like IDs to avoid duplicates
let causaIdCounter = 0;
const generateMockCausas = (count: number = 30): Causa[] => {
  const estados: Causa["estado"][] = ["en_tramite", "resuelto", "archivado", "suspendido"];
  const estadosProcesales = ["Calificación", "Citación", "Contestación", "Audiencia", "Sentencia"];
  const prioridades: Causa["prioridad"][] = ["normal", "urgente", "alta"];

  return Array.from({ length: count }, (_, i) => {
    causaIdCounter++;
    return {
      id: `causa-${causaIdCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      numeroExpediente: `17${100 + i}-2024-${String(i + 1).padStart(5, "0")}A`,
      materia: materias[i % materias.length],
      tipoAccion: tiposAccion[i % tiposAccion.length],
      unidadJudicial: unidadesJudiciales[i % unidadesJudiciales.length],
      // Partes procesales (información pública)
      actorNombre: `Actor Mock ${100 + i}`,
      demandadoNombre: `Demandado Mock ${200 + i}`,
      // Funcionarios
      juezAsignadoId: "2",
      juezAsignadoNombre: mockFuncionarios[1].nombre,
      estado: estados[i % estados.length],
      estadoProcesal: estadosProcesales[i % estadosProcesales.length],
      fechaIngreso: generateDate(Math.floor(Math.random() * 365)),
      fechaActualizacion: generateDate(Math.floor(Math.random() * 30)),
      prioridad: prioridades[i % prioridades.length],
    };
  });
};

const generateMockAudiencias = (count: number = 20): Audiencia[] => {
  const tipos: Audiencia["tipo"][] = ["inicial", "evaluacion", "juicio", "resolucion"];
  const estados: Audiencia["estado"][] = ["programada", "realizada", "reprogramada", "cancelada"];
  const causas = generateMockCausas(count);

  return Array.from({ length: count }, (_, i) => ({
    id: `aud-${i + 1}`,
    causaId: causas[i % causas.length].id,
    numeroExpediente: causas[i % causas.length].numeroExpediente,
    tipo: tipos[i % tipos.length],
    fecha: generateDate(-Math.floor(Math.random() * 60) + 30),
    hora: `${8 + (i % 8)}:00`,
    sala: salas[i % salas.length],
    estado: estados[i % estados.length],
    partes: ["Actor", "Demandado"],
    notas: "Audiencia programada según calendario judicial.",
    historialCambios: [],
  }));
};

const generateMockDocumentos = (count: number = 25): Documento[] => {
  const tipos: Documento["tipo"][] = ["escrito", "providencia", "auto", "sentencia", "anexo"];
  const estados: Documento["estado"][] = ["borrador", "pendiente", "firmado", "notificado"];
  const causas = generateMockCausas(10);

  return Array.from({ length: count }, (_, i) => ({
    id: `doc-${i + 1}`,
    causaId: causas[i % causas.length].id,
    nombre: `${tipos[i % tipos.length].toUpperCase()}_${i + 1}.pdf`,
    tipo: tipos[i % tipos.length],
    formato: "pdf",
    tamano: `${100 + i * 50} KB`,
    fechaSubida: generateDateTime(i),
    subidoPor: mockFuncionarios[i % mockFuncionarios.length].nombre,
    hashIntegridad: `SHA256:${Math.random().toString(16).slice(2, 18)}`,
    estado: estados[i % estados.length],
  }));
};

const generateMockNotificaciones = (count: number = 15): Notificacion[] => {
  const tipos: Notificacion["tipo"][] = ["citacion", "notificacion", "emplazamiento", "recordatorio"];
  const medios: Notificacion["medio"][] = ["electronico", "fisico", "judicial"];
  const estados: Notificacion["estado"][] = ["enviada", "recibida", "vencida", "pendiente"];
  const causas = generateMockCausas(10);

  return Array.from({ length: count }, (_, i) => ({
    id: `notif-${i + 1}`,
    causaId: causas[i % causas.length].id,
    tipo: tipos[i % tipos.length],
    destinatario: `Parte ${i + 1}`,
    medio: medios[i % medios.length],
    fechaEnvio: generateDate(i),
    fechaLimite: generateDate(-i - 5),
    estado: estados[i % estados.length],
  }));
};

const generateMockLogs = (count: number = 50): LogAuditoria[] => {
  const acciones = ["LOGIN", "LOGOUT", "CREAR_CAUSA", "EDITAR_CAUSA", "SUBIR_DOCUMENTO"];
  const modulos = ["Autenticación", "Causas", "Documentos", "Audiencias"];
  const resultados: LogAuditoria["resultado"][] = ["exito", "error", "denegado"];

  return Array.from({ length: count }, (_, i) => ({
    id: `log-${i + 1}`,
    usuario: mockFuncionarios[i % mockFuncionarios.length].email,
    accion: acciones[i % acciones.length],
    modulo: modulos[i % modulos.length],
    detalle: "Operación realizada en el sistema.",
    ip: `192.168.1.${100 + i}`,
    fecha: generateDateTime(i),
    resultado: resultados[i % resultados.length],
  })).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};

// ============================================================================
// FUNCIONES EXPORTADAS (usan mock o API según configuración)
// ============================================================================

// Mapeo de roles del backend al frontend
const rolNombreToCargoMap: Record<string, "cj" | "juez" | "secretario"> = {
  ADMIN_CJ: "cj",
  JUEZ: "juez",
  SECRETARIO: "secretario",
};

// Mapeo de estados del backend al frontend
const estadoBackendToFrontendMap: Record<string, "activa" | "suspendida" | "inactiva" | "habilitable" | "bloqueada"> = {
  ACTIVA: "activa",
  HABILITABLE: "habilitable",
  SUSPENDIDA: "suspendida",
  INACTIVA: "inactiva",
  BLOQUEADA: "bloqueada",
};

export const getFuncionarios = async (): Promise<Funcionario[]> => {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return mockFuncionarios;
  }

  const response = await usuariosService.getUsuarios();
  // Mapear los campos del backend al formato esperado por el frontend
  return response.data.map((u: any) => ({
    id: u.funcionarioId?.toString() || u.id?.toString() || "",
    nombre: u.nombresCompletos || u.nombre || "",
    identificacion: u.identificacion || "",
    cargo: rolNombreToCargoMap[u.rolNombre] || u.cargo || "secretario",
    unidadJudicial: u.unidadJudicial || "",
    materia: u.materia || "",
    email: u.correoInstitucional || u.email || "",
    estado: estadoBackendToFrontendMap[u.estado] || u.estado || "activa",
    fechaCreacion: u.fechaCreacion || "",
    ultimoAcceso: u.ultimoAcceso || u.fechaActualizacion || "",
    intentosFallidos: u.intentosFallidos || 0,
  }));
};

export const getCausas = async (): Promise<Causa[]> => {
  // Siempre usar API real
  const response = await causasService.getCausas();
  return response.data;
};

export const getCausaById = async (id: string): Promise<Causa | null> => {
  // Siempre usar API real
  try {
    return await causasService.getCausaById(id);
  } catch {
    return null;
  }
};

export const getAudiencias = async (): Promise<Audiencia[]> => {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return generateMockAudiencias(20);
  }

  const response = await audienciasService.getAudiencias();
  return response.data;
};

export const getDocumentos = async (causaId?: string): Promise<Documento[]> => {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    const docs = generateMockDocumentos(25);
    return causaId ? docs.filter((d) => d.causaId === causaId) : docs;
  }

  const response = await documentosService.getDocumentos({ causaId });
  return response.data;
};

export const getNotificaciones = async (): Promise<Notificacion[]> => {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return generateMockNotificaciones(15);
  }

  const response = await notificacionesService.getNotificaciones();
  return response.data;
};

export const getLogs = async (): Promise<LogAuditoria[]> => {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return generateMockLogs(50);
  }

  const response = await auditoriaService.getLogs();
  
  // Mapear los datos del backend al formato esperado por el frontend
  return response.data.map((log: any) => ({
    id: log.log_id?.toString() || "",
    usuario: log.usuario_correo || log.datos_afectados?.correo || `ID: ${log.usuario_id || "Sistema"}`,
    accion: log.tipo_evento || "",
    modulo: log.modulo_afectado || "SISTEMA",
    detalle: log.descripcion_evento || "",
    ip: log.ip_origen || "desconocida",
    fecha: log.fecha_evento || "",
    resultado: mapearResultado(log.tipo_evento),
  }));
};

// Función auxiliar para mapear el tipo de evento a resultado
const mapearResultado = (tipoEvento: string): "exito" | "error" | "denegado" => {
  if (!tipoEvento) return "exito";
  const tipo = tipoEvento.toLowerCase();
  if (tipo.includes("error") || tipo.includes("fallido")) return "error";
  if (tipo.includes("denegado") || tipo.includes("rechazado") || tipo.includes("acceso_denegado")) return "denegado";
  return "exito";
};

// Alias para compatibilidad con código existente
export const generateMockCausas_compat = generateMockCausas;
export const generateMockAudiencias_compat = generateMockAudiencias;
export const generateMockDocumentos_compat = generateMockDocumentos;
export const generateMockNotificaciones_compat = generateMockNotificaciones;
export const generateMockLogs_compat = generateMockLogs;
