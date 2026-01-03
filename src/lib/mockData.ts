import { JudicialProcess } from "@/components/search/ResultsTable";

// Generate anonymous identifier following the Juez Seguro format
const generateAnonymousId = (prefix: string, index: number): string => {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNum = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${randomLetter}-${randomNum}`;
};

// Mock dependencias judiciales
const dependencias = [
  "Unidad Judicial Civil de Quito",
  "Unidad Judicial Penal de Guayaquil",
  "Unidad Judicial de Familia de Cuenca",
  "Tribunal Contencioso Administrativo de Pichincha",
  "Corte Provincial de Justicia del Guayas",
  "Unidad Judicial Multicompetente de Riobamba",
  "Unidad Judicial Laboral de Quito",
  "Sala Especializada de lo Civil y Mercantil",
  "Unidad Judicial de Violencia contra la Mujer",
  "Tribunal de Garantías Penales de Quito",
];

const materias = [
  "Civil",
  "Penal",
  "Laboral",
  "Familia",
  "Niñez y Adolescencia",
  "Tránsito",
  "Contencioso Administrativo",
  "Constitucional",
  "Inquilinato",
  "Coactiva",
];

const tiposAccion = [
  "Ordinario",
  "Sumario",
  "Ejecutivo",
  "Verbal Sumario",
  "Especial",
  "Monitorio",
  "Procedimiento Directo",
  "Procedimiento Abreviado",
  "Acción de Protección",
  "Habeas Corpus",
];

const estados: JudicialProcess["estado"][] = ["activo", "archivado", "pendiente"];

// Generate a random date within the last 5 years
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

// Generate case number in format: XXXXX-YYYY-XXXXXL
const generateCaseNumber = (index: number): string => {
  const provinces = ["17", "09", "01", "07", "12", "13", "06", "05", "08", "10"];
  const province = provinces[Math.floor(Math.random() * provinces.length)];
  const court = Math.floor(Math.random() * 900) + 100;
  const year = 2020 + Math.floor(Math.random() * 6);
  const sequential = String(index + 1).padStart(5, "0");
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter = letters[Math.floor(Math.random() * letters.length)];
  
  return `${province}${court}-${year}-${sequential}${letter}`;
};

// Generate mock data
export const generateMockProcesses = (count: number = 50): JudicialProcess[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `proc-${index + 1}`,
    numeroExpediente: generateCaseNumber(index),
    fechaIngreso: generateRandomDate(),
    dependencia: dependencias[Math.floor(Math.random() * dependencias.length)],
    materia: materias[Math.floor(Math.random() * materias.length)],
    tipoAccion: tiposAccion[Math.floor(Math.random() * tiposAccion.length)],
    estado: estados[Math.floor(Math.random() * estados.length)],
    actorAnonimo: generateAnonymousId("A", index),
    demandadoAnonimo: generateAnonymousId("D", index),
    juezAnonimo: generateAnonymousId("J", index),
  }));
};

// Simulate search with delay
export const searchProcesses = async (
  query: string,
  searchType: "actor" | "demandado" | "proceso"
): Promise<JudicialProcess[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500));

  const allProcesses = generateMockProcesses(Math.floor(Math.random() * 80) + 20);

  // Filter based on query (in real app, this would be server-side)
  const queryLower = query.toLowerCase();
  
  // For demo purposes, return results if query has 3+ characters
  if (query.length >= 3) {
    return allProcesses.filter((process) => {
      switch (searchType) {
        case "proceso":
          return process.numeroExpediente.toLowerCase().includes(queryLower);
        case "actor":
        case "demandado":
        default:
          // Simulate matching based on query
          return Math.random() > 0.3; // 70% chance to match
      }
    });
  }

  return [];
};

// Get single process by ID
export const getProcessById = async (id: string): Promise<JudicialProcess | null> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  const allProcesses = generateMockProcesses(100);
  return allProcesses.find((p) => p.id === id) || allProcesses[0];
};

// Mock actuaciones (movements/actions in the process)
export interface Actuacion {
  id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  responsableAnonimo: string;
}

export const getActuaciones = async (processId: string): Promise<Actuacion[]> => {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const tiposActuacion = [
    "Providencia",
    "Auto Interlocutorio",
    "Sentencia",
    "Notificación",
    "Citación",
    "Diligencia",
    "Audiencia",
    "Dictamen",
    "Informe Pericial",
    "Resolución",
  ];

  const count = Math.floor(Math.random() * 15) + 5;
  
  return Array.from({ length: count }, (_, index) => ({
    id: `act-${processId}-${index}`,
    fecha: generateRandomDate(),
    tipo: tiposActuacion[Math.floor(Math.random() * tiposActuacion.length)],
    descripcion: `Actuación procesal registrada en el expediente. Documento procesado y archivado conforme a la normativa vigente.`,
    responsableAnonimo: generateAnonymousId("F", index),
  })).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};
