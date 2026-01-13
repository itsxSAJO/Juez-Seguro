// ============================================================================
// RUTAS DE PLAZOS PROCESALES (HU-SJ-004)
// Endpoints para gestión de plazos y alertas
// ============================================================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { plazosService } from "../services/plazos.service.js";
import { alertasService } from "../services/alertas.service.js";
import type { TokenPayload, EstadoPlazo } from "../types/index.js";

const router = Router();

// Importar validadores seguros con límites
import {
  descripcionSchema,
  motivoSchema,
  LIMITES,
} from "../utils/validation.utils.js";

// ============================================================================
// ESQUEMAS DE VALIDACIÓN CON LÍMITES DE SEGURIDAD
// ============================================================================

const crearPlazoSchema = z.object({
  causaId: z.number().int().positive(),
  notificacionId: z.number().int().positive().optional(),
  decisionId: z.number().int().positive().optional(),
  tipoPlazo: z.string().min(3, "Mínimo 3 caracteres").max(100, "Máximo 100 caracteres"),
  descripcion: descripcionSchema,
  parteResponsable: z
    .enum([
      "actor",
      "demandado",
      "abogado_actor",
      "abogado_demandado",
      "tercero",
      "perito",
      "testigo",
      "ambas_partes",
    ])
    .optional(),
  diasPlazo: z.number().int().positive().max(365, "Máximo 365 días"),
  fechaInicio: z.string().datetime().optional(), // ISO 8601
});

const actualizarEstadoSchema = z.object({
  nuevoEstado: z.enum(["VIGENTE", "CUMPLIDO", "VENCIDO", "SUSPENDIDO", "EXTENDIDO"]),
  fechaCumplimiento: z.string().datetime().optional(),
  documentoCumplimientoId: z.string().max(100).optional(),
  motivoSuspension: z.string().max(LIMITES.MOTIVO_MAX, `Máximo ${LIMITES.MOTIVO_MAX} caracteres`).optional(),
});

const calcularVencimientoSchema = z.object({
  fechaInicio: z.string().datetime().optional(),
  diasHabiles: z.number().int().positive().max(365, "Máximo 365 días"),
});

// ============================================================================
// ENDPOINTS DE PLAZOS
// ============================================================================

/**
 * POST /api/plazos
 * Crear nuevo plazo procesal
 */
router.post(
  "/",
  authenticate,
  authorize("JUEZ", "SECRETARIO"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";

      const validacion = crearPlazoSchema.safeParse(req.body);
      if (!validacion.success) {
        res.status(400).json({
          success: false,
          message: "Datos del plazo inválidos",
          errors: validacion.error.errors,
        });
        return;
      }

      const plazo = await plazosService.crearPlazo(
        {
          ...validacion.data,
          fechaInicio: validacion.data.fechaInicio
            ? new Date(validacion.data.fechaInicio)
            : undefined,
        },
        usuario,
        ipOrigen
      );

      res.status(201).json({
        success: true,
        message: "Plazo creado exitosamente",
        data: plazo,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al crear plazo",
      });
    }
  }
);

/**
 * GET /api/plazos/causa/:causaId
 * Listar plazos de una causa
 */
router.get(
  "/causa/:causaId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const causaId = parseInt(req.params.causaId);
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";

      const plazos = await plazosService.listarPlazosPorCausa(
        causaId,
        usuario,
        ipOrigen
      );

      res.json({
        success: true,
        data: plazos,
        total: plazos.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al listar plazos",
      });
    }
  }
);

/**
 * GET /api/plazos/:id
 * Obtener plazo por ID
 */
router.get(
  "/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const plazoId = parseInt(req.params.id);
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";

      const plazo = await plazosService.obtenerPlazoPorId(
        plazoId,
        usuario,
        ipOrigen
      );

      if (!plazo) {
        res.status(404).json({
          success: false,
          message: "Plazo no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        data: plazo,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener plazo",
      });
    }
  }
);

/**
 * PUT /api/plazos/:id/estado
 * Actualizar estado de un plazo
 */
router.put(
  "/:id/estado",
  authenticate,
  authorize("JUEZ", "SECRETARIO"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";
      const plazoId = parseInt(req.params.id);

      const validacion = actualizarEstadoSchema.safeParse(req.body);
      if (!validacion.success) {
        res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: validacion.error.errors,
        });
        return;
      }

      const plazo = await plazosService.actualizarEstadoPlazo(
        plazoId,
        validacion.data.nuevoEstado as EstadoPlazo,
        usuario,
        ipOrigen,
        {
          fechaCumplimiento: validacion.data.fechaCumplimiento
            ? new Date(validacion.data.fechaCumplimiento)
            : undefined,
          documentoCumplimientoId: validacion.data.documentoCumplimientoId,
          motivoSuspension: validacion.data.motivoSuspension,
        }
      );

      if (!plazo) {
        res.status(404).json({
          success: false,
          message: "Plazo no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: "Estado del plazo actualizado",
        data: plazo,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al actualizar estado",
      });
    }
  }
);

/**
 * GET /api/plazos/proximos-vencer
 * Listar plazos próximos a vencer
 */
router.get(
  "/estado/proximos-vencer",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const diasUmbral = parseInt(req.query.dias as string) || 3;

      const plazos = await plazosService.listarPlazosProximosVencer(diasUmbral);

      res.json({
        success: true,
        data: plazos,
        total: plazos.length,
        umbralDias: diasUmbral,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al listar plazos",
      });
    }
  }
);

// ============================================================================
// ENDPOINTS DE CATÁLOGO Y CÁLCULOS
// ============================================================================

/**
 * GET /api/plazos/catalogo
 * Obtener catálogo de tipos de actuación
 */
router.get(
  "/catalogo/tipos-actuacion",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const materia = req.query.materia as string | undefined;

      const catalogo = await plazosService.obtenerCatalogoActuaciones(materia);

      res.json({
        success: true,
        data: catalogo,
        total: catalogo.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener catálogo",
      });
    }
  }
);

/**
 * GET /api/plazos/dias-inhabiles
 * Obtener lista de días inhábiles
 */
router.get(
  "/calendario/dias-inhabiles",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const diasInhabiles = await plazosService.obtenerDiasInhabiles();

      res.json({
        success: true,
        data: diasInhabiles,
        total: diasInhabiles.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener días inhábiles",
      });
    }
  }
);

/**
 * POST /api/plazos/calcular-vencimiento
 * Calcular fecha de vencimiento (utilidad)
 */
router.post(
  "/calcular-vencimiento",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validacion = calcularVencimientoSchema.safeParse(req.body);
      if (!validacion.success) {
        res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: validacion.error.errors,
        });
        return;
      }

      const fechaInicio = validacion.data.fechaInicio
        ? new Date(validacion.data.fechaInicio)
        : new Date(); // Usa hora del servidor si no se proporciona

      const calculo = await plazosService.calcularFechaVencimiento(
        fechaInicio,
        validacion.data.diasHabiles
      );

      res.json({
        success: true,
        data: {
          fechaInicio: calculo.fechaInicio,
          diasHabiles: calculo.diasHabiles,
          fechaVencimiento: calculo.fechaVencimiento,
          diasSaltados: calculo.diasSaltados,
          detalle: calculo.detalleDias.map((d) => ({
            fecha: d.fecha.toISOString().split("T")[0],
            esHabil: d.esHabil,
            motivo: d.motivo,
          })),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al calcular vencimiento",
      });
    }
  }
);

// ============================================================================
// ENDPOINTS DE ALERTAS
// ============================================================================

/**
 * GET /api/plazos/alertas/mis-alertas
 * Obtener alertas del usuario actual
 */
router.get(
  "/alertas/mis-alertas",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const soloNoLeidas = req.query.noLeidas === "true";

      const alertas = await alertasService.obtenerAlertasUsuario(
        usuario.funcionarioId,
        soloNoLeidas
      );

      const noLeidas = await alertasService.contarAlertasNoLeidas(usuario.funcionarioId);

      res.json({
        success: true,
        data: alertas,
        total: alertas.length,
        noLeidas,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener alertas",
      });
    }
  }
);

/**
 * PUT /api/plazos/alertas/:id/leida
 * Marcar alerta como leída
 */
router.put(
  "/alertas/:id/leida",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const alertaId = parseInt(req.params.id);

      const exito = await alertasService.marcarAlertaLeida(
        alertaId,
        usuario.funcionarioId
      );

      if (!exito) {
        res.status(404).json({
          success: false,
          message: "Alerta no encontrada",
        });
        return;
      }

      res.json({
        success: true,
        message: "Alerta marcada como leída",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al marcar alerta",
      });
    }
  }
);

/**
 * POST /api/plazos/alertas/forzar-escaneo
 * Forzar escaneo de plazos (solo ADMIN)
 */
router.post(
  "/alertas/forzar-escaneo",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const usuario = req.user as TokenPayload;
      const ipOrigen = req.ip || req.socket.remoteAddress || "unknown";

      const resultado = await alertasService.forzarEscaneo(usuario, ipOrigen);

      res.json({
        success: true,
        message: "Escaneo completado",
        data: resultado,
      });
    } catch (error) {
      res.status(403).json({
        success: false,
        message: error instanceof Error ? error.message : "Error al forzar escaneo",
      });
    }
  }
);

export default router;
