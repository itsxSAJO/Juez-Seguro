// ============================================================================
// JUEZ SEGURO - Validador de Número de Causa
// HU-UP-001: Validación de formato antes de consultar DB
// ============================================================================

import { Request, Response, NextFunction } from "express";

// ============================================================================
// SEGURIDAD: Función auxiliar para extracción segura de query params
// ============================================================================

/**
 * SEGURIDAD: Extrae un query parameter como string de forma segura.
 * Previene ataques de HTTP Parameter Pollution (HPP) donde el atacante
 * envía arrays u objetos en lugar de strings (ej: ?q[0]=val o ?q[key]=val).
 * 
 * CWE-1287: Improper Validation of Specified Type of Input
 * 
 * @param value - Valor del query parameter (puede ser string, array u objeto)
 * @returns string si es válido, undefined si no es un string primitivo
 * 
 * @example
 * // Request: ?q=test → "test"
 * // Request: ?q[0]=test → undefined (ataque HPP)
 * // Request: ?q[key]=test → undefined (ataque HPP)
 */
function getSafeQueryString(value: unknown): string | undefined {
  // Si es undefined o null, retornar undefined
  if (value === undefined || value === null) {
    return undefined;
  }
  
  // SEGURIDAD: Solo aceptar strings primitivos
  // El casting "as string" de TypeScript desaparece en runtime,
  // por lo que debemos validar explícitamente el tipo
  if (typeof value !== 'string') {
    return undefined;
  }
  
  return value;
}

// ============================================================================
// Formato del Número de Causa Ecuatoriano
// ============================================================================
// Formato: PPCCC-AAAA-NNNNN[L]
// PP = Código de provincia (01-24)
// CCC = Código de juzgado/unidad (001-999)
// AAAA = Año (2000-2099)
// NNNNN = Número secuencial (00001-99999)
// L = Letra opcional (A-Z)
// 
// Ejemplos válidos:
// - 17332-2024-00123
// - 17332-2024-00123A
// - 09201-2023-54321B
// ============================================================================

// Regex para validar formato estándar ecuatoriano
const CAUSA_REGEX = /^(0[1-9]|1[0-9]|2[0-4])\d{3}-20\d{2}-\d{5}[A-Z]?$/;

// Regex más flexible para búsquedas parciales
const CAUSA_PARTIAL_REGEX = /^(0[1-9]|1[0-9]|2[0-4])?\d{0,3}-?20\d{0,2}-?\d{0,5}[A-Z]?$/;

/**
 * Valida si un número de causa tiene formato correcto
 */
export const isValidCausaFormat = (numeroCausa: string): boolean => {
  if (!numeroCausa || typeof numeroCausa !== "string") {
    return false;
  }
  
  const cleaned = numeroCausa.trim().toUpperCase();
  return CAUSA_REGEX.test(cleaned);
};

/**
 * Valida si es una búsqueda parcial válida (para autocompletado)
 */
export const isValidPartialCausa = (query: string): boolean => {
  if (!query || typeof query !== "string") {
    return false;
  }
  
  const cleaned = query.trim().toUpperCase();
  
  // Mínimo 5 caracteres para búsqueda
  if (cleaned.length < 5) {
    return false;
  }
  
  return CAUSA_PARTIAL_REGEX.test(cleaned);
};

/**
 * Normaliza un número de causa
 */
export const normalizeCausaNumber = (numeroCausa: string): string => {
  return numeroCausa.trim().toUpperCase();
};

/**
 * Extrae componentes del número de causa
 */
export const parseCausaNumber = (numeroCausa: string): {
  provincia: string;
  juzgado: string;
  año: string;
  secuencial: string;
  letra: string | null;
} | null => {
  const cleaned = normalizeCausaNumber(numeroCausa);
  
  if (!isValidCausaFormat(cleaned)) {
    return null;
  }
  
  const match = cleaned.match(/^(\d{2})(\d{3})-(\d{4})-(\d{5})([A-Z])?$/);
  
  if (!match) {
    return null;
  }
  
  return {
    provincia: match[1],
    juzgado: match[2],
    año: match[3],
    secuencial: match[4],
    letra: match[5] || null,
  };
};

/**
 * Middleware para validar formato de número de causa
 * SEGURIDAD: Validación de tipo en runtime para prevenir CWE-1287
 */
export const validateCausaFormatMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // SEGURIDAD: Extraer número de causa de forma segura (previene HPP)
  const numeroCausa = 
    getSafeQueryString(req.query.numeroProceso) ||
    req.params.numeroProceso ||
    (typeof req.body?.numeroProceso === 'string' ? req.body.numeroProceso : undefined);
  
  if (!numeroCausa) {
    res.status(400).json({
      success: false,
      error: "Número de proceso requerido. Debe ser un texto válido.",
      code: "MISSING_PROCESS_NUMBER",
    });
    return;
  }
  
  // Validar formato
  if (!isValidCausaFormat(numeroCausa)) {
    res.status(400).json({
      success: false,
      error: "Formato de número de proceso inválido. Use el formato: PPCCC-AAAA-NNNNN (ej: 17332-2024-00123)",
      code: "INVALID_FORMAT",
      example: "17332-2024-00123",
    });
    return;
  }
  
  // Normalizar y continuar
  if (req.query.numeroProceso) {
    req.query.numeroProceso = normalizeCausaNumber(numeroCausa);
  }
  if (req.params.numeroProceso) {
    req.params.numeroProceso = normalizeCausaNumber(numeroCausa);
  }
  if (req.body?.numeroProceso) {
    req.body.numeroProceso = normalizeCausaNumber(numeroCausa);
  }
  
  next();
};

/**
 * Middleware para validar búsquedas parciales
 * SEGURIDAD: Validación de tipo en runtime para prevenir CWE-1287
 */
export const validatePartialSearchMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // SEGURIDAD: Extraer query params de forma segura (previene CWE-1287 y HPP)
  // El casting "as string" de TypeScript desaparece en runtime
  // Si el atacante envía ?q[0]=val o ?q[key]=val, Express lo parsea como array/objeto
  const query = getSafeQueryString(req.query.q) || getSafeQueryString(req.query.busqueda);
  
  if (!query) {
    res.status(400).json({
      success: false,
      error: "Término de búsqueda requerido. Debe ser un texto válido.",
      code: "MISSING_SEARCH_TERM",
    });
    return;
  }
  
  // SEGURIDAD: Ahora es seguro usar .trim() porque validamos el tipo en runtime
  const trimmedQuery = query.trim();
  
  // Mínimo 5 caracteres
  if (trimmedQuery.length < 5) {
    res.status(400).json({
      success: false,
      error: "El término de búsqueda debe tener al menos 5 caracteres",
      code: "SEARCH_TOO_SHORT",
      minLength: 5,
    });
    return;
  }
  
  next();
};
