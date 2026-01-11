// ============================================================================
// JUEZ SEGURO BACKEND - Configuración
// Variables de entorno y configuración centralizada
// SEGURIDAD: Principio "Fail Fast" - No arranca sin configuración crítica
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
function getRequiredEnv(name: string, description?: string): string {
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
function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

// ============================================================================
// VALIDACIÓN DE SECRETOS CRÍTICOS (Fail Fast)
// Estas variables son OBLIGATORIAS en TODOS los ambientes
// ============================================================================

const JWT_SECRET = getRequiredEnv("JWT_SECRET", "Secreto para firmar tokens JWT");
const DB_USERS_PASSWORD = getRequiredEnv("DB_USERS_PASSWORD", "Contraseña BD de usuarios");
const DB_CASES_PASSWORD = getRequiredEnv("DB_CASES_PASSWORD", "Contraseña BD de casos");
const DB_LOGS_PASSWORD = getRequiredEnv("DB_LOGS_PASSWORD", "Contraseña BD de logs");
const PSEUDONIMO_HMAC_SECRET = getRequiredEnv("PSEUDONIMO_HMAC_SECRET", "Secreto HMAC para pseudónimos de jueces");
const PFX_PASSWORD = getRequiredEnv("PFX_PASSWORD", "Contraseña del almacén de claves PKI (.pfx/.p12)");

// ============================================================================
// CONFIGURACIÓN EXPORTADA
// ============================================================================

export const config = {
  // Servidor
  port: parseInt(getOptionalEnv("PORT", "3000"), 10),
  nodeEnv: getOptionalEnv("NODE_ENV", "development"),
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",

  // JWT - Secreto OBLIGATORIO, expiración configurable
  jwt: {
    secret: JWT_SECRET,  // Sin fallback - validado arriba
    expiresIn: getOptionalEnv("JWT_EXPIRES_IN", "30m"),
    refreshExpiresIn: getOptionalEnv("JWT_REFRESH_EXPIRES_IN", "7d"),
  },

  // Base de Datos - Usuarios (FIA - Identificación y Autenticación)
  dbUsers: {
    host: getOptionalEnv("DB_USERS_HOST", "localhost"),
    port: parseInt(getOptionalEnv("DB_USERS_PORT", "5432"), 10),
    database: getOptionalEnv("DB_USERS_NAME", "db_usuarios"),
    user: getOptionalEnv("DB_USERS_USER", "admin_users"),
    password: DB_USERS_PASSWORD,  // Sin fallback - validado arriba
  },

  // Base de Datos - Casos (FDP - Protección de Datos)
  dbCases: {
    host: getOptionalEnv("DB_CASES_HOST", "localhost"),
    port: parseInt(getOptionalEnv("DB_CASES_PORT", "5433"), 10),
    database: getOptionalEnv("DB_CASES_NAME", "db_casos"),
    user: getOptionalEnv("DB_CASES_USER", "admin_cases"),
    password: DB_CASES_PASSWORD,  // Sin fallback - validado arriba
  },

  // Base de Datos - Logs (FAU - Auditoría)
  dbLogs: {
    host: getOptionalEnv("DB_LOGS_HOST", "localhost"),
    port: parseInt(getOptionalEnv("DB_LOGS_PORT", "5434"), 10),
    database: getOptionalEnv("DB_LOGS_NAME", "db_logs"),
    user: getOptionalEnv("DB_LOGS_USER", "admin_logs"),
    password: DB_LOGS_PASSWORD,  // Sin fallback - validado arriba
  },

  // Seguridad
  security: {
    bcryptRounds: parseInt(getOptionalEnv("BCRYPT_ROUNDS", "12"), 10),
    maxLoginAttempts: parseInt(getOptionalEnv("MAX_LOGIN_ATTEMPTS", "5"), 10),
    lockoutDurationMinutes: parseInt(getOptionalEnv("LOCKOUT_DURATION_MINUTES", "30"), 10),
    pseudonimoHmacSecret: PSEUDONIMO_HMAC_SECRET,  // Sin fallback - validado arriba
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(getOptionalEnv("RATE_LIMIT_WINDOW_MS", "900000"), 10), // 15 minutos
    maxRequests: parseInt(getOptionalEnv("RATE_LIMIT_MAX_REQUESTS", "100"), 10),
  },

  // CORS - soporta múltiples orígenes separados por coma
  cors: {
    origin: getOptionalEnv("CORS_ORIGIN", "http://localhost:5173").split(",").map(o => o.trim()),
    credentials: true,
  },

  // Email / SMTP
  email: {
    host: getOptionalEnv("SMTP_HOST", "smtp.gmail.com"),
    port: parseInt(getOptionalEnv("SMTP_PORT", "587"), 10),
    secure: process.env.SMTP_SECURE === "true",
    user: getOptionalEnv("SMTP_USER", ""),
    pass: getOptionalEnv("SMTP_PASS", ""),
    from: getOptionalEnv("SMTP_FROM", "noreply@judicatura.gob.ec"),
    fromName: getOptionalEnv("SMTP_FROM_NAME", "Sistema Juez Seguro"),
  },

  // Frontend URL (para enlaces en correos)
  frontendUrl: getOptionalEnv("FRONTEND_URL", "http://localhost:8080"),

  // PKI - Infraestructura de Clave Pública (Firma Digital)
  pki: {
    basePath: getOptionalEnv("PKI_JUECES_CERTS_PATH", "./certs/jueces"),
    caCertPath: getOptionalEnv("PKI_CA_CERT_PATH", "./certs/ca/ca.crt"),
    pfxPassword: PFX_PASSWORD,  // Sin fallback - validado arriba (CWE-798)
  },
};

export default config;
