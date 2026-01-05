// ============================================================================
// JUEZ SEGURO BACKEND - Configuración
// Variables de entorno y configuración centralizada
// ============================================================================

import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  // Servidor
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "change-this-secret-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "30m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  // Base de Datos - Usuarios (FIA - Identificación y Autenticación)
  dbUsers: {
    host: process.env.DB_USERS_HOST || "localhost",
    port: parseInt(process.env.DB_USERS_PORT || "5432", 10),
    database: process.env.DB_USERS_NAME || "db_usuarios",
    user: process.env.DB_USERS_USER || "admin_users",
    password: process.env.DB_USERS_PASSWORD || "",
  },

  // Base de Datos - Casos (FDP - Protección de Datos)
  dbCases: {
    host: process.env.DB_CASES_HOST || "localhost",
    port: parseInt(process.env.DB_CASES_PORT || "5433", 10),
    database: process.env.DB_CASES_NAME || "db_casos",
    user: process.env.DB_CASES_USER || "admin_cases",
    password: process.env.DB_CASES_PASSWORD || "",
  },

  // Base de Datos - Logs (FAU - Auditoría)
  dbLogs: {
    host: process.env.DB_LOGS_HOST || "localhost",
    port: parseInt(process.env.DB_LOGS_PORT || "5434", 10),
    database: process.env.DB_LOGS_NAME || "db_logs",
    user: process.env.DB_LOGS_USER || "admin_logs",
    password: process.env.DB_LOGS_PASSWORD || "",
  },

  // Seguridad
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5", 10),
    lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || "30", 10),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutos
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },

  // CORS - soporta múltiples orígenes separados por coma
  cors: {
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map(o => o.trim()),
    credentials: true,
  },

  // Email / SMTP
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@judicatura.gob.ec",
    fromName: process.env.SMTP_FROM_NAME || "Sistema Juez Seguro",
  },

  // Frontend URL (para enlaces en correos)
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:8080",
};

// Validar configuración crítica en producción
if (config.isProd) {
  if (config.jwt.secret === "change-this-secret-in-production") {
    throw new Error("JWT_SECRET debe ser configurado en producción");
  }
  if (!config.dbUsers.password || !config.dbCases.password || !config.dbLogs.password) {
    throw new Error("Las contraseñas de base de datos deben ser configuradas en producción");
  }
}

export default config;
