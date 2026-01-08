// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Decisiones Judiciales (Sprint 3)
// HU-JZ-003: Elaboración y firma de autos, providencias y sentencias
// ============================================================================
// Endpoints:
// - GET    /api/decisiones              - Listar decisiones (filtradas por rol)
// - GET    /api/decisiones/:id          - Obtener decisión por ID
// - POST   /api/decisiones              - Crear nueva decisión (Solo JUEZ)
// - PUT    /api/decisiones/:id          - Actualizar borrador (Solo JUEZ autor)
// - POST   /api/decisiones/:id/preparar - Preparar para firma
// - POST   /api/decisiones/:id/firmar   - Firmar decisión (INMUTABLE después)
// - GET    /api/decisiones/:id/verificar - Verificar integridad
// - GET    /api/decisiones/:id/historial - Historial de versiones
// - DELETE /api/decisiones/:id          - Eliminar borrador
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { decisionesService } from "../services/decisiones.service.js";
import { firmaService } from "../services/firma.service.js";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

const crearDecisionSchema = z.object({
  causaId: z.number().int().positive("ID de causa inválido"),
  tipoDecision: z.enum(["AUTO", "PROVIDENCIA", "SENTENCIA"], {
    errorMap: () => ({ message: "Tipo de decisión debe ser AUTO, PROVIDENCIA o SENTENCIA" }),
  }),
  titulo: z.string().min(5, "El título debe tener al menos 5 caracteres").max(500),
  contenidoBorrador: z.string().optional(),
});

const actualizarDecisionSchema = z.object({
  titulo: z.string().min(5).max(500).optional(),
  contenidoBorrador: z.string().optional(),
});

const filtrosSchema = z.object({
  causaId: z.coerce.number().optional(),
  tipoDecision: z.enum(["AUTO", "PROVIDENCIA", "SENTENCIA"]).optional(),
  estado: z.enum(["BORRADOR", "LISTA_PARA_FIRMA", "FIRMADA", "ANULADA"]).optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

// ============================================================================
// Función auxiliar para construir contexto de usuario
// ============================================================================
function buildUserContext(req: Request) {
  return {
    funcionarioId: req.user!.funcionarioId,
    correo: req.user!.correo,
    rol: req.user!.rol,
    unidadJudicial: req.user!.unidadJudicial,
    materia: req.user!.materia,
  };
}

// ============================================================================
// GET /api/decisiones
// Listar decisiones (filtradas según rol del usuario)
// ============================================================================
router.get(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = filtrosSchema.parse(req.query);
      const usuario = buildUserContext(req);

      const resultado = await decisionesService.getDecisiones(filtros, usuario);

      await auditService.log({
        tipoEvento: "CONSULTA_DECISIONES",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `Consulta de decisiones judiciales`,
        datosAfectados: { filtros, total: resultado.total },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: resultado.decisiones,
        total: resultado.total,
        page: filtros.page || 1,
        pageSize: filtros.pageSize || 20,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/decisiones/:id
// Obtener decisión por ID
// ============================================================================
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decisionId = parseInt(req.params.id);
      if (isNaN(decisionId)) {
        res.status(400).json({ success: false, error: "ID inválido" });
        return;
      }

      const usuario = buildUserContext(req);
      const decision = await decisionesService.getDecisionById(decisionId, usuario);

      if (!decision) {
        res.status(404).json({ success: false, error: "Decisión no encontrada" });
        return;
      }

      res.json({ success: true, data: decision });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /api/decisiones
// Crear nueva decisión (Solo JUEZ)
// ============================================================================
router.post(
  "/",
  authenticate,
  authorize("JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearDecisionSchema.parse(req.body);
      const usuario = buildUserContext(req);
      const ipOrigen = getClientIp(req);
      const userAgent = getUserAgent(req);

      const decision = await decisionesService.crearDecision(
        input,
        usuario,
        ipOrigen,
        userAgent
      );

      res.status(201).json({
        success: true,
        message: "Decisión creada exitosamente",
        data: decision,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Datos de entrada inválidos",
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }
);

// ============================================================================
// PUT /api/decisiones/:id
// Actualizar decisión en BORRADOR (Solo JUEZ autor)
// ============================================================================
router.put(
  "/:id",
  authenticate,
  authorize("JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decisionId = parseInt(req.params.id);
      if (isNaN(decisionId)) {
        res.status(400).json({ success: false, error: "ID inválido" });
        return;
      }

      const input = actualizarDecisionSchema.parse(req.body);
      const usuario = buildUserContext(req);
      const ipOrigen = getClientIp(req);
      const userAgent = getUserAgent(req);

      const decision = await decisionesService.actualizarDecision(
        decisionId,
        input,
        usuario,
        ipOrigen,
        userAgent
      );

      res.json({
        success: true,
        message: "Decisión actualizada exitosamente",
        data: decision,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Datos de entrada inválidos",
          details: error.errors,
        });
        return;
      }

      // Manejar errores de negocio
      if (error instanceof Error) {
        if (error.message.includes("No tiene autorización") || 
            error.message.includes("no puede modificar")) {
          res.status(403).json({ success: false, error: error.message });
          return;
        }
        if (error.message.includes("inmutable") || 
            error.message.includes("firmada")) {
          res.status(409).json({ success: false, error: error.message });
          return;
        }
      }
      next(error);
    }
  }
);

// ============================================================================
// POST /api/decisiones/:id/preparar
// Preparar decisión para firma (cambiar a LISTA_PARA_FIRMA)
// ============================================================================
router.post(
  "/:id/preparar",
  authenticate,
  authorize("JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decisionId = parseInt(req.params.id);
      if (isNaN(decisionId)) {
        res.status(400).json({ success: false, error: "ID inválido" });
        return;
      }

      const usuario = buildUserContext(req);
      const ipOrigen = getClientIp(req);
      const userAgent = getUserAgent(req);

      const decision = await decisionesService.prepararParaFirma(
        decisionId,
        usuario,
        ipOrigen,
        userAgent
      );

      res.json({
        success: true,
        message: "Decisión preparada para firma. Puede proceder a firmar.",
        data: decision,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("certificado")) {
          res.status(400).json({ 
            success: false, 
            error: error.message,
            code: "CERTIFICADO_NO_VALIDO",
          });
          return;
        }
      }
      next(error);
    }
  }
);

// ============================================================================
// POST /api/decisiones/:id/firmar
// FIRMAR DECISIÓN ELECTRÓNICAMENTE
// ¡ATENCIÓN! Después de firmar, la decisión es INMUTABLE
// ============================================================================
router.post(
  "/:id/firmar",
  authenticate,
  authorize("JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decisionId = parseInt(req.params.id);
      if (isNaN(decisionId)) {
        res.status(400).json({ success: false, error: "ID inválido" });
        return;
      }

      const usuario = buildUserContext(req);
      const ipOrigen = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Advertencia crítica en log
      console.log(`[DECISIONES] ⚠️ FIRMA SOLICITADA: Decisión ${decisionId} por Juez ${usuario.funcionarioId}`);

      const decision = await decisionesService.firmarDecision(
        decisionId,
        usuario,
        ipOrigen,
        userAgent
      );

      res.json({
        success: true,
        message: "Decisión firmada exitosamente. El documento es ahora INMUTABLE.",
        data: {
          decision: decision,
          mensaje: "Decisión firmada exitosamente. El documento es ahora INMUTABLE.",
          firmaInfo: {
            hash: decision.hashIntegridadPdf || "",
            algoritmo: decision.algoritmoFirma || "",
            certificado: decision.certificadoFirmante || "",
            fechaFirma: decision.fechaFirma || new Date().toISOString(),
            numeroSerie: decision.numeroSerieCertificado || "",
          },
          pdfUrl: decision.rutaPdfFirmado ? `/api/decisiones/${decisionId}/descargar` : undefined,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        // Errores específicos de firma
        if (error.message.includes("certificado")) {
          res.status(400).json({ 
            success: false, 
            error: error.message,
            code: "ERROR_CERTIFICADO",
          });
          return;
        }
        if (error.message.includes("ya está firmada")) {
          res.status(409).json({ 
            success: false, 
            error: error.message,
            code: "YA_FIRMADA",
          });
          return;
        }
        if (error.message.includes("Solo el juez autor")) {
          res.status(403).json({ 
            success: false, 
            error: error.message,
            code: "NO_AUTORIZADO",
          });
          return;
        }
      }
      next(error);
    }
  }
);

// ============================================================================
// GET /api/decisiones/:id/verificar
// Verificar integridad de decisión firmada
// ============================================================================
router.get(
  "/:id/verificar",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decisionId = parseInt(req.params.id);
      if (isNaN(decisionId)) {
        res.status(400).json({ success: false, error: "ID inválido" });
        return;
      }

      const resultado = await decisionesService.verificarIntegridad(decisionId);

      await auditService.log({
        tipoEvento: "VERIFICACION_INTEGRIDAD",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "CASOS",
        descripcion: `Verificación de integridad de decisión ${decisionId}`,
        datosAfectados: resultado.detalles,
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        integro: resultado.integro,
        detalles: resultado.detalles,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/decisiones/:id/historial
// Obtener historial de versiones de una decisión
// ============================================================================
router.get(
  "/:id/historial",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decisionId = parseInt(req.params.id);
      if (isNaN(decisionId)) {
        res.status(400).json({ success: false, error: "ID inválido" });
        return;
      }

      const historial = await decisionesService.getHistorial(decisionId);

      res.json({
        success: true,
        data: historial,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DELETE /api/decisiones/:id
// Eliminar decisión en BORRADOR (Solo JUEZ autor)
// ============================================================================
router.delete(
  "/:id",
  authenticate,
  authorize("JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decisionId = parseInt(req.params.id);
      if (isNaN(decisionId)) {
        res.status(400).json({ success: false, error: "ID inválido" });
        return;
      }

      const usuario = buildUserContext(req);
      const ipOrigen = getClientIp(req);
      const userAgent = getUserAgent(req);

      await decisionesService.eliminarDecision(
        decisionId,
        usuario,
        ipOrigen,
        userAgent
      );

      res.json({
        success: true,
        message: "Decisión eliminada exitosamente",
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("BORRADOR")) {
          res.status(409).json({ success: false, error: error.message });
          return;
        }
        if (error.message.includes("autorización")) {
          res.status(403).json({ success: false, error: error.message });
          return;
        }
      }
      next(error);
    }
  }
);

// ============================================================================
// GET /api/decisiones/certificado/info
// Obtener información del certificado del juez actual
// ============================================================================
router.get(
  "/certificado/info",
  authenticate,
  authorize("JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const juezId = req.user!.funcionarioId;
      const infoCertificado = await firmaService.obtenerInfoCertificado(juezId);

      if (!infoCertificado) {
        res.status(404).json({
          success: false,
          error: "No se encontró certificado digital para este usuario",
          code: "CERTIFICADO_NO_ENCONTRADO",
        });
        return;
      }

      res.json({
        success: true,
        data: infoCertificado,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
