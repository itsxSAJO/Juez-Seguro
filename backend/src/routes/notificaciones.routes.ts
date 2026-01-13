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

      // Auditoría de consulta
      await auditService.log({
        tipoEvento: "CONSULTA_NOTIFICACIONES",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "NOTIFICACIONES",
        descripcion: `Consulta de notificaciones${filtros.causaId ? ` de causa ${filtros.causaId}` : ''}`,
        datosAfectados: { ...filtros, cantidadResultados: resultado.total },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

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

      // Auditoría de consulta
      await auditService.log({
        tipoEvento: "CONSULTA_NOTIFICACIONES_PENDIENTES",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "NOTIFICACIONES",
        descripcion: "Consulta de notificaciones pendientes",
        datosAfectados: { cantidadResultados: notificaciones.length },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

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

      // Auditoría de consulta
      await auditService.log({
        tipoEvento: "CONSULTA_ESTADISTICAS_NOTIFICACIONES",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "NOTIFICACIONES",
        descripcion: "Consulta de estadísticas de notificaciones",
        datosAfectados: {},
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

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
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

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
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

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
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

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
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

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

// ============================================================================
// NOTIFICACIONES INTERNAS DEL SISTEMA (para jueces y funcionarios)
// ============================================================================

/**
 * GET /api/notificaciones/internas/mis-notificaciones
 * Obtiene las notificaciones internas del usuario autenticado
 */
router.get(
  "/internas/mis-notificaciones",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = {
        destinatarioId: req.user!.funcionarioId,
        estado: (req.query.estado as any) || "todas",
        tipo: req.query.tipo as any,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20,
      };

      const resultado = await notificacionesService.getMisNotificaciones(filtros);

      // Auditoría de consulta
      await auditService.log({
        tipoEvento: "CONSULTA_NOTIFICACIONES_INTERNAS",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "NOTIFICACIONES_INTERNAS",
        descripcion: "Consulta de mis notificaciones internas",
        datosAfectados: { cantidadResultados: resultado.total, noLeidas: resultado.noLeidas },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: resultado.notificaciones,
        total: resultado.total,
        noLeidas: resultado.noLeidas,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/notificaciones/internas/conteo
 * Obtiene el conteo de notificaciones no leídas
 */
router.get(
  "/internas/conteo",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noLeidas = await notificacionesService.getConteoNoLeidas(req.user!.funcionarioId);

      // Auditoría de consulta (mínima, es un conteo frecuente)
      await auditService.log({
        tipoEvento: "CONSULTA_CONTEO_NOTIFICACIONES",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "NOTIFICACIONES_INTERNAS",
        descripcion: "Consulta de conteo de notificaciones no leídas",
        datosAfectados: { noLeidas },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: { noLeidas },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/notificaciones/internas/:id/leer
 * Marca una notificación interna como leída
 */
router.patch(
  "/internas/:id/leer",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID de notificación inválido",
        });
        return;
      }

      const notificacion = await notificacionesService.marcarNotificacionInternaLeida(
        id,
        req.user!.funcionarioId
      );

      if (!notificacion) {
        res.status(404).json({
          success: false,
          error: "Notificación no encontrada o no pertenece al usuario",
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
 * PATCH /api/notificaciones/internas/marcar-todas-leidas
 * Marca todas las notificaciones internas como leídas
 */
router.patch(
  "/internas/marcar-todas-leidas",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cantidad = await notificacionesService.marcarTodasLeidas(req.user!.funcionarioId);

      res.json({
        success: true,
        data: { marcadas: cantidad },
        message: `${cantidad} notificación(es) marcada(s) como leída(s)`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/notificaciones/internas/:id/archivar
 * Archiva una notificación interna
 */
router.patch(
  "/internas/:id/archivar",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID de notificación inválido",
        });
        return;
      }

      const notificacion = await notificacionesService.archivarNotificacionInterna(
        id,
        req.user!.funcionarioId
      );

      if (!notificacion) {
        res.status(404).json({
          success: false,
          error: "Notificación no encontrada o no pertenece al usuario",
        });
        return;
      }

      res.json({
        success: true,
        data: notificacion,
        message: "Notificación archivada",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
