// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Auditoría (FAU - Solo ADMIN_CJ)
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";

const router = Router();

// ============================================================================
// GET /api/auditoria
// Obtiene logs de auditoría con filtros (Solo ADMIN_CJ)
// ============================================================================
router.get(
  "/",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = {
        usuarioId: req.query.usuarioId ? parseInt(req.query.usuarioId as string) : undefined,
        tipoEvento: req.query.tipoEvento as any,
        moduloAfectado: req.query.moduloAfectado as any,
        fechaDesde: req.query.fechaDesde ? new Date(req.query.fechaDesde as string) : undefined,
        fechaHasta: req.query.fechaHasta ? new Date(req.query.fechaHasta as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };

      const resultado = await auditService.getLogs(filtros);

      // Registrar la consulta de auditoría
      await auditService.log({
        tipoEvento: "CONSULTA_AUDITORIA",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "AUTH",
        descripcion: "Consulta de logs de auditoría",
        datosAfectados: { filtros, totalResultados: resultado.total },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: resultado.logs,
        total: resultado.total,
        page: filtros.page || 1,
        pageSize: filtros.pageSize || 50,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/auditoria/verificar-integridad
// Verifica la integridad de la cadena de auditoría
// ============================================================================
router.get(
  "/verificar-integridad",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fechaDesde = req.query.fechaDesde ? new Date(req.query.fechaDesde as string) : undefined;
      const fechaHasta = req.query.fechaHasta ? new Date(req.query.fechaHasta as string) : undefined;

      const resultado = await auditService.verificarIntegridad(fechaDesde, fechaHasta);

      res.json({
        success: true,
        data: resultado,
        message: resultado.valido
          ? "✅ La cadena de auditoría está íntegra"
          : `⚠️ ALERTA: Se detectaron ${resultado.errores.length} anomalías`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/auditoria/tipos-evento
// Obtiene lista de tipos de evento disponibles
// ============================================================================
router.get(
  "/tipos-evento",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: [
        "LOGIN_EXITOSO",
        "LOGIN_FALLIDO",
        "LOGOUT",
        "CREACION_CAUSA",
        "CAMBIO_ESTADO",
        "ACCESO_DENEGADO",
        "CONSULTA_AUDITORIA",
        "CREACION_USUARIO",
        "MODIFICACION_USUARIO",
        "BLOQUEO_CUENTA",
        "DESBLOQUEO_CUENTA",
      ],
    });
  }
);

// ============================================================================
// GET /api/auditoria/modulos
// Obtiene lista de módulos disponibles
// ============================================================================
router.get(
  "/modulos",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: [
        "AUTH",
        "CASOS",
        "ADMIN",
        "DOCUMENTOS",
        "AUDIENCIAS",
        "NOTIFICACIONES",
      ],
    });
  }
);

export default router;
