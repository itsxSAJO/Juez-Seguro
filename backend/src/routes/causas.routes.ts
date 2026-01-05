// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Causas
// Gestión de causas judiciales con pseudonimización (FDP)
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { causasService } from "../services/causas.service.js";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

const crearCausaSchema = z.object({
  numeroProceso: z.string().min(1, "Número de proceso requerido"),
  materia: z.string().min(1, "Materia es requerida"),
  tipoProceso: z.string().min(1, "Tipo de proceso es requerido"),
  unidadJudicial: z.string().min(1, "Unidad judicial es requerida"),
  juezAsignadoId: z.number().int().positive("ID de juez inválido"),
});

const cambiarEstadoSchema = z.object({
  estadoProcesal: z.enum(["INICIADA", "EN_TRAMITE", "RESUELTA", "ARCHIVADA", "SUSPENDIDA"]),
});

const filtrosSchema = z.object({
  estadoProcesal: z.enum(["INICIADA", "EN_TRAMITE", "RESUELTA", "ARCHIVADA", "SUSPENDIDA"]).optional(),
  materia: z.string().optional(),
  unidadJudicial: z.string().optional(),
  busqueda: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

// ============================================================================
// GET /api/causas
// Obtiene lista de causas (vista interna con IDs reales)
// ============================================================================
router.get(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = filtrosSchema.parse(req.query);
      
      // Si es juez, solo ve sus causas
      if (req.user?.rol === "JUEZ") {
        (filtros as any).juezAsignadoId = req.user.funcionarioId;
      }

      const resultado = await causasService.getCausas(filtros);

      await auditService.log({
        tipoEvento: "CONSULTA_CAUSAS",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "CASOS",
        descripcion: `Consulta de causas`,
        datosAfectados: { filtros, totalResultados: resultado.total },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: resultado.causas,
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
// GET /api/causas/:id
// Obtiene una causa por ID (vista interna)
// ============================================================================
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const causa = await causasService.getCausaById(id);

      if (!causa) {
        res.status(404).json({
          success: false,
          error: "Causa no encontrada",
        });
        return;
      }

      // Verificar acceso si es juez
      if (req.user?.rol === "JUEZ" && causa.juez_asignado_id !== req.user.funcionarioId) {
        res.status(403).json({
          success: false,
          error: "No tiene acceso a esta causa",
        });
        return;
      }

      res.json({
        success: true,
        data: causa,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/causas/:id/expediente
// Obtiene el expediente de una causa
// ============================================================================
router.get(
  "/:id/expediente",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const expediente = await causasService.getExpediente(id);

      if (!expediente) {
        res.status(404).json({
          success: false,
          error: "Expediente no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        data: expediente,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /api/causas
// Crea una nueva causa (Solo SECRETARIO)
// ============================================================================
router.post(
  "/",
  authenticate,
  authorize("SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = crearCausaSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
        return;
      }

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      const causa = await causasService.crearCausa(
        {
          numeroProceso: validation.data.numeroProceso,
          materia: validation.data.materia,
          tipoProceso: validation.data.tipoProceso,
          unidadJudicial: validation.data.unidadJudicial,
        },
        validation.data.juezAsignadoId,
        req.user!.funcionarioId,
        ip,
        userAgent
      );

      res.status(201).json({
        success: true,
        data: causa,
        message: "Causa creada correctamente",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Ya existe")) {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

// ============================================================================
// PATCH /api/causas/:id/estado
// Cambia el estado procesal de una causa
// ============================================================================
router.patch(
  "/:id/estado",
  authenticate,
  authorize("JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const validation = cambiarEstadoSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
        return;
      }

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      const causa = await causasService.cambiarEstadoProcesal(
        id,
        validation.data.estadoProcesal,
        req.user!.funcionarioId,
        ip,
        userAgent
      );

      if (!causa) {
        res.status(404).json({
          success: false,
          error: "Causa no encontrada",
        });
        return;
      }

      res.json({
        success: true,
        data: causa,
        message: `Estado cambiado a ${validation.data.estadoProcesal}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
