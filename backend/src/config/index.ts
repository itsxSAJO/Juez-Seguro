// ============================================================================
// JUEZ SEGURO BACKEND - Configuración
// Variables de entorno y configuración centralizada
// SEGURIDAD: Principio "Fail Fast" - No arranca sin configuración crítica
// ============================================================================
// ARQUITECTURA DE SECRETOS:
// - Secretos críticos (JWT, HMAC, PKI) ahora se almacenan en db_secrets
// - Solo MASTER_KEY_PASSWORD viene del entorno
// - La BD db_secrets almacena secretos encriptados con AES-256-GCM
// ============================================================================

import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ============================================================================
// UTILIDADES DE VALIDACIÓN - Principio "Fail Fast"
// ============================================================================

/**
 * Obtiene una variable de entorno OBLIGATORIA.
 * Si no existe o está vacía, lanza una excepción y detiene la aplicación.
 * NUNCA usa valores por defecto para secretos o credenciales.
 * 
 * @param name - Nombre de la variable de entorno
 * @param description - Descripción para el mensaje de error
 * @returns El valor de la variable (tipado como string, nunca undefined)
 * @throws Error si la variable no está definida
 */
export function getRequiredEnv(name: string, description?: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    const desc = description ? ` (${description})` : "";
    // Mensaje solo para logs del servidor, nunca expuesto al navegador
    throw new Error(
      `\n` +
      `╔══════════════════════════════════════════════════════════════════╗\n` +
      `║  ❌ ERROR FATAL DE CONFIGURACIÓN                                 ║\n` +
      `╠══════════════════════════════════════════════════════════════════╣\n` +
      `║  Variable: ${name.padEnd(52)}║\n` +
      `║  ${desc.padEnd(64)}║\n` +
      `╠══════════════════════════════════════════════════════════════════╣\n` +
      `║  La aplicación NO puede iniciar sin esta configuración.         ║\n` +
      `║  Por favor, configúrala en el archivo .env                      ║\n` +
      `╚══════════════════════════════════════════════════════════════════╝\n`
    );
  }
  return value;
}

/**
 * Obtiene una variable de entorno opcional con valor por defecto.
 * Usar SOLO para configuraciones no sensibles (puertos, timeouts, etc.)
 * NUNCA usar para secretos o credenciales.
 * 
 * @param name - Nombre de la variable de entorno
 * @param defaultValue - Valor por defecto si no está definida
 * @returns El valor de la variable o el valor por defecto
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Valida y normaliza los orígenes CORS.
 * - En producción: Requiere HTTPS (excepto localhost para pruebas internas)
 * - Rechaza wildcards (*) cuando se usan credenciales
 * - Valida formato de URLs
 * 
 * @param origins - Lista de orígenes separados por coma
 * @param isProduction - Si estamos en modo producción
 * @returns Array de orígenes validados
 */
function validateCorsOrigins(origins: string, isProduction: boolean): string[] {
  const originList = origins.split(",").map(o => o.trim()).filter(o => o.length > 0);
  
  if (originList.length === 0) {
    if (isProduction) {
      throw new Error(
        `\n╔══════════════════════════════════════════════════════════════════╗\n` +
        `║  ❌ ERROR DE SEGURIDAD CORS                                      ║\n` +
        `╠══════════════════════════════════════════════════════════════════╣\n` +
        `║  CORS_ORIGIN no está configurado en producción.                 ║\n` +
        `║  Debe especificar los dominios permitidos explícitamente.       ║\n` +
        `║  Ejemplo: CORS_ORIGIN=https://app.judicatura.gob.ec             ║\n` +
        `╚══════════════════════════════════════════════════════════════════╝\n`
      );
    }
    // En desarrollo, permitir localhost por defecto
    return ["http://localhost:5173"];
  }

  const validatedOrigins: string[] = [];

  for (const origin of originList) {
    // Rechazar wildcard con credenciales (inseguro)
    if (origin === "*") {
      throw new Error(
        `\n╔══════════════════════════════════════════════════════════════════╗\n` +
        `║  ❌ ERROR DE SEGURIDAD CORS                                      ║\n` +
        `╠══════════════════════════════════════════════════════════════════╣\n` +
        `║  CORS origin "*" no está permitido con credentials: true        ║\n` +
        `║  Esto es rechazado por los navegadores y es inseguro.           ║\n` +
        `║  Especifique dominios explícitos en CORS_ORIGIN.                ║\n` +
        `╚══════════════════════════════════════════════════════════════════╝\n`
      );
    }

    // Validar formato de URL
    try {
      const url = new URL(origin);
      
      // En producción, requerir HTTPS (excepto localhost para testing interno)
      if (isProduction) {
        const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
        if (url.protocol !== "https:" && !isLocalhost) {
          console.warn(
            `⚠️  ADVERTENCIA CORS: El origen "${origin}" no usa HTTPS. ` +
            `En producción se recomienda usar solo HTTPS.`
          );
        }
      }

      // Normalizar: quitar trailing slash
      validatedOrigins.push(origin.replace(/\/$/, ""));
      
    } catch {
      throw new Error(
        `\n╔══════════════════════════════════════════════════════════════════╗\n` +
        `║  ❌ ERROR DE CONFIGURACIÓN CORS                                  ║\n` +
        `╠══════════════════════════════════════════════════════════════════╣\n` +
        `║  CORS origin inválido: ${origin.padEnd(41)}║\n` +
        `║  Debe ser una URL válida con protocolo (http:// o https://)     ║\n` +
        `║  Ejemplo: https://app.judicatura.gob.ec                         ║\n` +
        `╚══════════════════════════════════════════════════════════════════╝\n`
      );
    }
  }

  return validatedOrigins;
}

// ============================================================================
// VALIDACIÓN DE CREDENCIALES DE BD (necesarias para arrancar)
// Las contraseñas de las BDs vienen del entorno (no son secretos de negocio)
// ============================================================================

const DB_USERS_PASSWORD = getRequiredEnv("DB_USERS_PASSWORD", "Contraseña BD de usuarios");
const DB_CASES_PASSWORD = getRequiredEnv("DB_CASES_PASSWORD", "Contraseña BD de casos");
const DB_LOGS_PASSWORD = getRequiredEnv("DB_LOGS_PASSWORD", "Contraseña BD de logs");
const DB_SECRETS_PASSWORD = getRequiredEnv("DB_SECRETS_PASSWORD", "Contraseña BD de secretos");
const MASTER_KEY_PASSWORD = getRequiredEnv("MASTER_KEY_PASSWORD", "Clave maestra para descifrar secretos");

// ============================================================================
// CONFIGURACIÓN BASE (sin secretos de negocio)
// Esta configuración está disponible ANTES de conectar a db_secrets
// ============================================================================

export const configBase = {
  // Servidor
  port: parseInt(getOptionalEnv("PORT", "3000"), 10),
  nodeEnv: getOptionalEnv("NODE_ENV", "development"),
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",

  // Clave maestra para SecretsManager
  masterKeyPassword: MASTER_KEY_PASSWORD,

  // Base de Datos - Usuarios (FIA - Identificación y Autenticación)
  dbUsers: {
    host: getOptionalEnv("DB_USERS_HOST", "localhost"),
    port: parseInt(getOptionalEnv("DB_USERS_PORT", "5435"), 10),
    database: getOptionalEnv("DB_USERS_NAME", "db_usuarios"),
    user: getOptionalEnv("DB_USERS_USER", "admin_users"),
    password: DB_USERS_PASSWORD,
  },

  // Base de Datos - Casos (FDP - Protección de Datos)
  dbCases: {
    host: getOptionalEnv("DB_CASES_HOST", "localhost"),
    port: parseInt(getOptionalEnv("DB_CASES_PORT", "5433"), 10),
    database: getOptionalEnv("DB_CASES_NAME", "db_casos"),
    user: getOptionalEnv("DB_CASES_USER", "admin_cases"),
    password: DB_CASES_PASSWORD,
  },

  // Base de Datos - Logs (FAU - Auditoría)
  dbLogs: {
    host: getOptionalEnv("DB_LOGS_HOST", "localhost"),
    port: parseInt(getOptionalEnv("DB_LOGS_PORT", "5434"), 10),
    database: getOptionalEnv("DB_LOGS_NAME", "db_logs"),
    user: getOptionalEnv("DB_LOGS_USER", "admin_logs"),
    password: DB_LOGS_PASSWORD,
  },

  // Base de Datos - Secretos (FCS - Soporte Criptográfico)
  dbSecrets: {
    host: getOptionalEnv("DB_SECRETS_HOST", "localhost"),
    port: parseInt(getOptionalEnv("DB_SECRETS_PORT", "5436"), 10),
    database: getOptionalEnv("DB_SECRETS_NAME", "db_secrets"),
    user: getOptionalEnv("DB_SECRETS_USER", "admin_secrets"),
    password: DB_SECRETS_PASSWORD,
  },

  // Rate Limiting (no sensible)
  rateLimit: {
    windowMs: parseInt(getOptionalEnv("RATE_LIMIT_WINDOW_MS", "900000"), 10),
    maxRequests: parseInt(getOptionalEnv("RATE_LIMIT_MAX_REQUESTS", "100"), 10),
  },

  // CORS (validado para seguridad)
  cors: {
    origin: validateCorsOrigins(
      getOptionalEnv("CORS_ORIGIN", "http://localhost:5173"),
      process.env.NODE_ENV === "production"
    ),
    credentials: true,
  },

  // Email / SMTP (configuración no sensible, credenciales en db_secrets)
  email: {
    host: getOptionalEnv("SMTP_HOST", "smtp.gmail.com"),
    port: parseInt(getOptionalEnv("SMTP_PORT", "587"), 10),
    secure: process.env.SMTP_SECURE === "true",
    from: getOptionalEnv("SMTP_FROM", "noreply@judicatura.gob.ec"),
    fromName: getOptionalEnv("SMTP_FROM_NAME", "Sistema Juez Seguro"),
  },

  // Frontend URL
  frontendUrl: getOptionalEnv("FRONTEND_URL", "http://localhost:8080"),

  // PKI - Rutas (no sensibles)
  pki: {
    basePath: getOptionalEnv("PKI_JUECES_CERTS_PATH", "./certs/jueces"),
    caCertPath: getOptionalEnv("PKI_CA_CERT_PATH", "./certs/ca/ca.crt"),
  },

  // JWT - Solo expiración (el secreto viene de db_secrets)
  jwt: {
    expiresIn: getOptionalEnv("JWT_EXPIRES_IN", "30m"),
    refreshExpiresIn: getOptionalEnv("JWT_REFRESH_EXPIRES_IN", "7d"),
  },

  // Seguridad (configuraciones no sensibles)
  security: {
    bcryptRounds: parseInt(getOptionalEnv("BCRYPT_ROUNDS", "12"), 10),
    maxLoginAttempts: parseInt(getOptionalEnv("MAX_LOGIN_ATTEMPTS", "5"), 10),
    lockoutDurationMinutes: parseInt(getOptionalEnv("LOCKOUT_DURATION_MINUTES", "30"), 10),
  },
};

// ============================================================================
// CONFIGURACIÓN COMPLETA (con secretos de db_secrets)
// Esta configuración se completa DESPUÉS de inicializar SecretsManager
// ============================================================================

// Secretos que se cargarán desde db_secrets
interface SecretsConfig {
  jwtSecret: string;
  pseudonimoHmacSecret: string;
  pfxPassword: string;
  smtpUser?: string;
  smtpPassword?: string;
}

// Configuración mutable que se completa al inicializar
let secretsConfig: SecretsConfig | null = null;

/**
 * Establece los secretos cargados desde db_secrets
 * DEBE llamarse después de inicializar SecretsManager
 */
export function setSecretsConfig(secrets: SecretsConfig): void {
  secretsConfig = secrets;
  // Nota: No usar logger aquí para evitar dependencia circular
}

/**
 * Obtiene los secretos (lanza error si no están cargados)
 */
export function getSecretsConfig(): SecretsConfig {
  if (!secretsConfig) {
    throw new Error(
      "[Config] Secretos no cargados. Inicializa SecretsManager primero."
    );
  }
  return secretsConfig;
}

/**
 * Verifica si los secretos están cargados
 */
export function areSecretsLoaded(): boolean {
  return secretsConfig !== null;
}

// ============================================================================
// CONFIGURACIÓN COMPLETA (para compatibilidad con código existente)
// ============================================================================

// Proxy que combina configBase con secretos
export const config = new Proxy(configBase as typeof configBase & {
  jwt: typeof configBase.jwt & { secret: string };
  security: typeof configBase.security & { pseudonimoHmacSecret: string };
  pki: typeof configBase.pki & { pfxPassword: string };
  email: typeof configBase.email & { user: string; pass: string };
}, {
  get(target, prop) {
    // Propiedades que necesitan secretos
    if (prop === "jwt") {
      return {
        ...target.jwt,
        secret: secretsConfig?.jwtSecret ?? (() => {
          throw new Error("JWT_SECRET no disponible. Inicializa SecretsManager.");
        })(),
      };
    }
    if (prop === "security") {
      return {
        ...target.security,
        pseudonimoHmacSecret: secretsConfig?.pseudonimoHmacSecret ?? (() => {
          throw new Error("PSEUDONIMO_HMAC_SECRET no disponible. Inicializa SecretsManager.");
        })(),
      };
    }
    if (prop === "pki") {
      return {
        ...target.pki,
        pfxPassword: secretsConfig?.pfxPassword ?? (() => {
          throw new Error("PFX_PASSWORD no disponible. Inicializa SecretsManager.");
        })(),
      };
    }
    if (prop === "email") {
      return {
        ...target.email,
        user: secretsConfig?.smtpUser ?? "",
        pass: secretsConfig?.smtpPassword ?? "",
      };
    }
    // Propiedades normales
    return (target as any)[prop];
  },
});

export default config;
