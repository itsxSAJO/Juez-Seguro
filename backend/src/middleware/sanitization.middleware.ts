// ============================================================================
// JUEZ SEGURO BACKEND - Middleware de Sanitización y Validación
// Protección adicional contra SQL Injection y XSS
// ============================================================================
// Common Criteria: FDP_ITC (Import from outside TSF control)
// - Sanitiza todas las entradas de usuario
// - Detecta y bloquea patrones de SQL Injection
// - Escapa caracteres peligrosos para prevenir XSS
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { loggers } from "../services/logger.service.js";
import { auditService } from "../services/audit.service.js";

const log = loggers.security;

// ============================================================================
// PATRONES DE SQL INJECTION
// Detecta intentos comunes de inyección SQL
// NOTA: Los patrones están diseñados para minimizar falsos positivos
// mientras detectan ataques reales
// ============================================================================
const SQL_INJECTION_PATTERNS = [
  // Comentarios SQL dentro de contexto sospechoso
  // Solo detectar -- cuando está precedido por ' o espacio y comilla
  /'\s*--/g,                          // '-- (comentario después de comilla)
  /\/\*.*\*\//g,                      // /* cualquier cosa */ (comentario de bloque)
  
  // UNION SELECT es casi siempre malicioso
  /\bUNION\s+ALL\s+SELECT\b/gi,
  /\bUNION\s+SELECT\b/gi,
  
  // Comandos DDL/DML con contexto sospechoso
  /'\s*;\s*DROP\b/gi,                 // '; DROP (intento de encadenar DROP)
  /'\s*;\s*DELETE\b/gi,               // '; DELETE
  /'\s*;\s*UPDATE\b/gi,               // '; UPDATE
  /'\s*;\s*INSERT\b/gi,               // '; INSERT
  /'\s*;\s*ALTER\b/gi,                // '; ALTER
  /'\s*;\s*TRUNCATE\b/gi,             // '; TRUNCATE
  
  // Bypass de autenticación - estos son casi siempre ataques
  /'\s*OR\s+'?1'?\s*=\s*'?1/gi,       // ' OR '1'='1
  /'\s*OR\s+''='/gi,                  // ' OR ''='
  /'\s*OR\s+TRUE\b/gi,                // ' OR TRUE
  /"\s*OR\s+"?1"?\s*=\s*"?1/gi,       // " OR "1"="1
  /'\s*AND\s+'?1'?\s*=\s*'?1/gi,      // ' AND '1'='1
  /'\s*;\s*--/gi,                     // '; --
  
  // Funciones peligrosas de time-based injection
  /\bSLEEP\s*\(\s*\d+\s*\)/gi,        // SLEEP(5)
  /\bBENCHMARK\s*\(/gi,               // BENCHMARK(
  /\bWAITFOR\s+DELAY\b/gi,            // WAITFOR DELAY
  /\bPG_SLEEP\s*\(/gi,                // pg_sleep(
  
  // Funciones de lectura de archivos
  /\bLOAD_FILE\s*\(/gi,
  /\bINTO\s+(OUT|DUMP)FILE\b/gi,
  
  // Ejecución de procedimientos
  /\bEXEC\s+(sp_|xp_)/gi,             // EXEC sp_ o xp_ (procedimientos SQL Server)
  
  // Información del sistema - contexto de extracción
  /'\s*;\s*SELECT\s+.*@@\w+/gi,       // '; SELECT @@version
  /'\s*;\s*SELECT\s+.*CURRENT_USER/gi,
];

// ============================================================================
// PATRONES DE XSS
// Detecta intentos de Cross-Site Scripting
// ============================================================================
const XSS_PATTERNS = [
  /<script\b[^>]*>/gi,
  /<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,  // onclick=, onerror=, etc.
  /<iframe\b/gi,
  /<object\b/gi,
  /<embed\b/gi,
  /<svg\b[^>]*onload/gi,
  /\beval\s*\(/gi,
  /\bdocument\.(cookie|location|write)/gi,
  /\bwindow\.(location|open)/gi,
];

// ============================================================================
// FUNCIONES DE DETECCIÓN
// ============================================================================

/**
 * Verifica si un string contiene patrones de SQL Injection
 */
function containsSQLInjection(value: string): { detected: boolean; pattern?: string } {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return { detected: true, pattern: pattern.toString() };
    }
    // Reset regex lastIndex para patrones con flag 'g'
    pattern.lastIndex = 0;
  }
  return { detected: false };
}

/**
 * Verifica si un string contiene patrones de XSS
 */
function containsXSS(value: string): { detected: boolean; pattern?: string } {
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(value)) {
      return { detected: true, pattern: pattern.toString() };
    }
    pattern.lastIndex = 0;
  }
  return { detected: false };
}

/**
 * Sanitiza un string removiendo/escapando caracteres peligrosos
 */
export function sanitizeString(value: string): string {
  if (typeof value !== "string") return value;
  
  return value
    // Remover caracteres nulos
    .replace(/\0/g, "")
    // Escapar comillas simples (doble escape para SQL)
    .replace(/'/g, "''")
    // Escapar backslashes
    .replace(/\\/g, "\\\\")
    // Remover caracteres de control excepto newlines y tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Limitar longitud máxima
    .substring(0, 10000);
}

/**
 * Sanitiza HTML para prevenir XSS
 */
export function sanitizeHTML(value: string): string {
  if (typeof value !== "string") return value;
  
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Recursivamente escanea y sanitiza un objeto
 */
function scanAndSanitizeObject(
  obj: Record<string, unknown>,
  path: string = "",
  detections: Array<{ path: string; type: string; pattern: string }> = []
): { sanitized: Record<string, unknown>; detections: Array<{ path: string; type: string; pattern: string }> } {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (typeof value === "string") {
      // Verificar SQL Injection
      const sqlCheck = containsSQLInjection(value);
      if (sqlCheck.detected) {
        detections.push({
          path: currentPath,
          type: "SQL_INJECTION",
          pattern: sqlCheck.pattern!,
        });
      }
      
      // Verificar XSS
      const xssCheck = containsXSS(value);
      if (xssCheck.detected) {
        detections.push({
          path: currentPath,
          type: "XSS",
          pattern: xssCheck.pattern!,
        });
      }
      
      // Sanitizar el valor
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item, index) => {
        if (typeof item === "string") {
          const itemPath = `${currentPath}[${index}]`;
          
          const sqlCheck = containsSQLInjection(item);
          if (sqlCheck.detected) {
            detections.push({ path: itemPath, type: "SQL_INJECTION", pattern: sqlCheck.pattern! });
          }
          
          const xssCheck = containsXSS(item);
          if (xssCheck.detected) {
            detections.push({ path: itemPath, type: "XSS", pattern: xssCheck.pattern! });
          }
          
          return sanitizeString(item);
        } else if (typeof item === "object" && item !== null) {
          const result = scanAndSanitizeObject(item as Record<string, unknown>, `${currentPath}[${index}]`, detections);
          return result.sanitized;
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      const result = scanAndSanitizeObject(value as Record<string, unknown>, currentPath, detections);
      sanitized[key] = result.sanitized;
    } else {
      sanitized[key] = value;
    }
  }
  
  return { sanitized, detections };
}

// ============================================================================
// MIDDLEWARE DE SANITIZACIÓN
// ============================================================================

export interface SanitizationOptions {
  /** Bloquear request si se detecta SQL Injection (default: true) */
  blockSQLInjection?: boolean;
  /** Bloquear request si se detecta XSS (default: false - solo sanitiza) */
  blockXSS?: boolean;
  /** Rutas a excluir de la sanitización */
  excludePaths?: string[];
  /** Registrar intentos de ataque en auditoría */
  logAttacks?: boolean;
}

const defaultOptions: SanitizationOptions = {
  blockSQLInjection: true,
  blockXSS: false, // Solo sanitiza, no bloquea
  excludePaths: [],
  logAttacks: true,
};

/**
 * Middleware de sanitización de entrada
 * Protege contra SQL Injection y XSS
 */
export function sanitizationMiddleware(options: SanitizationOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  
  return async (req: Request, res: Response, next: NextFunction) => {
    // Verificar si la ruta está excluida
    if (opts.excludePaths?.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    const allDetections: Array<{ source: string; path: string; type: string; pattern: string; value: string }> = [];
    
    // Escanear body
    if (req.body && typeof req.body === "object") {
      const { sanitized, detections } = scanAndSanitizeObject(req.body);
      req.body = sanitized;
      
      for (const d of detections) {
        const originalValue = getNestedValue(req.body, d.path);
        allDetections.push({
          source: "body",
          ...d,
          value: typeof originalValue === "string" ? originalValue.substring(0, 100) : String(originalValue),
        });
      }
    }
    
    // Escanear query params
    if (req.query && typeof req.query === "object") {
      const { sanitized, detections } = scanAndSanitizeObject(req.query as Record<string, unknown>);
      req.query = sanitized as typeof req.query;
      
      for (const d of detections) {
        const originalValue = getNestedValue(req.query, d.path);
        allDetections.push({
          source: "query",
          ...d,
          value: typeof originalValue === "string" ? originalValue.substring(0, 100) : String(originalValue),
        });
      }
    }
    
    // Escanear params de ruta
    if (req.params && typeof req.params === "object") {
      const { sanitized, detections } = scanAndSanitizeObject(req.params);
      req.params = sanitized as typeof req.params;
      
      for (const d of detections) {
        allDetections.push({
          source: "params",
          ...d,
          value: req.params[d.path]?.substring(0, 100) || "",
        });
      }
    }
    
    // Procesar detecciones
    if (allDetections.length > 0) {
      const sqlInjections = allDetections.filter(d => d.type === "SQL_INJECTION");
      const xssAttempts = allDetections.filter(d => d.type === "XSS");
      
      // Registrar en auditoría
      if (opts.logAttacks) {
        const ip = req.ip || req.socket.remoteAddress || "unknown";
        const userId = (req as Request & { user?: { correo?: string } }).user?.correo;
        
        for (const detection of allDetections) {
          log.warn(`⚠️  ${detection.type} detectado`, {
            ip,
            userId,
            path: req.path,
            method: req.method,
            source: detection.source,
            field: detection.path,
            pattern: detection.pattern,
            value: detection.value,
          });
          
          // Registrar en auditoría como alerta de seguridad
          try {
            await auditService.registrarAlertaSeguridad({
              tipoAlerta: detection.type === "SQL_INJECTION" ? "SQL_INJECTION_ATTEMPT" : "XSS_ATTEMPT",
              severidad: detection.type === "SQL_INJECTION" ? "ALTA" : "MEDIA",
              titulo: `Intento de ${detection.type} detectado`,
              descripcion: `Se detectó un intento de ${detection.type} en ${detection.source}.${detection.path}. Patrón: ${detection.pattern}`,
              usuarioId: userId,
              ipOrigen: ip,
              accionAutomatica: opts.blockSQLInjection && detection.type === "SQL_INJECTION" ? "BLOQUEADO" : "SANITIZADO",
              requiereRevision: detection.type === "SQL_INJECTION",
            });
          } catch (auditError) {
            log.error("Error registrando alerta de seguridad:", auditError);
          }
        }
      }
      
      // Bloquear si se detectó SQL Injection y está configurado para bloquear
      if (opts.blockSQLInjection && sqlInjections.length > 0) {
        log.error(`🚫 SQL Injection BLOQUEADO`, {
          ip: req.ip,
          path: req.path,
          detections: sqlInjections,
        });
        
        res.status(400).json({
          success: false,
          error: "Entrada inválida detectada",
          code: "INVALID_INPUT",
        });
        return;
      }
      
      // Bloquear si se detectó XSS y está configurado para bloquear
      if (opts.blockXSS && xssAttempts.length > 0) {
        log.warn(`🚫 XSS BLOQUEADO`, {
          ip: req.ip,
          path: req.path,
          detections: xssAttempts,
        });
        
        res.status(400).json({
          success: false,
          error: "Contenido no permitido detectado",
          code: "INVALID_CONTENT",
        });
        return;
      }
    }
    
    next();
  };
}

/**
 * Obtiene un valor anidado de un objeto usando notación de punto
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") {
      // Manejar índices de array
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrKey, index] = arrayMatch;
        const arr = (acc as Record<string, unknown>)[arrKey];
        if (Array.isArray(arr)) {
          return arr[parseInt(index, 10)];
        }
      }
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

export default sanitizationMiddleware;

/**
 * Middleware estricto - Bloquea tanto SQL Injection como XSS
 */
export const strictSanitization = sanitizationMiddleware({
  blockSQLInjection: true,
  blockXSS: true,
  logAttacks: true,
});

/**
 * Middleware permisivo - Solo sanitiza, no bloquea (útil para desarrollo)
 */
export const permissiveSanitization = sanitizationMiddleware({
  blockSQLInjection: false,
  blockXSS: false,
  logAttacks: true,
});
