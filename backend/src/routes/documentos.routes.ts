// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Documentos
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { documentosService } from "../services/documentos.service.js";
import { auditService } from "../services/audit.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";
import { verificarPropiedadCausa, verificarPropiedadDocumento } from "../middleware/access-control.middleware.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================

const subirDocumentoSchema = z.object({
  causaId: z.string().uuid("ID de causa inválido"),
  tipo: z.enum(["demanda", "contestacion", "prueba", "sentencia", "auto", "providencia", "otro"]),
  nombre: z.string().min(1, "Nombre es requerido"),
  mimeType: z.string().optional(),
});

// ============================================================================
// Rutas
// ============================================================================

/**
 * GET /api/documentos/causa/:causaId
 * Obtiene documentos de una causa
 * HU-JZ-001: Control de acceso con verificación de propiedad (FIA_ATD.1)
 */
router.get(
  "/causa/:causaId",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  verificarPropiedadCausa("causaId"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentos = await documentosService.getDocumentosByCausa(req.params.causaId);

      await auditService.logCRUD("documento", "consultar", req.user!.funcionarioId, null, {
        causaId: req.params.causaId,
        totalDocumentos: documentos.length,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.json({
        success: true,
        data: documentos,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/documentos/:id
 * Obtiene un documento por ID
 * HU-JZ-001: Control de acceso con verificación de propiedad (FIA_ATD.1)
 */
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  verificarPropiedadDocumento("id"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documento = await documentosService.getDocumentoById(req.params.id);

      if (!documento) {
        res.status(404).json({
          success: false,
          error: "Documento no encontrado",
        });
        return;
      }

      await auditService.logCRUD("documento", "leer", req.user!.funcionarioId, req.params.id, {
        nombre: documento.nombre,
        tipo: documento.tipo,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.json({
        success: true,
        data: documento,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/documentos
 * Sube un nuevo documento
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = subirDocumentoSchema.parse(req.body);

      // En producción, el contenido vendría de multipart/form-data
      // Aquí simulamos con un buffer vacío
      const contenido = Buffer.from(req.body.contenido || "", "base64");

      const documento = await documentosService.subirDocumento(
        {
          causaId: datos.causaId,
          tipo: datos.tipo,
          nombre: datos.nombre,
          contenido,
          mimeType: datos.mimeType || "application/pdf",
        },
        req.user!.funcionarioId
      );

      await auditService.logCRUD("documento", "crear", req.user!.funcionarioId, documento.id, {
        nombre: documento.nombre,
        tipo: documento.tipo,
        causaId: documento.causaId,
        tamanio: documento.tamanioBytes,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.status(201).json({
        success: true,
        data: documento,
        message: "Documento subido exitosamente",
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
 * DELETE /api/documentos/:id
 * Elimina un documento
 */
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documento = await documentosService.getDocumentoById(req.params.id);

      if (!documento) {
        res.status(404).json({
          success: false,
          error: "Documento no encontrado",
        });
        return;
      }

      const eliminado = await documentosService.eliminarDocumento(req.params.id);

      if (!eliminado) {
        res.status(500).json({
          success: false,
          error: "Error al eliminar documento",
        });
        return;
      }

      await auditService.logCRUD("documento", "eliminar", req.user!.funcionarioId, req.params.id, {
        nombre: documento.nombre,
        tipo: documento.tipo,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.json({
        success: true,
        message: "Documento eliminado exitosamente",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/documentos/:id/verificar
 * Verifica integridad de un documento
 */
router.post(
  "/:id/verificar",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contenido = Buffer.from(req.body.contenido || "", "base64");
      
      const integro = await documentosService.verificarIntegridad(req.params.id, contenido);

      await auditService.logCRUD("documento", "verificar_integridad", req.user!.funcionarioId, req.params.id, {
        resultado: integro ? "íntegro" : "alterado",
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      res.json({
        success: true,
        integro,
        message: integro 
          ? "Documento íntegro - no ha sido modificado" 
          : "⚠️ ALERTA: El documento ha sido alterado",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
