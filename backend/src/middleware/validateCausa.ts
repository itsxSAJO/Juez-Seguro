// ============================================================================
// JUEZ SEGURO - Validador de Número de Causa
// HU-UP-001: Validación de formato antes de consultar DB
// ============================================================================

import { Request, Response, NextFunction } from "express";

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
 */
export const validateCausaFormatMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Obtener número de causa de query, params o body
  const numeroCausa = 
    req.query.numeroProceso as string ||
    req.params.numeroProceso ||
    req.body?.numeroProceso;
  
  if (!numeroCausa) {
    res.status(400).json({
      success: false,
      error: "Número de proceso requerido",
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
 */
export const validatePartialSearchMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const query = req.query.q as string || req.query.busqueda as string;
  
  if (!query) {
    res.status(400).json({
      success: false,
      error: "Término de búsqueda requerido",
      code: "MISSING_SEARCH_TERM",
    });
    return;
  }
  
  // Mínimo 5 caracteres
  if (query.trim().length < 5) {
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
