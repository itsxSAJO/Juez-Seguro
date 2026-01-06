// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Audiencias
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { audienciasService } from "../services/audiencias.service.js";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";
import { verificarPropiedadAudiencia } from "../middleware/access-control.middleware.js";

import type { EstadoAudiencia } from "../types/index.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

const crearAudienciaSchema = z.object({
  causaId: z.string().uuid("ID de causa inválido"),
  tipo: z.enum(["preliminar", "juicio", "conciliacion", "sentencia", "otra"]),
  fechaHora: z.string().datetime(),
  sala: z.string().min(1, "Sala es requerida"),
  duracionMinutos: z.number().min(15).max(480).optional(),
  modalidad: z.enum(["presencial", "virtual"]),
  enlaceVirtual: z.string().url().optional().transform(v => v ?? undefined),
  observaciones: z.string().optional(),
});

const reprogramarSchema = z.object({
  nuevaFecha: z.string().datetime(),
  motivo: z.string().min(10, "Motivo debe tener al menos 10 caracteres"),
});

// ============================================================================
// Rutas
// ============================================================================

/**
 * GET /api/audiencias
 * Obtiene audiencias con filtros
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros: {
        causaId?: string;
        estado?: EstadoAudiencia;
        juezId?: string;
        page?: number;
        pageSize?: number;
      } = {
        causaId: req.query.causaId as string | undefined,
        estado: req.query.estado as EstadoAudiencia | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };

      // Si es juez, solo ve sus audiencias
      if (req.user?.rol === "JUEZ") {
        filtros.juezId = String(req.user.funcionarioId);
      }

      const resultado = await audienciasService.getAudiencias(filtros);

      res.json({
        success: true,
        data: resultado.audiencias,
        total: resultado.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audiencias/hoy
 * Obtiene audiencias del día
 */
router.get(
  "/hoy",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const juezId = req.user?.rol === "JUEZ" ? String(req.user.funcionarioId) : undefined;
      const audiencias = await audienciasService.getAudienciasHoy(juezId);

      res.json({
        success: true,
        data: audiencias,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audiencias/semana
 * Obtiene audiencias de la semana
 */
router.get(
  "/semana",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const juezId = req.user?.rol === "JUEZ" ? String(req.user.funcionarioId) : undefined;
      const audiencias = await audienciasService.getAudienciasSemana(juezId);

      res.json({
        success: true,
        data: audiencias,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/audiencias
 * Crea una nueva audiencia
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = crearAudienciaSchema.parse(req.body);

      const audiencia = await audienciasService.crearAudiencia(
        {
          ...datos,
          fechaHora: new Date(datos.fechaHora),
        },
        req.user!.funcionarioId
      );

      await auditService.logCRUD("audiencia", "crear", req.user!.funcionarioId, audiencia.id, {
        causaId: audiencia.causaId,
        tipo: audiencia.tipo,
        fechaHora: audiencia.fechaHora,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.status(201).json({
        success: true,
        data: audiencia,
        message: "Audiencia programada exitosamente",
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
 * PATCH /api/audiencias/:id/estado
 * Cambia el estado de una audiencia
 * HU-JZ-001: Control de acceso con verificación de propiedad (FIA_ATD.1)
 */
router.patch(
  "/:id/estado",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ"),
  verificarPropiedadAudiencia("id"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { estado } = z.object({
        estado: z.enum(["programada", "en_curso", "finalizada", "suspendida", "cancelada", "reprogramada"]),
      }).parse(req.body);

      const audiencia = await audienciasService.cambiarEstado(req.params.id, estado);

      if (!audiencia) {
        res.status(404).json({
          success: false,
          error: "Audiencia no encontrada",
        });
        return;
      }

      await auditService.logCRUD("audiencia", "cambiar_estado", req.user!.funcionarioId, req.params.id, {
        estadoNuevo: estado,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.json({
        success: true,
        data: audiencia,
        message: `Estado cambiado a "${estado}"`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/audiencias/:id/reprogramar
 * Reprograma una audiencia
 * HU-JZ-001: Control de acceso con verificación de propiedad (FIA_ATD.1)
 */
router.patch(
  "/:id/reprogramar",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ"),
  verificarPropiedadAudiencia("id"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = reprogramarSchema.parse(req.body);

      const audiencia = await audienciasService.reprogramar(
        req.params.id,
        new Date(datos.nuevaFecha),
        datos.motivo
      );

      if (!audiencia) {
        res.status(404).json({
          success: false,
          error: "Audiencia no encontrada",
        });
        return;
      }

      await auditService.logCRUD("audiencia", "reprogramar", req.user!.funcionarioId, req.params.id, {
        nuevaFecha: datos.nuevaFecha,
        motivo: datos.motivo,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.json({
        success: true,
        data: audiencia,
        message: "Audiencia reprogramada exitosamente",
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

export default router;
