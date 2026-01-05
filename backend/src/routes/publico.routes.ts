// ============================================================================
// JUEZ SEGURO BACKEND - Rutas Públicas (Portal Ciudadano)
// No requiere autenticación - Vista anonimizada (FDP_IFF)
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { causasService } from "../services/causas.service.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

const busquedaSchema = z.object({
  numeroProceso: z.string().min(1, "Número de proceso requerido"),
});

// ============================================================================
// GET /api/publico/buscar
// Busca un proceso por número (vista pública anonimizada)
// ============================================================================
router.get(
  "/buscar",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const numeroProceso = req.query.numeroProceso as string;

      if (!numeroProceso) {
        res.status(400).json({
          success: false,
          error: "Número de proceso requerido",
        });
        return;
      }

      const causa = await causasService.getCausaByNumeroProceso(numeroProceso);

      if (!causa) {
        res.status(404).json({
          success: false,
          error: "Proceso no encontrado",
        });
        return;
      }

      // Retornar solo datos públicos (sin IDs reales)
      res.json({
        success: true,
        data: causa, // CausaPublica ya tiene solo pseudónimos
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /api/publico/buscar
// Busca procesos por número (alternativa POST)
// ============================================================================
router.post(
  "/buscar",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = busquedaSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
        return;
      }

      const causa = await causasService.getCausaByNumeroProceso(validation.data.numeroProceso);

      if (!causa) {
        res.status(404).json({
          success: false,
          error: "Proceso no encontrado",
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
// GET /api/publico/causas
// Lista causas públicas con filtros (paginado)
// ============================================================================
router.get(
  "/causas",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = {
        estadoProcesal: req.query.estadoProcesal as any,
        materia: req.query.materia as string,
        unidadJudicial: req.query.unidadJudicial as string,
        busqueda: req.query.busqueda as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
      };

      const resultado = await causasService.getCausasPublicas(filtros);

      res.json({
        success: true,
        data: resultado.causas,
        total: resultado.total,
        page: filtros.page,
        pageSize: filtros.pageSize,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/publico/materias
// Obtiene lista de materias disponibles
// ============================================================================
router.get(
  "/materias",
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: [
        "Civil",
        "Penal",
        "Laboral",
        "Familia",
        "Administrativo",
        "Constitucional",
        "Tributario",
        "Tránsito",
      ],
    });
  }
);

// ============================================================================
// GET /api/publico/unidades-judiciales
// Obtiene lista de unidades judiciales
// ============================================================================
router.get(
  "/unidades-judiciales",
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: [
        "Unidad Judicial Civil de Quito",
        "Unidad Judicial Penal de Quito",
        "Unidad Judicial de Familia de Quito",
        "Unidad Judicial Laboral de Quito",
        "Unidad Judicial Civil de Guayaquil",
        "Unidad Judicial Penal de Guayaquil",
      ],
    });
  }
);

export default router;
