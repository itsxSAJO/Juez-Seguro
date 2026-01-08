// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Audiencias
// HU-SJ-003: Programación y gestión de audiencias
// HU-JZ-002: Consulta de la agenda de audiencias del juez
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { audienciasService } from "../services/audiencias.service.js";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";
import { verificarPropiedadAudiencia, verificarSecretarioPropietarioCausa } from "../middleware/access-control.middleware.js";

import type { EstadoAudiencia } from "../types/index.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

const crearAudienciaSchema = z.object({
  causaId: z.union([
    z.string().regex(/^\d+$/, "ID de causa debe ser numérico"),
    z.number().int().positive()
  ]).transform(val => String(val)),
  tipo: z.enum(["preliminar", "juicio", "conciliacion", "sentencia", "otra", "inicial", "evaluacion", "resolucion"]),
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
 * - JUEZ: Solo ve audiencias de causas asignadas a él
 * - SECRETARIO: Solo ve audiencias de causas que él creó
 * - ADMIN_CJ: Ve todas las audiencias
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
        secretarioCreadorId?: string;
        page?: number;
        pageSize?: number;
      } = {
        causaId: req.query.causaId as string | undefined,
        estado: req.query.estado as EstadoAudiencia | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };

      // Filtrar según rol
      if (req.user?.rol === "JUEZ") {
        // Juez solo ve audiencias de sus causas
        filtros.juezId = String(req.user.funcionarioId);
      } else if (req.user?.rol === "SECRETARIO") {
        // Secretario solo ve audiencias de causas que él creó
        filtros.secretarioCreadorId = String(req.user.funcionarioId);
      }
      // ADMIN_CJ ve todas

      const resultado = await audienciasService.getAudiencias(filtros);

      // Registrar consulta en auditoría
      await auditService.logCRUD(
        "audiencia", 
        "consultar", 
        req.user!.funcionarioId, 
        null, 
        {
          filtros: {
            causaId: filtros.causaId,
            estado: filtros.estado,
          },
          totalResultados: resultado.total,
        },
        getClientIp(req),
        getUserAgent(req),
        req.user!.correo
      );

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
 * Obtiene audiencias del día con indicadores de reprogramación
 * HU-JZ-002: Agenda del juez con trazabilidad
 */
router.get(
  "/hoy",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const juezId = req.user?.rol === "JUEZ" ? String(req.user.funcionarioId) : undefined;
      const audiencias = await audienciasService.getAudienciasHoyConHistorial(juezId);

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
 * Obtiene audiencias de la semana con indicadores de reprogramación
 * HU-JZ-002: Agenda del juez con trazabilidad
 */
router.get(
  "/semana",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const juezId = req.user?.rol === "JUEZ" ? String(req.user.funcionarioId) : undefined;
      const audiencias = await audienciasService.getAudienciasSemanaConHistorial(juezId);

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
 * GET /api/audiencias/agenda
 * Obtiene la agenda completa del juez con historial de cambios
 * HU-JZ-002: Consulta de la agenda de audiencias del juez
 */
router.get(
  "/agenda",
  authenticate,
  authorize("JUEZ", "ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const juezId = req.user?.rol === "JUEZ" 
        ? String(req.user.funcionarioId) 
        : req.query.juezId as string;

      if (!juezId) {
        res.status(400).json({
          success: false,
          error: "Se requiere ID del juez",
        });
        return;
      }

      const fechaDesde = req.query.fechaDesde 
        ? new Date(req.query.fechaDesde as string) 
        : undefined;
      const fechaHasta = req.query.fechaHasta 
        ? new Date(req.query.fechaHasta as string) 
        : undefined;

      const audiencias = await audienciasService.getAgendaJuez(juezId, fechaDesde, fechaHasta);

      res.json({
        success: true,
        data: audiencias,
        total: audiencias.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audiencias/reprogramadas-recientes
 * Obtiene audiencias reprogramadas recientemente para alertar al juez
 * HU-JZ-002: Para que el juez sepa si le movieron la agenda
 */
router.get(
  "/reprogramadas-recientes",
  authenticate,
  authorize("JUEZ", "ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const juezId = req.user?.rol === "JUEZ" 
        ? String(req.user.funcionarioId) 
        : req.query.juezId as string;

      if (!juezId) {
        res.status(400).json({
          success: false,
          error: "Se requiere ID del juez",
        });
        return;
      }

      const diasAtras = req.query.dias ? parseInt(req.query.dias as string) : 7;

      const audiencias = await audienciasService.getAudienciasReprogramadasRecientes(juezId, diasAtras);

      res.json({
        success: true,
        data: audiencias,
        total: audiencias.length,
        mensaje: audiencias.length > 0 
          ? `${audiencias.length} audiencia(s) han sido reprogramadas en los últimos ${diasAtras} días`
          : "No hay audiencias reprogramadas recientemente",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/audiencias
 * Crea una nueva audiencia
 * Solo SECRETARIO puede crear, y solo para causas que él creó
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "SECRETARIO"),
  verificarSecretarioPropietarioCausa("causaId"),
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
 * Reprograma una audiencia con registro de historial
 * HU-SJ-003: Gestión de audiencias con trazabilidad
 * Solo SECRETARIO que creó la causa puede reprogramar
 */
router.patch(
  "/:id/reprogramar",
  authenticate,
  authorize("ADMIN_CJ", "SECRETARIO"),
  verificarPropiedadAudiencia("id"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = reprogramarSchema.parse(req.body);

      // Validar que la nueva fecha sea futura
      const nuevaFecha = new Date(datos.nuevaFecha);
      if (nuevaFecha <= new Date()) {
        res.status(400).json({
          success: false,
          error: "La nueva fecha debe ser futura",
        });
        return;
      }

      const audiencia = await audienciasService.reprogramar(
        req.params.id,
        nuevaFecha,
        datos.motivo,
        req.user!.funcionarioId,
        getClientIp(req)
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
        accion: "HU-SJ-003: Reprogramación con trazabilidad",
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.json({
        success: true,
        data: audiencia,
        message: "Audiencia reprogramada exitosamente. Se ha registrado el cambio en el historial.",
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
      if (error instanceof Error && error.message.includes("fecha")) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/audiencias/:id/historial
 * Obtiene el historial de reprogramaciones de una audiencia
 * HU-JZ-002: Para que el juez sepa si le movieron la agenda
 */
router.get(
  "/:id/historial",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const historial = await audienciasService.getHistorialReprogramaciones(req.params.id);

      res.json({
        success: true,
        data: historial,
        total: historial.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audiencias/:id
 * Obtiene una audiencia por ID con su historial
 */
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audiencia = await audienciasService.getAudienciaById(req.params.id);

      if (!audiencia) {
        res.status(404).json({
          success: false,
          error: "Audiencia no encontrada",
        });
        return;
      }

      res.json({
        success: true,
        data: audiencia,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
