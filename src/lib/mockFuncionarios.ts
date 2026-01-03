import { MockUser, UserRole } from "@/contexts/AuthContext";

// Extended mock data for funcionarios
export interface Funcionario {
  id: string;
  nombre: string;
  identificacion: string;
  cargo: UserRole;
  unidadJudicial: string;
  materia: string;
  email: string;
  estado: "activa" | "suspendida" | "inactiva";
  fechaCreacion: string;
  ultimoAcceso: string;
  intentosFallidos: number;
}

export interface Causa {
  id: string;
  numeroExpediente: string;
  materia: string;
  tipoAccion: string;
  unidadJudicial: string;
  actor: string;
  demandado: string;
  juezAsignado: string;
  juezAnonimoId: string;
  estado: "en_tramite" | "resuelto" | "archivado" | "suspendido";
  estadoProcesal: string;
  fechaIngreso: string;
  fechaActualizacion: string;
  prioridad: "normal" | "urgente" | "alta";
}

export interface Audiencia {
  id: string;
  causaId: string;
  numeroExpediente: string;
  tipo: "inicial" | "evaluacion" | "juicio" | "resolucion" | "conciliacion";
  fecha: string;
  hora: string;
  sala: string;
  estado: "programada" | "realizada" | "reprogramada" | "cancelada";
  partes: string[];
  notas: string;
  historialCambios: {
    fecha: string;
    cambio: string;
    usuario: string;
  }[];
}

export interface Documento {
  id: string;
  causaId: string;
  nombre: string;
  tipo: "escrito" | "providencia" | "auto" | "sentencia" | "anexo" | "notificacion";
  formato: "pdf" | "docx";
  tamano: string;
  fechaSubida: string;
  subidoPor: string;
  hashIntegridad: string;
  estado: "borrador" | "pendiente" | "firmado" | "notificado";
}

export interface Notificacion {
  id: string;
  causaId: string;
  tipo: "citacion" | "notificacion" | "emplazamiento" | "recordatorio";
  destinatario: string;
  medio: "electronico" | "fisico" | "judicial";
  fechaEnvio: string;
  fechaLimite: string;
  estado: "enviada" | "recibida" | "vencida" | "pendiente";
}

export interface LogAuditoria {
  id: string;
  usuario: string;
  accion: string;
  modulo: string;
  detalle: string;
  ip: string;
  fecha: string;
  resultado: "exito" | "error" | "denegado";
}

// Mock data generators
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

const unidadesJudiciales = [
  "Unidad Judicial Civil de Quito",
  "Unidad Judicial Penal de Guayaquil",
  "Unidad Judicial de Familia de Cuenca",
  "Tribunal Contencioso Administrativo de Pichincha",
  "Unidad Judicial Multicompetente de Riobamba",
  "Unidad Judicial Laboral de Quito",
  "Unidad Judicial de Violencia contra la Mujer",
];

const materias = ["Civil", "Penal", "Laboral", "Familia", "Niñez y Adolescencia", "Tránsito", "Contencioso Administrativo"];

const tiposAccion = ["Ordinario", "Sumario", "Ejecutivo", "Verbal Sumario", "Especial", "Monitorio"];

const salas = ["Sala 1A", "Sala 2B", "Sala 3C", "Sala Virtual 1", "Sala Virtual 2"];

// Generate mock funcionarios
export const mockFuncionarios: Funcionario[] = [
  {
    id: "1",
    nombre: "Dr. María García López",
    identificacion: "1712345678",
    cargo: "admin",
    unidadJudicial: "Consejo de la Judicatura",
    materia: "Administración",
    email: "admin@judicatura.gob.ec",
    estado: "activa",
    fechaCreacion: generateDate(365),
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
    fechaCreacion: generateDate(200),
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
    fechaCreacion: generateDate(150),
    ultimoAcceso: generateDateTime(0),
    intentosFallidos: 0,
  },
  {
    id: "4",
    nombre: "Dr. Roberto Vega Torres",
    identificacion: "0712345678",
    cargo: "juez",
    unidadJudicial: "Unidad Judicial Laboral de Quito",
    materia: "Laboral",
    email: "rvega@judicatura.gob.ec",
    estado: "suspendida",
    fechaCreacion: generateDate(300),
    ultimoAcceso: generateDateTime(30),
    intentosFallidos: 5,
  },
  {
    id: "5",
    nombre: "Lic. Patricia Ramos Díaz",
    identificacion: "1012345678",
    cargo: "secretario",
    unidadJudicial: "Unidad Judicial de Familia de Cuenca",
    materia: "Familia",
    email: "pramos@judicatura.gob.ec",
    estado: "activa",
    fechaCreacion: generateDate(100),
    ultimoAcceso: generateDateTime(2),
    intentosFallidos: 0,
  },
  {
    id: "6",
    nombre: "Dr. Fernando Sánchez Mora",
    identificacion: "1112345678",
    cargo: "juez",
    unidadJudicial: "Tribunal Contencioso Administrativo de Pichincha",
    materia: "Contencioso Administrativo",
    email: "fsanchez@judicatura.gob.ec",
    estado: "inactiva",
    fechaCreacion: generateDate(500),
    ultimoAcceso: generateDateTime(90),
    intentosFallidos: 0,
  },
];

// Generate mock causas
export const generateMockCausas = (count: number = 30): Causa[] => {
  const estados: Causa["estado"][] = ["en_tramite", "resuelto", "archivado", "suspendido"];
  const estadosProcesales = [
    "Calificación de demanda",
    "Citación",
    "Contestación",
    "Audiencia preliminar",
    "Prueba",
    "Alegatos",
    "Sentencia",
    "Ejecución",
  ];
  const prioridades: Causa["prioridad"][] = ["normal", "urgente", "alta"];

  return Array.from({ length: count }, (_, i) => {
    const provincia = ["17", "09", "01", "07", "12"][Math.floor(Math.random() * 5)];
    const juzgado = Math.floor(Math.random() * 900) + 100;
    const year = 2021 + Math.floor(Math.random() * 4);
    const seq = String(i + 1).padStart(5, "0");
    const letter = "ABCDEFGHJK"[Math.floor(Math.random() * 10)];

    return {
      id: `causa-${i + 1}`,
      numeroExpediente: `${provincia}${juzgado}-${year}-${seq}${letter}`,
      materia: materias[Math.floor(Math.random() * materias.length)],
      tipoAccion: tiposAccion[Math.floor(Math.random() * tiposAccion.length)],
      unidadJudicial: unidadesJudiciales[Math.floor(Math.random() * unidadesJudiciales.length)],
      actor: `Actor ${i + 1}`,
      demandado: `Demandado ${i + 1}`,
      juezAsignado: mockFuncionarios.filter((f) => f.cargo === "juez")[Math.floor(Math.random() * 2)]?.nombre || "Sin asignar",
      juezAnonimoId: `JZ-${String(Math.floor(Math.random() * 900) + 100)}`,
      estado: estados[Math.floor(Math.random() * estados.length)],
      estadoProcesal: estadosProcesales[Math.floor(Math.random() * estadosProcesales.length)],
      fechaIngreso: generateDate(Math.floor(Math.random() * 365)),
      fechaActualizacion: generateDate(Math.floor(Math.random() * 30)),
      prioridad: prioridades[Math.floor(Math.random() * prioridades.length)],
    };
  });
};

// Generate mock audiencias
export const generateMockAudiencias = (count: number = 20): Audiencia[] => {
  const tipos: Audiencia["tipo"][] = ["inicial", "evaluacion", "juicio", "resolucion", "conciliacion"];
  const estadosAudiencia: Audiencia["estado"][] = ["programada", "realizada", "reprogramada", "cancelada"];
  const causas = generateMockCausas(count);

  return Array.from({ length: count }, (_, i) => ({
    id: `aud-${i + 1}`,
    causaId: causas[i % causas.length].id,
    numeroExpediente: causas[i % causas.length].numeroExpediente,
    tipo: tipos[Math.floor(Math.random() * tipos.length)],
    fecha: generateDate(-Math.floor(Math.random() * 60) + 30), // -30 to +30 days
    hora: `${8 + Math.floor(Math.random() * 8)}:${Math.random() > 0.5 ? "00" : "30"}`,
    sala: salas[Math.floor(Math.random() * salas.length)],
    estado: estadosAudiencia[Math.floor(Math.random() * estadosAudiencia.length)],
    partes: ["Actor", "Demandado", "Abogado Actor", "Abogado Demandado"],
    notas: "Audiencia programada según calendario judicial.",
    historialCambios:
      Math.random() > 0.7
        ? [
            {
              fecha: generateDateTime(5),
              cambio: "Reprogramación por solicitud de parte",
              usuario: "Secretaría",
            },
          ]
        : [],
  }));
};

// Generate mock documentos
export const generateMockDocumentos = (count: number = 25): Documento[] => {
  const tipos: Documento["tipo"][] = ["escrito", "providencia", "auto", "sentencia", "anexo", "notificacion"];
  const estados: Documento["estado"][] = ["borrador", "pendiente", "firmado", "notificado"];
  const causas = generateMockCausas(10);

  return Array.from({ length: count }, (_, i) => ({
    id: `doc-${i + 1}`,
    causaId: causas[i % causas.length].id,
    nombre: `${tipos[Math.floor(Math.random() * tipos.length)].toUpperCase()}_${i + 1}.pdf`,
    tipo: tipos[Math.floor(Math.random() * tipos.length)],
    formato: Math.random() > 0.2 ? "pdf" : "docx",
    tamano: `${Math.floor(Math.random() * 5000) + 100} KB`,
    fechaSubida: generateDateTime(Math.floor(Math.random() * 60)),
    subidoPor: mockFuncionarios[Math.floor(Math.random() * mockFuncionarios.length)].nombre,
    hashIntegridad: `SHA256:${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    estado: estados[Math.floor(Math.random() * estados.length)],
  }));
};

// Generate mock notificaciones
export const generateMockNotificaciones = (count: number = 15): Notificacion[] => {
  const tipos: Notificacion["tipo"][] = ["citacion", "notificacion", "emplazamiento", "recordatorio"];
  const medios: Notificacion["medio"][] = ["electronico", "fisico", "judicial"];
  const estados: Notificacion["estado"][] = ["enviada", "recibida", "vencida", "pendiente"];
  const causas = generateMockCausas(10);

  return Array.from({ length: count }, (_, i) => ({
    id: `notif-${i + 1}`,
    causaId: causas[i % causas.length].id,
    tipo: tipos[Math.floor(Math.random() * tipos.length)],
    destinatario: `Parte ${i + 1}`,
    medio: medios[Math.floor(Math.random() * medios.length)],
    fechaEnvio: generateDate(Math.floor(Math.random() * 30)),
    fechaLimite: generateDate(-Math.floor(Math.random() * 15)),
    estado: estados[Math.floor(Math.random() * estados.length)],
  }));
};

// Generate mock logs de auditoría
export const generateMockLogs = (count: number = 50): LogAuditoria[] => {
  const acciones = [
    "LOGIN",
    "LOGOUT",
    "CREAR_CAUSA",
    "EDITAR_CAUSA",
    "SUBIR_DOCUMENTO",
    "FIRMAR_DOCUMENTO",
    "PROGRAMAR_AUDIENCIA",
    "ENVIAR_NOTIFICACION",
    "CAMBIAR_ESTADO",
    "EXPORTAR_DATOS",
  ];
  const modulos = ["Autenticación", "Causas", "Documentos", "Audiencias", "Notificaciones", "Reportes"];
  const resultados: LogAuditoria["resultado"][] = ["exito", "error", "denegado"];

  return Array.from({ length: count }, (_, i) => ({
    id: `log-${i + 1}`,
    usuario: mockFuncionarios[Math.floor(Math.random() * mockFuncionarios.length)].email,
    accion: acciones[Math.floor(Math.random() * acciones.length)],
    modulo: modulos[Math.floor(Math.random() * modulos.length)],
    detalle: `Operación realizada en el sistema judicial.`,
    ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    fecha: generateDateTime(Math.floor(Math.random() * 30)),
    resultado: resultados[Math.floor(Math.random() * resultados.length)],
  })).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};

// API-like functions
export const getFuncionarios = async (): Promise<Funcionario[]> => {
  await new Promise((r) => setTimeout(r, 500));
  return mockFuncionarios;
};

export const getCausas = async (juezId?: string): Promise<Causa[]> => {
  await new Promise((r) => setTimeout(r, 600));
  const causas = generateMockCausas(30);
  if (juezId) {
    return causas.filter((c) => c.juezAsignado.includes("Carlos") || c.juezAsignado.includes("Roberto"));
  }
  return causas;
};

export const getCausaById = async (id: string): Promise<Causa | null> => {
  await new Promise((r) => setTimeout(r, 400));
  const causas = generateMockCausas(30);
  return causas.find((c) => c.id === id) || causas[0];
};

export const getAudiencias = async (juezId?: string): Promise<Audiencia[]> => {
  await new Promise((r) => setTimeout(r, 500));
  return generateMockAudiencias(20);
};

export const getDocumentos = async (causaId?: string): Promise<Documento[]> => {
  await new Promise((r) => setTimeout(r, 400));
  const docs = generateMockDocumentos(25);
  if (causaId) {
    return docs.filter((d) => d.causaId === causaId);
  }
  return docs;
};

export const getNotificaciones = async (): Promise<Notificacion[]> => {
  await new Promise((r) => setTimeout(r, 400));
  return generateMockNotificaciones(15);
};

export const getLogs = async (): Promise<LogAuditoria[]> => {
  await new Promise((r) => setTimeout(r, 500));
  return generateMockLogs(50);
};
