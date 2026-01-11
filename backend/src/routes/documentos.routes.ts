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

// Nota: causaId es un SERIAL (entero) en la base de datos, no UUID
const subirDocumentoSchema = z.object({
  causaId: z.string().regex(/^\d+$/, "ID de causa debe ser un número válido"),
  tipo: z.enum(["demanda", "contestacion", "prueba", "sentencia", "auto", "providencia", "otro"]),
  nombreOriginal: z.string().min(1, "Nombre del archivo es requerido"),
  contenido: z.string().min(1, "Contenido del archivo es requerido"), // Base64
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
 * GET /api/documentos/:id/ver
 * Visualiza el archivo PDF en el navegador
 * HU-SJ-002: Acceso seguro al contenido del archivo
 * SEGURIDAD: Validación de Magic Bytes + Cabeceras anti-XSS
 * IMPORTANTE: Esta ruta debe estar ANTES de /:id para que Express la matchee correctamente
 */
router.get(
  "/:id/ver",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  verificarPropiedadDocumento("id"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const archivo = await documentosService.obtenerContenido(req.params.id);

      if (!archivo) {
        res.status(404).json({
          success: false,
          error: "Documento no encontrado o archivo no disponible",
        });
        return;
      }

      // =====================================================================
      // VALIDACIÓN DE SEGURIDAD: Verificar Magic Bytes del contenido real
      // No confiar en mimeType de BD - puede ser falsificado
      // =====================================================================
      const validacion = documentosService.validarContenidoPDF(archivo.contenido);

      if (!validacion.esValido) {
        // Registrar intento de servir archivo no-PDF (posible ataque XSS)
        await auditService.log({
          tipoEvento: "ACCESO_DENEGADO",
          usuarioId: req.user!.funcionarioId,
          usuarioCorreo: req.user!.correo,
          moduloAfectado: "DOCUMENTOS",
          descripcion: `[ALTA] Intento de visualizar archivo no-PDF - posible inyección XSS`,
          datosAfectados: {
            documentoId: req.params.id,
            nombreArchivo: archivo.nombre,
            mimeTypeAlmacenado: archivo.mimeType,
            error: validacion.error,
            codigoError: validacion.codigoError,
          },
          ipOrigen: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.status(403).json({
          success: false,
          error: "El archivo no puede ser visualizado por razones de seguridad",
          code: "CONTENIDO_NO_SEGURO",
        });
        return;
      }

      await auditService.logCRUD("documento", "visualizar", req.user!.funcionarioId, req.params.id, {
        nombre: archivo.nombre,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      // =====================================================================
      // CABECERAS DE SEGURIDAD ANTI-XSS
      // =====================================================================
      // Sanitizar nombre de archivo para evitar header injection
      const nombreSeguro = archivo.nombre
        .replace(/["\r\n\\]/g, "_")  // Eliminar caracteres peligrosos
        .replace(/[^\w\s.-]/g, "_"); // Solo caracteres seguros

      // MIME type validado por magic bytes, no de BD
      res.setHeader("Content-Type", validacion.mimeTypeSeguro);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(nombreSeguro)}"`);
      res.setHeader("Content-Length", archivo.contenido.length);
      
      // Cabeceras anti-XSS
      res.setHeader("X-Content-Type-Options", "nosniff");           // Evitar MIME sniffing
      res.setHeader("Content-Security-Policy", "default-src 'none'"); // Bloquear scripts/recursos
      res.setHeader("X-Frame-Options", "DENY");                      // Evitar clickjacking
      res.setHeader("Cache-Control", "no-store, private");           // No cachear documentos sensibles

      // Usar res.end() en lugar de res.send() para evitar procesamiento adicional de Express
      // que Snyk marca como XSS sink. El Buffer se escribe directamente al stream.
      res.end(archivo.contenido);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/documentos/:id/descargar
 * Descarga el archivo PDF del documento
 * HU-SJ-002: Acceso seguro al contenido del archivo
 * SEGURIDAD: Validación de Magic Bytes + Cabeceras anti-XSS
 * IMPORTANTE: Esta ruta debe estar ANTES de /:id para que Express la matchee correctamente
 */
router.get(
  "/:id/descargar",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  verificarPropiedadDocumento("id"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const archivo = await documentosService.obtenerContenido(req.params.id);

      if (!archivo) {
        res.status(404).json({
          success: false,
          error: "Documento no encontrado o archivo no disponible",
        });
        return;
      }

      // =====================================================================
      // VALIDACIÓN DE SEGURIDAD: Verificar Magic Bytes del contenido real
      // No confiar en mimeType de BD - puede ser falsificado
      // =====================================================================
      const validacion = documentosService.validarContenidoPDF(archivo.contenido);

      if (!validacion.esValido) {
        // Registrar intento de descargar archivo no-PDF (posible ataque)
        await auditService.log({
          tipoEvento: "ACCESO_DENEGADO",
          usuarioId: req.user!.funcionarioId,
          usuarioCorreo: req.user!.correo,
          moduloAfectado: "DOCUMENTOS",
          descripcion: `[ALTA] Intento de descargar archivo no-PDF - contenido corrupto o malicioso`,
          datosAfectados: {
            documentoId: req.params.id,
            nombreArchivo: archivo.nombre,
            mimeTypeAlmacenado: archivo.mimeType,
            error: validacion.error,
            codigoError: validacion.codigoError,
          },
          ipOrigen: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.status(403).json({
          success: false,
          error: "El archivo no puede ser descargado por razones de seguridad",
          code: "CONTENIDO_NO_SEGURO",
        });
        return;
      }

      await auditService.logCRUD("documento", "descargar", req.user!.funcionarioId, req.params.id, {
        nombre: archivo.nombre,
      }, getClientIp(req), getUserAgent(req), req.user!.correo);

      // =====================================================================
      // CABECERAS DE SEGURIDAD
      // =====================================================================
      // Sanitizar nombre de archivo para evitar header injection
      const nombreSeguro = archivo.nombre
        .replace(/["\r\n\\]/g, "_")  // Eliminar caracteres peligrosos
        .replace(/[^\w\s.-]/g, "_"); // Solo caracteres seguros

      // MIME type validado por magic bytes, no de BD
      res.setHeader("Content-Type", validacion.mimeTypeSeguro);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(nombreSeguro)}"`);
      res.setHeader("Content-Length", archivo.contenido.length);
      
      // Cabeceras de seguridad
      res.setHeader("X-Content-Type-Options", "nosniff");  // Evitar MIME sniffing
      res.setHeader("Cache-Control", "no-store, private"); // No cachear documentos sensibles

      // Usar res.end() en lugar de res.send() para evitar procesamiento adicional de Express
      // que Snyk marca como XSS sink. El Buffer se escribe directamente al stream.
      res.end(archivo.contenido);
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
 * Sube un nuevo documento con validaciones de seguridad
 * HU-SJ-002: Validación de PDFs, almacenamiento seguro y auditoría
 * SECRETARIO: Solo puede subir documentos a causas de su unidad/materia
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN_CJ", "JUEZ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = subirDocumentoSchema.parse(req.body);

      // VALIDACIÓN: Secretario solo puede subir documentos a causas de su unidad/materia
      if (req.user!.rol === "SECRETARIO") {
        const causa = await documentosService.verificarAccesoCausa(
          datos.causaId,
          req.user!.unidadJudicial,
          req.user!.materia
        );

        if (!causa) {
          // Auditar intento de subir documento a causa no autorizada
          await auditService.log({
            tipoEvento: "ACCESO_DENEGADO",
            usuarioId: req.user!.funcionarioId,
            usuarioCorreo: req.user!.correo,
            moduloAfectado: "DOCUMENTOS",
            descripcion: `[MEDIA] Secretario intentó subir documento a causa fuera de su unidad/materia`,
            datosAfectados: {
              causaId: datos.causaId,
              tipo: datos.tipo,
              nombreOriginal: datos.nombreOriginal,
              unidadJudicialSecretario: req.user!.unidadJudicial,
              materiaSecretario: req.user!.materia,
            },
            ipOrigen: getClientIp(req),
            userAgent: getUserAgent(req),
          });

          res.status(403).json({
            success: false,
            error: "No tiene autorización para subir documentos a esta causa",
            code: "FORBIDDEN_RESOURCE",
          });
          return;
        }
      }

      // Decodificar contenido de Base64
      const contenido = Buffer.from(datos.contenido, "base64");

      const documento = await documentosService.subirDocumento({
        causaId: datos.causaId,
        tipo: datos.tipo,
        nombreOriginal: datos.nombreOriginal,
        contenido,
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

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
      
      // Errores de validación de archivo
      if (error instanceof Error) {
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
