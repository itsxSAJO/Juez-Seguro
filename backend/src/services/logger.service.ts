// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Logging Estructurado (FAU)
// ============================================================================
// Logger centralizado que cumple con Common Criteria FAU (Auditoría)
// - Logs estructurados en JSON para análisis
// - Niveles configurables por entorno
// - Sanitización de datos sensibles
// - Contexto de request (correlationId)
// ============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  correlationId?: string;
}

// Datos sensibles que nunca deben aparecer en logs
const SENSITIVE_KEYS = [
  "password",
  "password_hash",
  "token",
  "secret",
  "key",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "pfx",
  "privatekey",
  "private_key",
  "credential",
];

/**
 * Sanitiza un objeto removiendo datos sensibles
 */
function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    // Ocultar tokens JWT
    if (obj.match(/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
      return "[JWT_TOKEN_REDACTED]";
    }
    // Ocultar hashes bcrypt
    if (obj.match(/^\$2[aby]?\$\d{1,2}\$.{53}$/)) {
      return "[BCRYPT_HASH_REDACTED]";
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => keyLower.includes(s))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Servicio de Logger Estructurado
 * Cumple con FAU_GEN.1 - Generación de registros de auditoría
 */
class Logger {
  private minLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.isProduction ? "info" : "debug");
  }

  private levelPriority(level: LogLevel): number {
    const priorities: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return priorities[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority(level) >= this.levelPriority(this.minLevel);
  }

  private formatEntry(entry: LogEntry): string {
    if (this.isProduction) {
      // En producción: JSON estructurado para sistemas de logging
      return JSON.stringify({
        ...entry,
        data: entry.data ? sanitize(entry.data) : undefined,
      });
    }

    // En desarrollo: formato legible con colores
    const colors = {
      debug: "\x1b[36m", // Cyan
      info: "\x1b[32m", // Green
      warn: "\x1b[33m", // Yellow
      error: "\x1b[31m", // Red
    };
    const reset = "\x1b[0m";
    const dim = "\x1b[2m";

    const color = colors[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const moduleStr = `[${entry.module}]`;

    let output = `${dim}${entry.timestamp}${reset} ${color}${levelStr}${reset} ${moduleStr} ${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      const sanitizedData = sanitize(entry.data);
      output += ` ${dim}${JSON.stringify(sanitizedData)}${reset}`;
    }

    return output;
  }

  private log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  /**
   * Crea un logger específico para un módulo
   */
  module(moduleName: string): ModuleLogger {
    return new ModuleLogger(this, moduleName);
  }

  // Métodos directos (para uso rápido)
  debug(module: string, message: string, data?: Record<string, unknown>): void {
    this.log("debug", module, message, data);
  }

  info(module: string, message: string, data?: Record<string, unknown>): void {
    this.log("info", module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>): void {
    this.log("warn", module, message, data);
  }

  error(module: string, message: string, data?: Record<string, unknown>): void {
    this.log("error", module, message, data);
  }
}

/**
 * Logger específico para un módulo
 */
class ModuleLogger {
  constructor(
    private logger: Logger,
    private moduleName: string
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(this.moduleName, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(this.moduleName, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(this.moduleName, message, data);
  }

  /**
   * Log de error - acepta error como segundo parámetro o data como objeto
  /**
   * Log de error - acepta error como segundo parámetro o data como objeto
   */
  error(message: string, errorOrData?: unknown): void {
    if (errorOrData instanceof Error) {
      // Si es un Error, extraer información útil
      this.logger.error(this.moduleName, message, {
        errorMessage: errorOrData.message,
        errorStack: errorOrData.stack?.split("\n").slice(0, 5).join("\n"),
      });
    } else if (typeof errorOrData === "object" && errorOrData !== null) {
      // Si es un objeto, usarlo como data
      this.logger.error(this.moduleName, message, errorOrData as Record<string, unknown>);
    } else if (errorOrData !== undefined) {
      // Cualquier otro tipo, convertir a string
      this.logger.error(this.moduleName, message, { error: String(errorOrData) });
    } else {
      this.logger.error(this.moduleName, message);
    }
  }
}

// Instancia singleton
export const logger = new Logger();

// Loggers pre-configurados por módulo
export const loggers = {
  auth: logger.module("AUTH"),
  usuarios: logger.module("USUARIOS"),
  causas: logger.module("CAUSAS"),
  documentos: logger.module("DOCUMENTOS"),
  audiencias: logger.module("AUDIENCIAS"),
  notificaciones: logger.module("NOTIFICACIONES"),
  firma: logger.module("FIRMA"),
  pki: logger.module("PKI"),
  secrets: logger.module("SECRETS"),
  audit: logger.module("AUDIT"),
  email: logger.module("EMAIL"),
  plazos: logger.module("PLAZOS"),
  alertas: logger.module("ALERTAS"),
  rateLimit: logger.module("RATE_LIMIT"),
  security: logger.module("SECURITY"),
  db: logger.module("DB"),
  server: logger.module("SERVER"),
  system: logger.module("SYSTEM"),
};

export default logger;
