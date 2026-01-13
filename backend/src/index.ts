// ============================================================================
// JUEZ SEGURO BACKEND - Punto de Entrada Principal
// Sistema Judicial con Seguridad Common Criteria
// ============================================================================

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { configBase, setSecretsConfig } from "./config/index.js";
import { testConnections, closeConnections } from "./db/connection.js";
import { auditService } from "./services/audit.service.js";
import { secretsManager } from "./services/secrets-manager.service.js";
import { reiniciarTransporter } from "./services/email.service.js";
import { loggers } from "./services/logger.service.js";

const log = loggers.system;

// Importar rutas
import authRoutes from "./routes/auth.routes.js";
import causasRoutes from "./routes/causas.routes.js";
import documentosRoutes from "./routes/documentos.routes.js";
import audienciasRoutes from "./routes/audiencias.routes.js";
import notificacionesRoutes from "./routes/notificaciones.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import auditoriaRoutes from "./routes/auditoria.routes.js";
import publicoRoutes from "./routes/publico.routes.js";
import decisionesRoutes from "./routes/decisiones.routes.js";
import notificacionesProcesalesRoutes from "./routes/notificaciones-procesales.routes.js";
import plazosRoutes from "./routes/plazos.routes.js";

// Importar servicio de alertas para monitoreo
import { alertasService } from "./services/alertas.service.js";

// Importar interceptor de auditoría transversal (Sprint 3)
import { injectAuditInterceptor, auditInterceptor } from "./middleware/audit-interceptor.middleware.js";

// Importar middleware de sanitización contra SQL Injection y XSS
import { sanitizationMiddleware } from "./middleware/sanitization.middleware.js";

// ============================================================================
// Crear aplicación Express
// ============================================================================

const app = express();

// ============================================================================
// Middleware de Seguridad
// ============================================================================

// Helmet - Headers de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS
app.use(cors({
  origin: configBase.cors.origin,
  credentials: configBase.cors.credentials,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate Limiting - Prevenir ataques de fuerza bruta
const generalLimiter = rateLimit({
  windowMs: configBase.rateLimit.windowMs,
  max: configBase.rateLimit.maxRequests,
  message: {
    success: false,
    error: "Demasiadas solicitudes. Por favor, intente más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos de login
  message: {
    success: false,
    error: "Demasiados intentos de inicio de sesión. Por favor, espere 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", generalLimiter);
app.use("/api/auth/login", authLimiter);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// Middleware de Sanitización (Protección SQL Injection y XSS)
// ============================================================================
app.use(sanitizationMiddleware({
  blockSQLInjection: true,  // Bloquea y registra intentos de SQL Injection
  blockXSS: false,          // Sanitiza XSS pero no bloquea (permite HTML en contenido legal)
  logAttacks: true,         // Registra todos los intentos en audit_alertas_seguridad
  excludePaths: ["/api/health"], // Excluir health check
}));

// Inyectar interceptor de auditoría en todas las requests
app.use(injectAuditInterceptor);

// ============================================================================
// Middleware de Logging
// ============================================================================

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    log.debug(`${req.method} ${req.path}`, { status: res.statusCode, durationMs: duration });
  });
  
  next();
});

// ============================================================================
// Rutas de Salud
// ============================================================================

app.get("/api/health", async (req: Request, res: Response) => {
  try {
    const dbStatus = await testConnections();
    
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      databases: dbStatus,
      version: "1.0.0",
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: "Error de conexión a base de datos",
    });
  }
});

// ============================================================================
// Rutas API
// ============================================================================

// Autenticación
app.use("/api/auth", authRoutes);

// Rutas protegidas
app.use("/api/causas", causasRoutes);
app.use("/api/documentos", documentosRoutes);
app.use("/api/audiencias", audienciasRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/decisiones", decisionesRoutes);
app.use("/api/notificaciones-procesales", notificacionesProcesalesRoutes);
app.use("/api/plazos", plazosRoutes);

// Rutas públicas (Portal Ciudadano)
app.use("/api/publico", publicoRoutes);

// ============================================================================
// Manejo de Errores
// ============================================================================

// 404 - Ruta no encontrada
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Recurso no encontrado",
    path: req.path,
  });
});

// Error handler global
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  log.error(`Error en ${req.method} ${req.path}:`, err);

  // Registrar error en auditoría
  const funcionarioId = (req as any).user?.funcionarioId;
  if (funcionarioId) {
    auditService.log({
      tipoEvento: "error_sistema",
      usuarioId: funcionarioId,
      datosAfectados: {
        path: req.path,
        method: req.method,
        error: err.message,
      },
      ipOrigen: req.ip || req.socket.remoteAddress || "unknown",
      userAgent: req.get("user-agent") || "unknown",
    }).catch((e) => log.error("Error registrando auditoría:", e));
  }

  // No exponer detalles de errores en producción
  const message = configBase.nodeEnv === "production" 
    ? "Error interno del servidor" 
    : err.message;

  res.status(500).json({
    success: false,
    error: message,
    ...(configBase.nodeEnv !== "production" && { stack: err.stack }),
  });
});

// ============================================================================
// Iniciar Servidor
// ============================================================================

const startServer = async () => {
  try {
    log.info("🚀 Iniciando Juez Seguro Backend...");
    log.info(`📍 Ambiente: ${configBase.nodeEnv}`);

    // ========================================================================
    // PASO 1: Inicializar SecretsManager (carga secretos desde db_secrets)
    // ========================================================================
    log.info("🔐 Inicializando gestor de secretos...");
    try {
      await secretsManager.initialize(
        configBase.masterKeyPassword,
        configBase.dbSecrets
      );
      
      // Cargar secretos en la configuración
      setSecretsConfig({
        jwtSecret: secretsManager.getRequiredSecret("JWT_SECRET", "Secreto para firmar tokens"),
        pseudonimoHmacSecret: secretsManager.getRequiredSecret("HMAC_SALT", "Salt para pseudónimos"),
        pfxPassword: secretsManager.getRequiredSecret("PFX_PASSWORD", "Password certificados PKI"),
        smtpUser: secretsManager.getSecret("SMTP_USER") ?? undefined,
        smtpPassword: secretsManager.getSecret("SMTP_PASSWORD") ?? undefined,
      });
      
      // Reiniciar transporter de email para usar las credenciales de db_secrets
      reiniciarTransporter();
      
      log.info("✅ Secretos cargados desde db_secrets");
    } catch (secretsError) {
      log.error("❌ Error al cargar secretos:", secretsError);
      throw secretsError;
    }

    // ========================================================================
    // PASO 2: Probar conexiones a bases de datos principales
    // ========================================================================
    log.info("🔌 Conectando a bases de datos...");
    const dbStatus = await testConnections();
    log.info("✅ Conexiones establecidas", dbStatus);

    // Iniciar servidor HTTP
    const server = app.listen(configBase.port, () => {
      log.info(`
╔═══════════════════════════════════════════════════════════╗
║                    JUEZ SEGURO BACKEND                     ║
║              Sistema Judicial Seguro v1.0.0               ║
╠═══════════════════════════════════════════════════════════╣
║  🌐 Servidor:     http://localhost:${configBase.port}                   ║
║  📊 Health:       http://localhost:${configBase.port}/api/health        ║
║  🔐 Auth:         http://localhost:${configBase.port}/api/auth          ║
║  👥 Usuarios:     http://localhost:${configBase.port}/api/usuarios      ║
║  📁 Causas:       http://localhost:${configBase.port}/api/causas        ║
║  📄 Documentos:   http://localhost:${configBase.port}/api/documentos    ║
║  🗓️  Audiencias:   http://localhost:${configBase.port}/api/audiencias   ║
║  📬 Notificaciones: http://localhost:${configBase.port}/api/notificaciones║
║  📋 Auditoría:    http://localhost:${configBase.port}/api/auditoria     ║
║  🏛️  Portal Público: http://localhost:${configBase.port}/api/publico    ║
║  ⚖️  Decisiones:   http://localhost:${configBase.port}/api/decisiones   ║
║  📜 Notif.Proc:   http://localhost:${configBase.port}/api/notificaciones-procesales ║
║  ⏱️  Plazos:       http://localhost:${configBase.port}/api/plazos        ║
╠═══════════════════════════════════════════════════════════╣
║  Common Criteria: FIA ✓ | FDP ✓ | FAU ✓ | FCS ✓           ║
║  Secretos: ${secretsManager.listSecretNames().length} cargados desde db_secrets              ║
╚═══════════════════════════════════════════════════════════╝
      `);

      // Iniciar monitoreo de plazos (cada 60 minutos)
      alertasService.iniciarMonitoreo(60);
      log.info("⏰ Monitoreo de plazos iniciado");

      // Registrar inicio del sistema en auditoría
      auditService.log({
        tipoEvento: "sistema_iniciado",
        usuarioId: null,
        datosAfectados: {
          version: "1.0.0",
          ambiente: configBase.nodeEnv,
          puerto: configBase.port,
          secretosCargados: secretsManager.listSecretNames().length,
        },
        ipOrigen: "localhost",
        userAgent: "system",
      }).catch(err => log.error("Error registrando inicio:", err));

      // Suscribir listener global para eventos de alta criticidad (Sprint 3)
      auditInterceptor.subscribe("*", async (evento: { criticidad: string; tipo: string; modulo: string; usuarioCorreo: string }) => {
        if (evento.criticidad === "ALTA") {
          log.warn(`[AUDIT] ${evento.tipo} | ${evento.modulo} | Usuario: ${evento.usuarioCorreo}`);
        }
      });
      log.info("🔍 Interceptor de auditoría transversal iniciado");
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      log.info(`📴 Recibida señal ${signal}. Cerrando servidor...`);

      // Registrar apagado en auditoría
      await auditService.log({
        tipoEvento: "sistema_apagado",
        usuarioId: null,
        datosAfectados: { signal },
        ipOrigen: "localhost",
        userAgent: "system",
      }).catch(err => log.error("Error registrando apagado:", err));

      server.close(async () => {
        log.info("🔌 Cerrando conexiones de base de datos...");
        await closeConnections();
        await secretsManager.close();
        log.info("👋 Servidor cerrado correctamente.");
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        log.error("⚠️ Forzando cierre...");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    log.error("❌ Error fatal al iniciar servidor:", error);
    process.exit(1);
  }
};

// Ejecutar
startServer();

export default app;
