// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Causas
// Gestión de causas judiciales con pseudonimización (FDP)
// HU-SJ-001: Registro de nuevas causas con validación de scope
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { causasService } from "../services/causas.service.js";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";
import { verificarPropiedadCausa } from "../middleware/access-control.middleware.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

// Esquema para crear causa con asignación automática (HU-SJ-001)
const crearCausaAutoSchema = z.object({
  materia: z.string().min(1, "Materia es requerida"),
  tipoProceso: z.string().min(1, "Tipo de proceso es requerido"),
  unidadJudicial: z.string().min(1, "Unidad judicial es requerida"),
  descripcion: z.string().optional(),
  // Partes procesales (información pública)
  actorNombre: z.string().optional(),
  actorIdentificacion: z.string().optional(),
  demandadoNombre: z.string().optional(),
  demandadoIdentificacion: z.string().optional(),
});

// Esquema legacy (mantener compatibilidad)
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
      
      // Si es secretario, solo ve causas de su unidad judicial y materia
      if (req.user?.rol === "SECRETARIO") {
        (filtros as any).unidadJudicial = req.user.unidadJudicial;
        (filtros as any).materia = req.user.materia;
      }
      
      // ADMIN_CJ ve todas las causas (sin filtro adicional)

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
// HU-JZ-001: Control de acceso con verificación de propiedad (FIA_ATD.1)
// ============================================================================
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  verificarPropiedadCausa("id"), // ← NUEVO: Middleware de control de acceso Sprint 2
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

      // La verificación de propiedad ya se hizo en el middleware
      // Si llegamos aquí, el acceso está autorizado

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
// HU-JZ-001: Control de acceso con verificación de propiedad (FIA_ATD.1)
// ============================================================================
router.get(
  "/:id/expediente",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  verificarPropiedadCausa("id"), // ← NUEVO: Middleware de control de acceso Sprint 2
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
// Crea una nueva causa (Solo SECRETARIO) - HU-SJ-001
// Incluye: Validación de scope (FIA_ATD), Asignación automática de juez (sorteo)
// ============================================================================
router.post(
  "/",
  authenticate,
  authorize("SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validar datos de entrada
      const validation = crearCausaAutoSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Crear causa con validación de scope y asignación automática de juez
      const resultado = await causasService.crearCausaConValidacion(
        {
          materia: validation.data.materia,
          tipoProceso: validation.data.tipoProceso,
          unidadJudicial: validation.data.unidadJudicial,
          descripcion: validation.data.descripcion,
          actorNombre: validation.data.actorNombre,
          actorIdentificacion: validation.data.actorIdentificacion,
          demandadoNombre: validation.data.demandadoNombre,
          demandadoIdentificacion: validation.data.demandadoIdentificacion,
        },
        req.user!, // Token del secretario para validación de scope
        ip,
        userAgent
      );

      res.status(201).json({
        success: true,
        data: {
          ...resultado.causa,
          juezPseudonimo: resultado.juezAsignado, // Solo pseudónimo, nunca ID real
        },
        message: `Causa ${resultado.causa.numero_proceso} creada correctamente. Juez asignado: ${resultado.juezAsignado}`,
      });
    } catch (error: any) {
      // Manejar errores específicos de validación de scope
      if (error.code === "MATERIA_NO_COINCIDE" || error.code === "UNIDAD_NO_COINCIDE") {
        res.status(403).json({
          success: false,
          error: error.message,
          code: error.code,
        });
        return;
      }
      
      if (error.code === "NO_JUECES_DISPONIBLES") {
        res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
        });
        return;
      }

      if (error instanceof Error && error.message.includes("Ya existe")) {
        res.status(409).json({
          success: false,
          error: error.message,
          code: "DUPLICATE_PROCESO",
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
