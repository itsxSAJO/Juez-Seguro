// ============================================================================
// RUTAS DE NOTIFICACIONES PROCESALES (HU-SJ-004)
// Endpoints para gestión de notificaciones a partes del proceso
// ============================================================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { notificacionesProcesalesService } from "../services/notificaciones-procesales.service.js";
import type { TokenPayload, TipoNotificacionProcesal, TipoDestinatario, MedioNotificacionProcesal, EstadoNotificacionProcesal } from "../types/index.js";

const router = Router();

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

const crearNotificacionSchema = z.object({
  causaId: z.number().int().positive(),
  decisionId: z.number().int().positive(), // OBLIGATORIO: No notificaciones huérfanas
  tipoNotificacion: z.enum([
    "CITACION",
    "TRASLADO",
    "AUTO",
    "PROVIDENCIA",
    "SENTENCIA",
    "REQUERIMIENTO",
    "BOLETA",
    "DEPOSITO_JUDICIAL",
  ]),
  destinatarioTipo: z.enum([
    "actor",
    "demandado",
    "abogado_actor",
    "abogado_demandado",
    "tercero",
    "perito",
    "testigo",
  ]),
  destinatarioNombre: z.string().min(3).max(255),
  destinatarioIdentificacion: z.string().optional(),
  destinatarioCorreo: z.string().email().optional(),
  destinatarioDireccion: z.string().optional(),
  destinatarioCasillero: z.string().optional(),
  asunto: z.string().min(5).max(500),
  contenido: z.string().optional(),
  medioNotificacion: z.enum(["ELECTRONICO", "CASILLERO", "PERSONAL", "BOLETA"]),
  tipoActuacionCodigo: z.string().optional(), // Para crear plazo automático
});

const confirmarEntregaSchema = z.object({
  evidencia: z.string().min(5).max(1000),
});

const registrarFalloSchema = z.object({
  error: z.string().min(5).max(500),
});

// ============================================================================
// ENDPOINTS
// ============================================================================

/**
 * POST /api/notificaciones-procesales
 * Crear nueva notificación procesal
 * Solo JUEZ y SECRETARIO pueden crear
 */
router.post(
  "/",
  authenticate,
  authorize("JUEZ", "SECRETARIO"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";
      
      const validacion = crearNotificacionSchema.safeParse(req.body);
      if (!validacion.success) {
        res.status(400).json({
          success: false,
          message: "Datos de notificación inválidos",
          errors: validacion.error.errors,
        });
        return;
      }

      const notificacion = await notificacionesProcesalesService.crearNotificacion(
        {
          ...validacion.data,
          tipoNotificacion: validacion.data.tipoNotificacion as TipoNotificacionProcesal,
          destinatarioTipo: validacion.data.destinatarioTipo as TipoDestinatario,
          medioNotificacion: validacion.data.medioNotificacion as MedioNotificacionProcesal,
        },
        usuario,
        ipOrigen
      );

      res.status(201).json({
        success: true,
        message: "Notificación creada exitosamente",
        data: notificacion,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al crear notificación",
      });
    }
  }
);

/**
 * GET /api/notificaciones-procesales/causa/:causaId
 * Listar notificaciones de una causa
 */
router.get(
  "/causa/:causaId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const causaId = parseInt(req.params.causaId);
      const { estado, destinatarioTipo } = req.query;

      const notificaciones = await notificacionesProcesalesService.listarNotificacionesPorCausa(
        causaId,
        {
          estado: estado as EstadoNotificacionProcesal | undefined,
          destinatarioTipo: destinatarioTipo as string | undefined,
        }
      );

      res.json({
        success: true,
        data: notificaciones,
        total: notificaciones.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al listar notificaciones",
      });
    }
  }
);

/**
 * GET /api/notificaciones-procesales/decision/:decisionId
 * Listar notificaciones de una decisión
 */
router.get(
  "/decision/:decisionId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId);

      const notificaciones =
        await notificacionesProcesalesService.listarNotificacionesPorDecision(decisionId);

      res.json({
        success: true,
        data: notificaciones,
        total: notificaciones.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al listar notificaciones",
      });
    }
  }
);

/**
 * GET /api/notificaciones-procesales/:id
 * Obtener notificación por ID
 */
router.get(
  "/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const notificacionId = parseInt(req.params.id);

      const notificacion =
        await notificacionesProcesalesService.obtenerNotificacionPorId(notificacionId);

      if (!notificacion) {
        res.status(404).json({
          success: false,
          message: "Notificación no encontrada",
        });
        return;
      }

      res.json({
        success: true,
        data: notificacion,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener notificación",
      });
    }
  }
);

/**
 * POST /api/notificaciones-procesales/:id/enviar
 * Enviar notificación (cambiar estado a ENVIADA)
 */
router.post(
  "/:id/enviar",
  authenticate,
  authorize("JUEZ", "SECRETARIO"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";
      const notificacionId = parseInt(req.params.id);

      const notificacion = await notificacionesProcesalesService.enviarNotificacion(
        notificacionId,
        usuario,
        ipOrigen
      );

      res.json({
        success: true,
        message: "Notificación enviada exitosamente",
        data: notificacion,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al enviar notificación",
      });
    }
  }
);

/**
 * POST /api/notificaciones-procesales/:id/confirmar-entrega
 * Confirmar entrega de notificación
 */
router.post(
  "/:id/confirmar-entrega",
  authenticate,
  authorize("JUEZ", "SECRETARIO"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";
      const notificacionId = parseInt(req.params.id);

      const validacion = confirmarEntregaSchema.safeParse(req.body);
      if (!validacion.success) {
        res.status(400).json({
          success: false,
          message: "Evidencia de entrega requerida",
          errors: validacion.error.errors,
        });
        return;
      }

      const notificacion = await notificacionesProcesalesService.confirmarEntrega(
        notificacionId,
        validacion.data.evidencia,
        usuario,
        ipOrigen
      );

      res.json({
        success: true,
        message: "Entrega confirmada exitosamente",
        data: notificacion,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al confirmar entrega",
      });
    }
  }
);

/**
 * POST /api/notificaciones-procesales/:id/registrar-fallo
 * Registrar fallo en envío
 */
router.post(
  "/:id/registrar-fallo",
  authenticate,
  authorize("JUEZ", "SECRETARIO"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";
      const notificacionId = parseInt(req.params.id);

      const validacion = registrarFalloSchema.safeParse(req.body);
      if (!validacion.success) {
        res.status(400).json({
          success: false,
          message: "Descripción del error requerida",
          errors: validacion.error.errors,
        });
        return;
      }

      const notificacion = await notificacionesProcesalesService.registrarFallo(
        notificacionId,
        validacion.data.error,
        usuario,
        ipOrigen
      );

      res.json({
        success: true,
        message: "Fallo registrado",
        data: notificacion,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al registrar fallo",
      });
    }
  }
);

/**
 * GET /api/notificaciones-procesales/pendientes
 * Listar notificaciones pendientes de envío
 */
router.get(
  "/estado/pendientes",
  authenticate,
  authorize("JUEZ", "SECRETARIO", "ADMIN_CJ"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const notificaciones =
        await notificacionesProcesalesService.listarNotificacionesPendientes();

      res.json({
        success: true,
        data: notificaciones,
        total: notificaciones.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al listar pendientes",
      });
    }
  }
);

/**
 * GET /api/notificaciones-procesales/causa/:causaId/estadisticas
 * Obtener estadísticas de notificaciones por causa
 */
router.get(
  "/causa/:causaId/estadisticas",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const causaId = parseInt(req.params.causaId);

      const estadisticas =
        await notificacionesProcesalesService.obtenerEstadisticasPorCausa(causaId);

      res.json({
        success: true,
        data: estadisticas,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener estadísticas",
      });
    }
  }
);

export default router;
