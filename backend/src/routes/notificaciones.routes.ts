// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Notificaciones
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { notificacionesService } from "../services/notificaciones.service.js";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

const crearNotificacionSchema = z.object({
  causaId: z.string().uuid("ID de causa inválido"),
  tipo: z.enum(["citacion", "notificacion", "providencia", "sentencia", "otro"]),
  destinatario: z.string().min(1, "Destinatario es requerido"),
  asunto: z.string().min(1, "Asunto es requerido"),
  mensaje: z.string().min(10, "Mensaje debe tener al menos 10 caracteres"),
  prioridad: z.enum(["alta", "normal", "baja"]).optional(),
});

// ============================================================================
// Rutas
// ============================================================================

/**
 * GET /api/notificaciones
 * Obtiene notificaciones con filtros
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = {
        causaId: req.query.causaId as string | undefined,
        estado: req.query.estado as any,
        tipo: req.query.tipo as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };

      const resultado = await notificacionesService.getNotificaciones(filtros);

      res.json({
        success: true,
        data: resultado.notificaciones,
        total: resultado.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/notificaciones/pendientes
 * Obtiene notificaciones pendientes
 */
router.get(
  "/pendientes",
  authenticate,
  authorize("ADMIN_CJ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificaciones = await notificacionesService.getNotificacionesPendientes();

      res.json({
        success: true,
        data: notificaciones,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/notificaciones/estadisticas
 * Obtiene estadísticas de notificaciones
 */
router.get(
  "/estadisticas",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await notificacionesService.getEstadisticas();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/notificaciones
 * Crea una nueva notificación
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = crearNotificacionSchema.parse(req.body);

      const notificacion = await notificacionesService.crearNotificacion(
        datos,
        req.user!.funcionarioId
      );

      await auditService.logCRUD("notificacion", "crear", req.user!.funcionarioId, notificacion.id, {
        causaId: notificacion.causaId,
        tipo: notificacion.tipo,
        destinatario: notificacion.destinatario,
      }, getClientIp(req), getUserAgent(req));

      res.status(201).json({
        success: true,
        data: notificacion,
        message: "Notificación creada exitosamente",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Datos inválidos",
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * PATCH /api/notificaciones/:id/enviar
 * Marca notificación como enviada
 */
router.patch(
  "/:id/enviar",
  authenticate,
  authorize("ADMIN_CJ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificacion = await notificacionesService.marcarEnviada(req.params.id);

      if (!notificacion) {
        res.status(404).json({
          success: false,
          error: "Notificación no encontrada",
        });
        return;
      }

      await auditService.logCRUD("notificacion", "enviar", req.user!.funcionarioId, req.params.id, {
        fechaEnvio: notificacion.fechaEnvio,
      }, getClientIp(req), getUserAgent(req));

      res.json({
        success: true,
        data: notificacion,
        message: "Notificación marcada como enviada",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/notificaciones/:id/leer
 * Marca notificación como leída
 */
router.patch(
  "/:id/leer",
  authenticate,
  authorize("ADMIN_CJ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificacion = await notificacionesService.marcarLeida(req.params.id);

      if (!notificacion) {
        res.status(404).json({
          success: false,
          error: "Notificación no encontrada",
        });
        return;
      }

      res.json({
        success: true,
        data: notificacion,
        message: "Notificación marcada como leída",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/notificaciones/:id/cancelar
 * Cancela una notificación
 */
router.patch(
  "/:id/cancelar",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { motivo } = z.object({
        motivo: z.string().min(10, "Motivo debe tener al menos 10 caracteres"),
      }).parse(req.body);

      const notificacion = await notificacionesService.cancelar(req.params.id, motivo);

      if (!notificacion) {
        res.status(404).json({
          success: false,
          error: "Notificación no encontrada",
        });
        return;
      }

      await auditService.logCRUD("notificacion", "cancelar", req.user!.funcionarioId, req.params.id, {
        motivo,
      }, getClientIp(req), getUserAgent(req));

      res.json({
        success: true,
        data: notificacion,
        message: "Notificación cancelada",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Datos inválidos",
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * PATCH /api/notificaciones/:id/reenviar
 * Reenvía una notificación
 */
router.patch(
  "/:id/reenviar",
  authenticate,
  authorize("ADMIN_CJ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificacion = await notificacionesService.reenviar(req.params.id);

      if (!notificacion) {
        res.status(404).json({
          success: false,
          error: "Notificación no encontrada",
        });
        return;
      }

      await auditService.logCRUD("notificacion", "reenviar", req.user!.funcionarioId, req.params.id, {
        intentos: notificacion.intentosEnvio,
      }, getClientIp(req), getUserAgent(req));

      res.json({
        success: true,
        data: notificacion,
        message: "Notificación reenviada",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
