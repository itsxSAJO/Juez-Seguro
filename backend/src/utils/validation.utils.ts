// ============================================================================
// JUEZ SEGURO BACKEND - Utilidades de Validación Segura
// Validadores Zod reutilizables con protección contra inyección
// ============================================================================
// Common Criteria: FIA_UID.2 (User identification before any action)
// - Validación estricta de todas las entradas
// - Filtrado de caracteres peligrosos
// - Límites de longitud para prevenir DoS
// ============================================================================

import { z } from "zod";

// ============================================================================
// CONSTANTES DE LÍMITES
// ============================================================================
export const LIMITES = {
  // Campos cortos (nombres, títulos)
  NOMBRE_MIN: 3,
  NOMBRE_MAX: 50,          // Máximo 50 caracteres para nombres
  TITULO_MIN: 3,
  TITULO_MAX: 200,
  
  // Campos de identificación
  EMAIL_MAX: 100,
  CEDULA_LENGTH: 10,       // Cédulas ecuatorianas: exactamente 10 dígitos
  RUC_LENGTH: 13,          // RUC: 13 dígitos
  TELEFONO_MAX: 15,
  
  // Campos de texto medio
  ASUNTO_MAX: 200,
  MOTIVO_MAX: 300,
  DIRECCION_MAX: 200,
  
  // Campos de texto largo
  DESCRIPCION_MAX: 2000,
  CONTENIDO_MAX: 10000,
  CONTENIDO_DOCUMENTO_MAX: 50000,
  
  // Campos especiales
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  NUMERO_PROCESO_MAX: 25,
  UUID_LENGTH: 36,
  
  // Arrays
  ARRAY_MAX_ITEMS: 100,
} as const;

// ============================================================================
// PATRONES DE CARACTERES PERMITIDOS
// ============================================================================

/**
 * Caracteres seguros para texto general (español)
 * Permite: letras (con tildes), números, espacios, puntuación básica
 */
const PATRON_TEXTO_GENERAL = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚüÜ\s.,;:\-¿?¡!()'"°/#@&]+$/;

/**
 * Caracteres seguros para nombres de personas
 * Más restrictivo: solo letras, espacios, apóstrofes y guiones
 */
const PATRON_NOMBRE = /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s'\-]+$/;

/**
 * Caracteres seguros para identificadores (cédula, RUC, pasaporte)
 * Solo alfanuméricos y guiones
 */
const PATRON_IDENTIFICACION = /^[a-zA-Z0-9\-]+$/;

/**
 * Caracteres para contenido extenso (documentos, descripciones largas)
 * Más permisivo pero sin caracteres de control ni scripts
 */
const PATRON_CONTENIDO_EXTENSO = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚüÜ\s.,;:\-¿?¡!()'"°/#@&%$€\n\r\t[\]{}=+*^~`|\\]+$/;

/**
 * Solo números
 */
const PATRON_NUMEROS = /^[0-9]+$/;

/**
 * Número de proceso judicial (formato específico)
 * Ejemplo: 17203-2024-00001
 */
const PATRON_NUMERO_PROCESO = /^[0-9]{5}-[0-9]{4}-[0-9]{5}$/;

// ============================================================================
// VALIDADORES REUTILIZABLES
// ============================================================================

/**
 * Valida nombres de personas (actor, demandado, juez, etc.)
 * Máximo 50 caracteres, solo letras españolas, espacios, apóstrofes y guiones
 */
export const nombreSchema = z
  .string()
  .min(LIMITES.NOMBRE_MIN, `Mínimo ${LIMITES.NOMBRE_MIN} caracteres`)
  .max(LIMITES.NOMBRE_MAX, `Máximo ${LIMITES.NOMBRE_MAX} caracteres`)
  .regex(PATRON_NOMBRE, "Solo se permiten letras, espacios, apóstrofes y guiones")
  .transform((val) => val.trim());

/**
 * Valida identificaciones (cédula ecuatoriana - 10 dígitos)
 */
export const identificacionSchema = z
  .string()
  .length(LIMITES.CEDULA_LENGTH, `La cédula debe tener exactamente ${LIMITES.CEDULA_LENGTH} dígitos`)
  .regex(PATRON_NUMEROS, "Solo se permiten números")
  .transform((val) => val.trim());

/**
 * Valida RUC ecuatoriano (13 dígitos)
 */
export const rucSchema = z
  .string()
  .length(LIMITES.RUC_LENGTH, `El RUC debe tener exactamente ${LIMITES.RUC_LENGTH} dígitos`)
  .regex(PATRON_NUMEROS, "Solo se permiten números")
  .transform((val) => val.trim());

/**
 * Valida identificación flexible (cédula o RUC)
 */
export const identificacionFlexibleSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(13, "Máximo 13 caracteres")
  .regex(PATRON_NUMEROS, "Solo se permiten números")
  .transform((val) => val.trim());

/**
 * Valida correos electrónicos
 */
export const emailSchema = z
  .string()
  .email("Formato de correo inválido")
  .max(LIMITES.EMAIL_MAX, `Máximo ${LIMITES.EMAIL_MAX} caracteres`)
  .transform((val) => val.toLowerCase().trim());

/**
 * Valida contraseñas con requisitos de seguridad
 */
export const passwordSchema = z
  .string()
  .min(LIMITES.PASSWORD_MIN, `Mínimo ${LIMITES.PASSWORD_MIN} caracteres`)
  .max(LIMITES.PASSWORD_MAX, `Máximo ${LIMITES.PASSWORD_MAX} caracteres`)
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Debe contener al menos un carácter especial");

/**
 * Valida contraseña actual (sin requisitos de complejidad, solo longitud)
 */
export const passwordActualSchema = z
  .string()
  .min(1, "Contraseña requerida")
  .max(LIMITES.PASSWORD_MAX, `Máximo ${LIMITES.PASSWORD_MAX} caracteres`);

/**
 * Valida títulos (de documentos, decisiones, etc.)
 */
export const tituloSchema = z
  .string()
  .min(LIMITES.TITULO_MIN, `Mínimo ${LIMITES.TITULO_MIN} caracteres`)
  .max(LIMITES.TITULO_MAX, `Máximo ${LIMITES.TITULO_MAX} caracteres`)
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

/**
 * Valida asuntos (de notificaciones, emails, etc.)
 */
export const asuntoSchema = z
  .string()
  .min(3, "Mínimo 3 caracteres")
  .max(LIMITES.ASUNTO_MAX, `Máximo ${LIMITES.ASUNTO_MAX} caracteres`)
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

/**
 * Valida motivos (de suspensión, cancelación, etc.)
 */
export const motivoSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(LIMITES.MOTIVO_MAX, `Máximo ${LIMITES.MOTIVO_MAX} caracteres`)
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

/**
 * Valida descripciones cortas
 */
export const descripcionSchema = z
  .string()
  .min(5, "Mínimo 5 caracteres")
  .max(LIMITES.DESCRIPCION_MAX, `Máximo ${LIMITES.DESCRIPCION_MAX} caracteres`)
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

/**
 * Valida contenido extenso (cuerpo de documentos, decisiones)
 * Más permisivo en caracteres pero con límite de longitud
 */
export const contenidoExtensoSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(LIMITES.CONTENIDO_MAX, `Máximo ${LIMITES.CONTENIDO_MAX} caracteres`)
  .regex(PATRON_CONTENIDO_EXTENSO, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

/**
 * Valida contenido de documentos (muy extenso)
 */
export const contenidoDocumentoSchema = z
  .string()
  .min(1, "Contenido requerido")
  .max(LIMITES.CONTENIDO_DOCUMENTO_MAX, `Máximo ${LIMITES.CONTENIDO_DOCUMENTO_MAX} caracteres`);

/**
 * Valida números de proceso judicial
 */
export const numeroProcesoSchema = z
  .string()
  .max(LIMITES.NUMERO_PROCESO_MAX, `Máximo ${LIMITES.NUMERO_PROCESO_MAX} caracteres`)
  .regex(PATRON_NUMERO_PROCESO, "Formato de número de proceso inválido (ej: 17203-2024-00001)")
  .transform((val) => val.trim());

/**
 * Valida número de proceso flexible (para búsquedas)
 */
export const numeroProcesoFlexibleSchema = z
  .string()
  .max(LIMITES.NUMERO_PROCESO_MAX, `Máximo ${LIMITES.NUMERO_PROCESO_MAX} caracteres`)
  .regex(PATRON_IDENTIFICACION, "Solo se permiten números, letras y guiones")
  .transform((val) => val.trim());

/**
 * Valida campos de texto opcionales cortos
 */
export const textoOpcionalCortoSchema = z
  .string()
  .max(LIMITES.TITULO_MAX, `Máximo ${LIMITES.TITULO_MAX} caracteres`)
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim())
  .optional();

/**
 * Valida campos de texto opcionales largos
 */
export const textoOpcionalLargoSchema = z
  .string()
  .max(LIMITES.DESCRIPCION_MAX, `Máximo ${LIMITES.DESCRIPCION_MAX} caracteres`)
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim())
  .optional();

/**
 * Valida IDs numéricos positivos
 */
export const idNumericoSchema = z
  .number()
  .int("Debe ser un número entero")
  .positive("Debe ser un número positivo");

/**
 * Valida UUIDs
 */
export const uuidSchema = z
  .string()
  .uuid("UUID inválido");

/**
 * Valida fechas ISO
 */
export const fechaISOSchema = z
  .string()
  .datetime({ message: "Formato de fecha inválido (ISO 8601)" });

/**
 * Valida fechas flexibles (acepta ISO o YYYY-MM-DD)
 */
export const fechaFlexibleSchema = z
  .string()
  .refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Formato de fecha inválido" }
  );

/**
 * Valida salas/ubicaciones
 */
export const salaSchema = z
  .string()
  .min(1, "Sala es requerida")
  .max(100, "Máximo 100 caracteres")
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

/**
 * Valida materias judiciales
 */
export const materiaSchema = z
  .string()
  .min(1, "Materia es requerida")
  .max(100, "Máximo 100 caracteres")
  .regex(PATRON_NOMBRE, "Solo se permiten letras")
  .transform((val) => val.trim());

/**
 * Valida unidades judiciales
 */
export const unidadJudicialSchema = z
  .string()
  .min(1, "Unidad judicial es requerida")
  .max(150, "Máximo 150 caracteres")
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

/**
 * Valida tipos de proceso
 */
export const tipoProcesoSchema = z
  .string()
  .min(1, "Tipo de proceso es requerido")
  .max(100, "Máximo 100 caracteres")
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados")
  .transform((val) => val.trim());

// ============================================================================
// ESQUEMAS COMPUESTOS COMUNES
// ============================================================================

/**
 * Esquema para paginación
 */
export const paginacionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Esquema para búsqueda general
 */
export const busquedaSchema = z
  .string()
  .max(200, "Búsqueda muy larga")
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos")
  .optional();

/**
 * Esquema para parte procesal (actor/demandado)
 */
export const parteProcesal = z.object({
  nombre: nombreSchema,
  identificacion: identificacionSchema,
  tipo: z.enum(["ACTOR", "DEMANDADO", "TERCERO"]).optional(),
});

// ============================================================================
// FUNCIONES DE VALIDACIÓN HELPER
// ============================================================================

/**
 * Crea un validador de string con límites personalizados
 */
export function crearValidadorTexto(
  minLength: number,
  maxLength: number,
  patron: RegExp = PATRON_TEXTO_GENERAL,
  mensajePatron: string = "Caracteres no permitidos detectados"
) {
  return z
    .string()
    .min(minLength, `Mínimo ${minLength} caracteres`)
    .max(maxLength, `Máximo ${maxLength} caracteres`)
    .regex(patron, mensajePatron)
    .transform((val) => val.trim());
}

/**
 * Verifica si un string excede el límite de longitud
 */
export function excedeLimite(valor: string | undefined, limite: number): boolean {
  return valor !== undefined && valor.length > limite;
}

/**
 * Sanitiza un string removiendo caracteres peligrosos
 */
export function sanitizarTexto(valor: string): string {
  // Remover null bytes y caracteres de control
  return valor
    .replace(/\0/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim();
}

// ============================================================================
// EXPORTAR PATRONES PARA USO DIRECTO
// ============================================================================
export const PATRONES = {
  TEXTO_GENERAL: PATRON_TEXTO_GENERAL,
  NOMBRE: PATRON_NOMBRE,
  IDENTIFICACION: PATRON_IDENTIFICACION,
  CONTENIDO_EXTENSO: PATRON_CONTENIDO_EXTENSO,
  NUMEROS: PATRON_NUMEROS,
  NUMERO_PROCESO: PATRON_NUMERO_PROCESO,
} as const;
