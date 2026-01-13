// ============================================================================
// JUEZ SEGURO FRONTEND - Utilidades de Validación Segura
// Validadores Zod reutilizables con protección contra inyección
// ============================================================================

import { z } from "zod";

// ============================================================================
// CONSTANTES DE LÍMITES
// ============================================================================
export const LIMITES = {
  // Campos cortos (nombres, títulos)
  NOMBRE_MIN: 3,
  NOMBRE_MAX: 50,
  TITULO_MIN: 3,
  TITULO_MAX: 200,
  
  // Campos de identificación
  EMAIL_MAX: 100,
  CEDULA_LENGTH: 10,      // Cédulas ecuatorianas: exactamente 10 dígitos
  RUC_LENGTH: 13,         // RUC: 13 dígitos
  TELEFONO_MAX: 15,
  
  // Campos de texto medio
  ASUNTO_MAX: 200,
  MOTIVO_MAX: 300,
  DIRECCION_MAX: 200,
  
  // Campos de texto largo
  DESCRIPCION_MAX: 2000,
  CONTENIDO_MAX: 10000,
  
  // Campos especiales
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  NUMERO_PROCESO_MAX: 25,
  EMAIL_PREFIX_MIN: 3,
  EMAIL_PREFIX_MAX: 30,
  
  // Búsquedas
  BUSQUEDA_MIN: 3,
  BUSQUEDA_MAX: 100,
} as const;

// ============================================================================
// PATRONES DE CARACTERES PERMITIDOS
// ============================================================================

/**
 * Caracteres seguros para nombres de personas
 * Solo letras (español), espacios, apóstrofes y guiones
 */
const PATRON_NOMBRE = /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s'\-]+$/;

/**
 * Solo números
 */
const PATRON_NUMEROS = /^[0-9]+$/;

/**
 * Número de proceso judicial (formato específico Ecuador)
 * Ejemplo: 17203-2024-00001 o 17203-2024-00001G
 */
const PATRON_NUMERO_PROCESO = /^[0-9]{5}-[0-9]{4}-[0-9]{5}[A-Z]?$/;

/**
 * Email prefix (usuario antes del @)
 */
const PATRON_EMAIL_PREFIX = /^[a-z0-9._-]+$/;

/**
 * Caracteres para texto general (español)
 */
const PATRON_TEXTO_GENERAL = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚüÜ\s.,;:\-¿?¡!()'"°/#@&]+$/;

/**
 * Caracteres para búsquedas (más permisivo)
 */
const PATRON_BUSQUEDA = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚüÜ\s.\-]+$/;

// ============================================================================
// VALIDADORES REUTILIZABLES
// ============================================================================

/**
 * Valida nombres de personas (actor, demandado, juez, etc.)
 * Máximo 50 caracteres
 */
export const nombreSchema = z
  .string()
  .min(LIMITES.NOMBRE_MIN, `El nombre debe tener al menos ${LIMITES.NOMBRE_MIN} caracteres`)
  .max(LIMITES.NOMBRE_MAX, `El nombre no puede exceder ${LIMITES.NOMBRE_MAX} caracteres`)
  .regex(PATRON_NOMBRE, "Solo se permiten letras, espacios, apóstrofes y guiones");

/**
 * Valida cédula ecuatoriana (exactamente 10 dígitos)
 */
export const cedulaSchema = z
  .string()
  .length(LIMITES.CEDULA_LENGTH, `La cédula debe tener exactamente ${LIMITES.CEDULA_LENGTH} dígitos`)
  .regex(PATRON_NUMEROS, "Solo se permiten números");

/**
 * Valida RUC ecuatoriano (exactamente 13 dígitos)
 */
export const rucSchema = z
  .string()
  .length(LIMITES.RUC_LENGTH, `El RUC debe tener exactamente ${LIMITES.RUC_LENGTH} dígitos`)
  .regex(PATRON_NUMEROS, "Solo se permiten números");

/**
 * Valida correos electrónicos
 */
export const emailSchema = z
  .string()
  .email("Formato de correo inválido")
  .max(LIMITES.EMAIL_MAX, `Máximo ${LIMITES.EMAIL_MAX} caracteres`);

/**
 * Valida prefijo de email institucional
 */
export const emailPrefixSchema = z
  .string()
  .min(LIMITES.EMAIL_PREFIX_MIN, `El usuario debe tener al menos ${LIMITES.EMAIL_PREFIX_MIN} caracteres`)
  .max(LIMITES.EMAIL_PREFIX_MAX, `El usuario no puede exceder ${LIMITES.EMAIL_PREFIX_MAX} caracteres`)
  .regex(PATRON_EMAIL_PREFIX, "Solo letras minúsculas, números, puntos, guiones y guiones bajos");

/**
 * Valida contraseñas con requisitos de seguridad
 */
export const passwordSchema = z
  .string()
  .min(LIMITES.PASSWORD_MIN, `Mínimo ${LIMITES.PASSWORD_MIN} caracteres`)
  .max(LIMITES.PASSWORD_MAX, `Máximo ${LIMITES.PASSWORD_MAX} caracteres`)
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
  .regex(/[a-z]/, "Debe incluir al menos una minúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número")
  .regex(/[^A-Za-z0-9]/, "Debe incluir al menos un carácter especial");

/**
 * Valida contraseña actual (sin requisitos de complejidad)
 */
export const passwordActualSchema = z
  .string()
  .min(1, "Ingrese su contraseña")
  .max(LIMITES.PASSWORD_MAX, `Máximo ${LIMITES.PASSWORD_MAX} caracteres`);

/**
 * Valida número de proceso judicial
 */
export const numeroProcesoSchema = z
  .string()
  .min(15, "Formato inválido")
  .max(LIMITES.NUMERO_PROCESO_MAX, `Máximo ${LIMITES.NUMERO_PROCESO_MAX} caracteres`)
  .regex(PATRON_NUMERO_PROCESO, "Formato inválido (Ej: 17203-2024-00001)");

/**
 * Valida búsquedas generales
 */
export const busquedaSchema = z
  .string()
  .min(LIMITES.BUSQUEDA_MIN, `Mínimo ${LIMITES.BUSQUEDA_MIN} caracteres`)
  .max(LIMITES.BUSQUEDA_MAX, `Máximo ${LIMITES.BUSQUEDA_MAX} caracteres`)
  .regex(PATRON_BUSQUEDA, "No se permiten caracteres especiales");

/**
 * Valida descripciones
 */
export const descripcionSchema = z
  .string()
  .min(20, "La descripción debe tener al menos 20 caracteres")
  .max(LIMITES.DESCRIPCION_MAX, `La descripción no puede exceder ${LIMITES.DESCRIPCION_MAX} caracteres`);

/**
 * Valida títulos
 */
export const tituloSchema = z
  .string()
  .min(LIMITES.TITULO_MIN, `Mínimo ${LIMITES.TITULO_MIN} caracteres`)
  .max(LIMITES.TITULO_MAX, `Máximo ${LIMITES.TITULO_MAX} caracteres`)
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos");

/**
 * Valida asuntos
 */
export const asuntoSchema = z
  .string()
  .min(3, "Mínimo 3 caracteres")
  .max(LIMITES.ASUNTO_MAX, `Máximo ${LIMITES.ASUNTO_MAX} caracteres`);

/**
 * Valida motivos
 */
export const motivoSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(LIMITES.MOTIVO_MAX, `Máximo ${LIMITES.MOTIVO_MAX} caracteres`);

// ============================================================================
// FUNCIONES HELPER DE VALIDACIÓN
// ============================================================================

/**
 * Valida una búsqueda según el tipo
 */
export function validarBusqueda(
  valor: string, 
  tipo: "actor" | "demandado" | "proceso"
): { valido: boolean; error?: string } {
  const valorLimpio = valor.trim();
  
  if (!valorLimpio) {
    return { valido: false, error: "Por favor ingrese un término de búsqueda" };
  }
  
  if (valorLimpio.length < LIMITES.BUSQUEDA_MIN) {
    return { valido: false, error: `Mínimo ${LIMITES.BUSQUEDA_MIN} caracteres` };
  }
  
  if (tipo === "proceso") {
    // Validar formato de número de proceso
    if (valorLimpio.length > LIMITES.NUMERO_PROCESO_MAX) {
      return { valido: false, error: `Máximo ${LIMITES.NUMERO_PROCESO_MAX} caracteres` };
    }
    if (!PATRON_NUMERO_PROCESO.test(valorLimpio)) {
      return { valido: false, error: "Formato inválido (Ej: 17203-2024-00001)" };
    }
  } else {
    // Validar búsqueda por nombre/identificación
    if (valorLimpio.length > LIMITES.NOMBRE_MAX) {
      return { valido: false, error: `Máximo ${LIMITES.NOMBRE_MAX} caracteres` };
    }
    if (!PATRON_BUSQUEDA.test(valorLimpio)) {
      return { valido: false, error: "No se permiten caracteres especiales" };
    }
  }
  
  return { valido: true };
}

// ============================================================================
// EXPORTAR PATRONES PARA USO DIRECTO
// ============================================================================
export const PATRONES = {
  NOMBRE: PATRON_NOMBRE,
  NUMEROS: PATRON_NUMEROS,
  NUMERO_PROCESO: PATRON_NUMERO_PROCESO,
  EMAIL_PREFIX: PATRON_EMAIL_PREFIX,
  TEXTO_GENERAL: PATRON_TEXTO_GENERAL,
  BUSQUEDA: PATRON_BUSQUEDA,
} as const;
