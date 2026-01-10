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
        usuarioCorreo: req.query.usuarioCorreo as string | undefined,
        tipoEvento: req.query.tipoEvento as any,
        moduloAfectado: req.query.moduloAfectado as any,
        causaReferencia: req.query.causaReferencia as string | undefined,
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
// GET /api/auditoria/estadisticas
// Obtiene estadísticas globales de auditoría
// ============================================================================
router.get(
  "/estadisticas",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fechaDesde = req.query.fechaDesde ? new Date(req.query.fechaDesde as string) : undefined;
      const fechaHasta = req.query.fechaHasta ? new Date(req.query.fechaHasta as string) : undefined;
      const usuarioCorreo = req.query.usuarioCorreo as string | undefined;
      const tipoEvento = req.query.tipoEvento as string | undefined;
      const moduloAfectado = req.query.moduloAfectado as string | undefined;

      const estadisticas = await auditService.getEstadisticas({
        fechaDesde,
        fechaHasta,
        usuarioCorreo,
        tipoEvento,
        moduloAfectado,
      });

      res.json({
        success: true,
        data: estadisticas,
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

// ============================================================================
// GET /api/auditoria/exportar
// Exporta logs de auditoría en formato CSV
// ============================================================================
router.get(
  "/exportar",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = {
        usuarioCorreo: req.query.usuarioCorreo as string | undefined,
        tipoEvento: req.query.tipoEvento as any,
        moduloAfectado: req.query.moduloAfectado as any,
        fechaDesde: req.query.fechaDesde ? new Date(req.query.fechaDesde as string) : undefined,
        fechaHasta: req.query.fechaHasta ? new Date(req.query.fechaHasta as string) : undefined,
      };

      const csvContent = await auditService.exportarCSV(filtros);

      // Registrar la exportación
      await auditService.log({
        tipoEvento: "EXPORTACION_AUDITORIA",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "AUTH",
        descripcion: "Exportación de logs de auditoría a CSV",
        datosAfectados: { filtros, formato: "csv" },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      // Configurar headers para descarga
      const fechaArchivo = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="auditoria_${fechaArchivo}.csv"`
      );

      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/auditoria/verificar-cadena
// Verifica la integridad de la cadena de hashes
// ============================================================================
router.get(
  "/verificar-cadena",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fechaDesde = req.query.fechaDesde ? new Date(req.query.fechaDesde as string) : undefined;
      const fechaHasta = req.query.fechaHasta ? new Date(req.query.fechaHasta as string) : undefined;

      const resultado = await auditService.verificarCadenaIntegridad(fechaDesde, fechaHasta);

      // Registrar la verificación
      await auditService.log({
        tipoEvento: "VERIFICACION_INTEGRIDAD",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "AUTH",
        descripcion: `Verificación de integridad: ${resultado.integridadOk ? "OK" : "FALLOS DETECTADOS"}`,
        datosAfectados: resultado,
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: resultado,
        message: resultado.integridadOk
          ? "✅ La cadena de auditoría está íntegra"
          : `⚠️ ALERTA: Se detectaron ${resultado.registrosRotos} anomalías`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/auditoria/usuarios
// Obtiene lista de usuarios que aparecen en los logs
// ============================================================================
router.get(
  "/usuarios",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usuarios = await auditService.getUsuariosEnLogs();
      res.json({
        success: true,
        data: usuarios,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
