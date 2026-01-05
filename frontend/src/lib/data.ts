// ============================================================================
// JUEZ SEGURO - Adaptador de Datos
// Permite alternar entre datos mock (desarrollo) y API real (producción)
// ============================================================================

import { consultaCiudadanaService } from "@/services";
import type { ProcesoPublico, Actuacion } from "@/types";

// Re-exportar tipo para compatibilidad con componentes existentes
export type { ProcesoPublico as JudicialProcess } from "@/types";

// Determina si usar datos mock o API real
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

// ============================================================================
// FUNCIONES MOCK (para desarrollo sin backend)
// ============================================================================

const generateAnonymousId = (prefix: string, index: number): string => {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNum = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${randomLetter}-${randomNum}`;
};

const generateRandomDate = (): string => {
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, 0, 1);
  const randomTime = fiveYearsAgo.getTime() + Math.random() * (now.getTime() - fiveYearsAgo.getTime());
  const date = new Date(randomTime);
  return date.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const dependencias = [
  "Unidad Judicial Civil de Quito",
  "Unidad Judicial Penal de Guayaquil",
  "Unidad Judicial de Familia de Cuenca",
  "Tribunal Contencioso Administrativo de Pichincha",
  "Corte Provincial de Justicia del Guayas",
];

const materias = ["Civil", "Penal", "Laboral", "Familia", "Tránsito"];
const tiposAccion = ["Ordinario", "Sumario", "Ejecutivo", "Verbal Sumario", "Especial"];
const estados: ProcesoPublico["estado"][] = ["activo", "archivado", "pendiente"];

const generateMockProcesses = (count: number = 50): ProcesoPublico[] => {
  const provinces = ["17", "09", "01", "07", "12"];
  
  return Array.from({ length: count }, (_, index) => {
    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const court = Math.floor(Math.random() * 900) + 100;
    const year = 2020 + Math.floor(Math.random() * 6);
    const sequential = String(index + 1).padStart(5, "0");
    const letter = "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    
    return {
      id: `proc-${index + 1}`,
      numeroExpediente: `${province}${court}-${year}-${sequential}${letter}`,
      fechaIngreso: generateRandomDate(),
      dependencia: dependencias[Math.floor(Math.random() * dependencias.length)],
      materia: materias[Math.floor(Math.random() * materias.length)],
      tipoAccion: tiposAccion[Math.floor(Math.random() * tiposAccion.length)],
      estado: estados[Math.floor(Math.random() * estados.length)],
      actorAnonimo: generateAnonymousId("A", index),
      demandadoAnonimo: generateAnonymousId("D", index),
      juezAnonimo: generateAnonymousId("J", index),
    };
  });
};

const mockSearchProcesses = async (
  query: string,
  searchType: "actor" | "demandado" | "proceso"
): Promise<ProcesoPublico[]> => {
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500));

  if (query.length < 3) return [];

  const allProcesses = generateMockProcesses(Math.floor(Math.random() * 80) + 20);
  const queryLower = query.toLowerCase();

  return allProcesses.filter((process) => {
    switch (searchType) {
      case "proceso":
        return process.numeroExpediente.toLowerCase().includes(queryLower);
      case "actor":
      case "demandado":
      default:
        return Math.random() > 0.3;
    }
  });
};

const mockGetProcessById = async (id: string): Promise<ProcesoPublico | null> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const allProcesses = generateMockProcesses(100);
  return allProcesses.find((p) => p.id === id) || allProcesses[0];
};

const mockGetActuaciones = async (processId: string): Promise<Actuacion[]> => {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const tiposActuacion = [
    "Providencia", "Auto Interlocutorio", "Sentencia", "Notificación",
    "Citación", "Diligencia", "Audiencia", "Dictamen",
  ];

  const count = Math.floor(Math.random() * 15) + 5;

  return Array.from({ length: count }, (_, index) => ({
    id: `act-${processId}-${index}`,
    fecha: generateRandomDate(),
    tipo: tiposActuacion[Math.floor(Math.random() * tiposActuacion.length)],
    descripcion: "Actuación procesal registrada en el expediente.",
    funcionario: generateAnonymousId("F", index),
  })).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};

// ============================================================================
// FUNCIONES EXPORTADAS (usan mock o API según configuración)
// ============================================================================

/**
 * Busca procesos judiciales
 */
export const searchProcesses = async (
  query: string,
  searchType: "actor" | "demandado" | "proceso"
): Promise<ProcesoPublico[]> => {
  if (USE_MOCK) {
    return mockSearchProcesses(query, searchType);
  }

  try {
    const response = await consultaCiudadanaService.buscarProcesos(query, searchType);
    return response.data;
  } catch (error) {
    console.error("Error searching processes:", error);
    return [];
  }
};

/**
 * Obtiene un proceso por ID
 */
export const getProcessById = async (id: string): Promise<ProcesoPublico | null> => {
  if (USE_MOCK) {
    return mockGetProcessById(id);
  }

  return consultaCiudadanaService.getProcesoById(id);
};

/**
 * Obtiene actuaciones de un proceso
 */
export const getActuaciones = async (processId: string): Promise<Actuacion[]> => {
  if (USE_MOCK) {
    return mockGetActuaciones(processId);
  }

  return consultaCiudadanaService.getActuaciones(processId);
};
