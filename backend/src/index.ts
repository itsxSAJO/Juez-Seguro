// ============================================================================
// JUEZ SEGURO BACKEND - Punto de Entrada Principal
// Sistema Judicial con Seguridad Common Criteria
// ============================================================================

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config/index.js";
import { testConnections, closeConnections } from "./db/connection.js";
import { auditService } from "./services/audit.service.js";

// Importar rutas
import authRoutes from "./routes/auth.routes.js";
import causasRoutes from "./routes/causas.routes.js";
import documentosRoutes from "./routes/documentos.routes.js";
import audienciasRoutes from "./routes/audiencias.routes.js";
import notificacionesRoutes from "./routes/notificaciones.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import auditoriaRoutes from "./routes/auditoria.routes.js";
import publicoRoutes from "./routes/publico.routes.js";

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
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate Limiting - Prevenir ataques de fuerza bruta
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
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
// Middleware de Logging
// ============================================================================

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
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
  console.error(`[ERROR] ${new Date().toISOString()}:`, err);

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
    }).catch(console.error);
  }

  // No exponer detalles de errores en producción
  const message = config.nodeEnv === "production" 
    ? "Error interno del servidor" 
    : err.message;

  res.status(500).json({
    success: false,
    error: message,
    ...(config.nodeEnv !== "production" && { stack: err.stack }),
  });
});

// ============================================================================
// Iniciar Servidor
// ============================================================================

const startServer = async () => {
  try {
    console.log("🚀 Iniciando Juez Seguro Backend...");
    console.log(`📍 Ambiente: ${config.nodeEnv}`);

    // Probar conexiones a bases de datos
    console.log("🔌 Conectando a bases de datos...");
    const dbStatus = await testConnections();
    console.log("✅ Conexiones establecidas:", dbStatus);

    // Iniciar servidor HTTP
    const server = app.listen(config.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    JUEZ SEGURO BACKEND                     ║
║              Sistema Judicial Seguro v1.0.0               ║
╠═══════════════════════════════════════════════════════════╣
║  🌐 Servidor:     http://localhost:${config.port}                   ║
║  📊 Health:       http://localhost:${config.port}/api/health        ║
║  🔐 Auth:         http://localhost:${config.port}/api/auth          ║
║  👥 Usuarios:     http://localhost:${config.port}/api/usuarios      ║
║  📁 Causas:       http://localhost:${config.port}/api/causas        ║
║  📄 Documentos:   http://localhost:${config.port}/api/documentos    ║
║  🗓️  Audiencias:   http://localhost:${config.port}/api/audiencias   ║
║  📬 Notificaciones: http://localhost:${config.port}/api/notificaciones║
║  📋 Auditoría:    http://localhost:${config.port}/api/auditoria     ║
║  🏛️  Portal Público: http://localhost:${config.port}/api/publico    ║
╠═══════════════════════════════════════════════════════════╣
║  Common Criteria: FIA ✓ | FDP ✓ | FAU ✓                   ║
╚═══════════════════════════════════════════════════════════╝
      `);

      // Registrar inicio del sistema en auditoría
      auditService.log({
        tipoEvento: "sistema_iniciado",
        usuarioId: null,
        datosAfectados: {
          version: "1.0.0",
          ambiente: config.nodeEnv,
          puerto: config.port,
        },
        ipOrigen: "localhost",
        userAgent: "system",
      }).catch(console.error);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n📴 Recibida señal ${signal}. Cerrando servidor...`);

      // Registrar apagado en auditoría
      await auditService.log({
        tipoEvento: "sistema_apagado",
        usuarioId: null,
        datosAfectados: { signal },
        ipOrigen: "localhost",
        userAgent: "system",
      }).catch(console.error);

      server.close(async () => {
        console.log("🔌 Cerrando conexiones de base de datos...");
        await closeConnections();
        console.log("👋 Servidor cerrado correctamente.");
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        console.error("⚠️ Forzando cierre...");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    console.error("❌ Error fatal al iniciar servidor:", error);
    process.exit(1);
  }
};

// Ejecutar
startServer();

export default app;
