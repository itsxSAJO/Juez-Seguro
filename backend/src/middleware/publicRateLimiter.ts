// ============================================================================
// JUEZ SEGURO - Rate Limiter para Portal Ciudadano
// HU-UP-001: Protección contra consultas abusivas
// ============================================================================

import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

// ============================================================================
// Configuración de Rate Limiting para Portal Público
// ============================================================================

// Límite estricto: 15 peticiones por minuto por IP
export const publicSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 15, // 15 peticiones por minuto
  message: {
    success: false,
    error: "Demasiadas consultas. Por favor espere un momento antes de continuar.",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: 60,
  },
  standardHeaders: true, // Incluir headers RateLimit-*
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Usar IP real (considerar proxy)
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  handler: (req: Request, res: Response) => {
    console.warn(`[RATE_LIMIT] IP ${req.ip} excedió límite en /api/publico`);
    res.status(429).json({
      success: false,
      error: "Demasiadas consultas. Por favor espere un momento antes de continuar.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: 60,
    });
  },
});

// ============================================================================
// Tracker de Búsquedas Fallidas con Delay Progresivo
// ============================================================================

interface FailedSearchRecord {
  count: number;
  lastAttempt: number;
  blockedUntil: number | null;
}

// Almacenamiento en memoria (en producción usar Redis)
const failedSearches = new Map<string, FailedSearchRecord>();

// Configuración de delays progresivos
const DELAY_PROGRESSION = [0, 1000, 2000, 4000, 8000]; // ms
const MAX_FAILED_BEFORE_BLOCK = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Limpiar cada 5 minutos

// Limpiar registros antiguos periódicamente
setInterval(() => {
  const now = Date.now();
  const expireTime = 30 * 60 * 1000; // 30 minutos
  
  for (const [ip, record] of failedSearches.entries()) {
    if (now - record.lastAttempt > expireTime && !record.blockedUntil) {
      failedSearches.delete(ip);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Registra una búsqueda fallida para una IP
 */
export const recordFailedSearch = (ip: string): void => {
  const now = Date.now();
  const record = failedSearches.get(ip) || { count: 0, lastAttempt: 0, blockedUntil: null };
  
  record.count++;
  record.lastAttempt = now;
  
  // Si excede el máximo, bloquear
  if (record.count >= MAX_FAILED_BEFORE_BLOCK) {
    record.blockedUntil = now + BLOCK_DURATION;
    console.warn(`[SECURITY] IP ${ip} bloqueada por ${BLOCK_DURATION/1000}s - demasiadas búsquedas fallidas`);
  }
  
  failedSearches.set(ip, record);
};

/**
 * Registra una búsqueda exitosa (resetea contador)
 */
export const recordSuccessfulSearch = (ip: string): void => {
  failedSearches.delete(ip);
};

/**
 * Obtiene el delay requerido para una IP
 */
export const getRequiredDelay = (ip: string): number => {
  const record = failedSearches.get(ip);
  if (!record) return 0;
  
  const delayIndex = Math.min(record.count, DELAY_PROGRESSION.length - 1);
  return DELAY_PROGRESSION[delayIndex];
};

/**
 * Verifica si una IP está bloqueada
 */
export const isIpBlocked = (ip: string): { blocked: boolean; remainingTime: number } => {
  const record = failedSearches.get(ip);
  
  if (!record || !record.blockedUntil) {
    return { blocked: false, remainingTime: 0 };
  }
  
  const now = Date.now();
  if (now >= record.blockedUntil) {
    // Desbloquear pero mantener historial reducido
    record.blockedUntil = null;
    record.count = Math.floor(record.count / 2);
    failedSearches.set(ip, record);
    return { blocked: false, remainingTime: 0 };
  }
  
  return {
    blocked: true,
    remainingTime: Math.ceil((record.blockedUntil - now) / 1000),
  };
};

/**
 * Middleware de delay progresivo
 */
export const progressiveDelayMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  
  // Verificar si está bloqueada
  const blockStatus = isIpBlocked(ip);
  if (blockStatus.blocked) {
    res.status(429).json({
      success: false,
      error: `IP bloqueada temporalmente por demasiados intentos fallidos. Intente de nuevo en ${blockStatus.remainingTime} segundos.`,
      code: "IP_BLOCKED",
      retryAfter: blockStatus.remainingTime,
    });
    return;
  }
  
  // Aplicar delay si es necesario
  const delay = getRequiredDelay(ip);
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  next();
};

/**
 * Obtiene estadísticas del rate limiter (para monitoreo)
 */
export const getRateLimiterStats = (): {
  activeRecords: number;
  blockedIps: number;
} => {
  let blockedCount = 0;
  const now = Date.now();
  
  for (const record of failedSearches.values()) {
    if (record.blockedUntil && record.blockedUntil > now) {
      blockedCount++;
    }
  }
  
  return {
    activeRecords: failedSearches.size,
    blockedIps: blockedCount,
  };
};
