// ============================================================================
// JUEZ SEGURO BACKEND - Rutas Públicas (Portal Ciudadano)
// HU-UP-001: Consulta del expediente electrónico de mi proceso
// No requiere autenticación - Vista anonimizada (FDP_IFF)
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { causasService } from "../services/causas.service.js";
import { auditService } from "../services/audit.service.js";
import { documentosService } from "../services/documentos.service.js";
import {
  publicSearchLimiter,
  progressiveDelayMiddleware,
  recordFailedSearch,
  recordSuccessfulSearch,
} from "../middleware/publicRateLimiter.js";
import {
  isValidCausaFormat,
  normalizeCausaNumber,
} from "../middleware/validateCausa.js";

const router = Router();

// ============================================================================
// Aplicar Rate Limiting a todas las rutas públicas
// 15 peticiones por minuto por IP + delay progresivo
// ============================================================================
router.use(publicSearchLimiter);
router.use(progressiveDelayMiddleware);

// ============================================================================
// Helper: Registrar consulta pública en audit log
// ============================================================================
const logPublicAccess = async (
  req: Request,
  tipoEvento: string,
  descripcion: string,
  numeroProceso?: string,
  exito: boolean = true
): Promise<void> => {
  try {
    await auditService.log({
      tipoEvento: exito ? tipoEvento : `${tipoEvento}_FALLIDO`,
      usuarioId: null, // Consulta anónima
      moduloAfectado: "PORTAL_CIUDADANO",
      descripcion,
      datosAfectados: numeroProceso ? { numeroProceso } : undefined,
      ipOrigen: req.ip || req.socket.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });
  } catch (error) {
    console.error("Error registrando acceso público:", error);
  }
};

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
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    try {
      const numeroProceso = req.query.numeroProceso as string;

      if (!numeroProceso) {
        res.status(400).json({
          success: false,
          error: "Número de proceso requerido",
          code: "MISSING_PROCESS_NUMBER",
        });
        return;
      }

      // Validar formato antes de consultar DB
      if (!isValidCausaFormat(numeroProceso)) {
        await logPublicAccess(
          req,
          "CONSULTA_PUBLICA",
          `Formato inválido: ${numeroProceso}`,
          numeroProceso,
          false
        );
        recordFailedSearch(ip);
        
        res.status(400).json({
          success: false,
          error: "Formato de número de proceso inválido. Use: PPCCC-AAAA-NNNNN (ej: 17332-2024-00123)",
          code: "INVALID_FORMAT",
          example: "17332-2024-00123",
        });
        return;
      }

      const normalizedNumber = normalizeCausaNumber(numeroProceso);
      const causa = await causasService.getCausaByNumeroProceso(normalizedNumber);

      if (!causa) {
        await logPublicAccess(
          req,
          "CONSULTA_PUBLICA",
          `Proceso no encontrado: ${normalizedNumber}`,
          normalizedNumber,
          false
        );
        recordFailedSearch(ip);
        
        res.status(404).json({
          success: false,
          error: "Proceso no encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      // Búsqueda exitosa
      recordSuccessfulSearch(ip);
      await logPublicAccess(
        req,
        "CONSULTA_PUBLICA",
        `Consulta exitosa: ${normalizedNumber}`,
        normalizedNumber,
        true
      );

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
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    try {
      const validation = busquedaSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const numeroProceso = validation.data.numeroProceso;

      // Validar formato
      if (!isValidCausaFormat(numeroProceso)) {
        await logPublicAccess(req, "CONSULTA_PUBLICA", `Formato inválido: ${numeroProceso}`, numeroProceso, false);
        recordFailedSearch(ip);
        
        res.status(400).json({
          success: false,
          error: "Formato de número de proceso inválido. Use: PPCCC-AAAA-NNNNN (ej: 17332-2024-00123)",
          code: "INVALID_FORMAT",
        });
        return;
      }

      const normalizedNumber = normalizeCausaNumber(numeroProceso);
      const causa = await causasService.getCausaByNumeroProceso(normalizedNumber);

      if (!causa) {
        await logPublicAccess(req, "CONSULTA_PUBLICA", `Proceso no encontrado: ${normalizedNumber}`, normalizedNumber, false);
        recordFailedSearch(ip);
        
        res.status(404).json({
          success: false,
          error: "Proceso no encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      recordSuccessfulSearch(ip);
      await logPublicAccess(req, "CONSULTA_PUBLICA", `Consulta exitosa: ${normalizedNumber}`, normalizedNumber, true);

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
// GET /api/publico/procesos/:numeroProceso
// Obtiene detalle de un proceso específico
// ============================================================================
router.get(
  "/procesos/:numeroProceso",
  async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    try {
      const { numeroProceso } = req.params;

      // Validar formato
      if (!isValidCausaFormat(numeroProceso)) {
        await logPublicAccess(req, "CONSULTA_DETALLE", `Formato inválido: ${numeroProceso}`, numeroProceso, false);
        recordFailedSearch(ip);
        
        res.status(400).json({
          success: false,
          error: "Formato de número de proceso inválido",
          code: "INVALID_FORMAT",
        });
        return;
      }

      const normalizedNumber = normalizeCausaNumber(numeroProceso);
      const causa = await causasService.getCausaByNumeroProceso(normalizedNumber);

      if (!causa) {
        await logPublicAccess(req, "CONSULTA_DETALLE", `Proceso no encontrado: ${normalizedNumber}`, normalizedNumber, false);
        recordFailedSearch(ip);
        
        res.status(404).json({
          success: false,
          error: "Proceso no encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      recordSuccessfulSearch(ip);
      await logPublicAccess(req, "CONSULTA_DETALLE", `Detalle consultado: ${normalizedNumber}`, normalizedNumber, true);

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
// GET /api/publico/procesos/:numeroProceso/actuaciones
// Obtiene actuaciones públicas de un proceso
// ============================================================================
router.get(
  "/procesos/:numeroProceso/actuaciones",
  async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    try {
      const { numeroProceso } = req.params;

      // Validar formato
      if (!isValidCausaFormat(numeroProceso)) {
        recordFailedSearch(ip);
        res.status(400).json({
          success: false,
          error: "Formato de número de proceso inválido",
          code: "INVALID_FORMAT",
        });
        return;
      }

      const normalizedNumber = normalizeCausaNumber(numeroProceso);
      
      // Verificar que el proceso existe
      const causa = await causasService.getCausaByNumeroProceso(normalizedNumber);
      if (!causa) {
        recordFailedSearch(ip);
        res.status(404).json({
          success: false,
          error: "Proceso no encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      // Obtener actuaciones públicas
      const actuaciones = await causasService.getActuacionesPublicas(causa.causaId);
      
      recordSuccessfulSearch(ip);
      await logPublicAccess(req, "CONSULTA_ACTUACIONES", `Actuaciones consultadas: ${normalizedNumber}`, normalizedNumber, true);

      res.json({
        success: true,
        data: actuaciones,
        total: actuaciones.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/publico/documentos/:documentoId/descargar
// Descarga pública de documento (sin autenticación, con limitaciones)
// Solo documentos de causas públicas, registra en audit log
// ============================================================================
router.get(
  "/documentos/:documentoId/descargar",
  async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    try {
      const { documentoId } = req.params;

      // Validar que el ID del documento es alfanumérico válido (UUID o ID simple)
      // Acepta: doc-001, 16a393d0-bd44-48c9-8582-252fcfb794b5, etc.
      const idRegex = /^[a-zA-Z0-9-]{3,50}$/;
      if (!idRegex.test(documentoId)) {
        res.status(400).json({
          success: false,
          error: "ID de documento inválido",
          code: "INVALID_DOCUMENT_ID",
        });
        return;
      }

      // Obtener el documento
      const documento = await documentosService.getDocumentoById(documentoId);
      
      if (!documento) {
        recordFailedSearch(ip);
        res.status(404).json({
          success: false,
          error: "Documento no encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      // Verificar que el documento no está eliminado
      if (documento.estado === "eliminado") {
        res.status(404).json({
          success: false,
          error: "Documento no disponible",
          code: "NOT_AVAILABLE",
        });
        return;
      }

      // Obtener el contenido del archivo
      const archivo = await documentosService.obtenerContenido(documentoId);

      if (!archivo) {
        res.status(404).json({
          success: false,
          error: "Archivo no disponible para descarga",
          code: "FILE_NOT_FOUND",
        });
        return;
      }

      // Registrar acceso en audit log (consulta anónima)
      await logPublicAccess(
        req, 
        "DESCARGA_DOCUMENTO_PUBLICO", 
        `Documento descargado públicamente: ${documento.nombre} (ID: ${documentoId})`,
        undefined,
        true
      );

      recordSuccessfulSearch(ip);

      // Enviar archivo
      res.setHeader("Content-Type", archivo.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(archivo.nombre)}"`);
      res.setHeader("Content-Length", archivo.contenido.length);
      res.setHeader("X-Content-Type-Options", "nosniff");
      
      res.send(archivo.contenido);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/publico/documentos/:documentoId/ver
// Vista previa pública de documento (inline, no descarga)
// ============================================================================
router.get(
  "/documentos/:documentoId/ver",
  async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    try {
      const { documentoId } = req.params;

      // Validar que el ID del documento es alfanumérico válido (UUID o ID simple)
      const idRegex = /^[a-zA-Z0-9-]{3,50}$/;
      if (!idRegex.test(documentoId)) {
        res.status(400).json({
          success: false,
          error: "ID de documento inválido",
          code: "INVALID_DOCUMENT_ID",
        });
        return;
      }

      const documento = await documentosService.getDocumentoById(documentoId);
      
      if (!documento || documento.estado === "eliminado") {
        recordFailedSearch(ip);
        res.status(404).json({
          success: false,
          error: "Documento no encontrado",
          code: "NOT_FOUND",
        });
        return;
      }

      const archivo = await documentosService.obtenerContenido(documentoId);

      if (!archivo) {
        res.status(404).json({
          success: false,
          error: "Archivo no disponible",
          code: "FILE_NOT_FOUND",
        });
        return;
      }

      await logPublicAccess(
        req, 
        "VISTA_DOCUMENTO_PUBLICO", 
        `Documento visto públicamente: ${documento.nombre}`,
        undefined,
        true
      );

      recordSuccessfulSearch(ip);

      // Enviar archivo para visualización (inline)
      res.setHeader("Content-Type", archivo.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(archivo.nombre)}"`);
      res.setHeader("Content-Length", archivo.contenido.length);
      res.setHeader("X-Content-Type-Options", "nosniff");
      
      res.send(archivo.contenido);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/publico/validar
// Valida formato de número de expediente
// ============================================================================
router.get(
  "/validar",
  async (req: Request, res: Response) => {
    const expediente = req.query.expediente as string;

    if (!expediente) {
      res.status(400).json({
        success: false,
        error: "Número de expediente requerido",
      });
      return;
    }

    const valido = isValidCausaFormat(expediente);
    let existe = false;

    if (valido) {
      const normalizedNumber = normalizeCausaNumber(expediente);
      const causa = await causasService.getCausaByNumeroProceso(normalizedNumber);
      existe = causa !== null;
    }

    res.json({
      success: true,
      data: { valido, existe },
    });
  }
);

// ============================================================================
// GET /api/publico/causas
// Lista causas públicas con filtros (paginado)
// Soporta búsqueda por actor, demandado, proceso o general
// ============================================================================
router.get(
  "/causas",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Obtener tipo de búsqueda (actor, demandado, proceso, o general)
      const tipoBusqueda = req.query.tipoBusqueda as "actor" | "demandado" | "proceso" | "general" | undefined;
      
      const filtros = {
        estadoProcesal: req.query.estadoProcesal as any,
        materia: req.query.materia as string,
        unidadJudicial: req.query.unidadJudicial as string,
        busqueda: req.query.busqueda as string,
        tipoBusqueda: tipoBusqueda,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
      };

      // Limitar pageSize para evitar abuso
      if (filtros.pageSize > 50) {
        filtros.pageSize = 50;
      }

      const resultado = await causasService.getCausasPublicas(filtros);

      await logPublicAccess(
        req,
        "LISTADO_CAUSAS",
        `Listado público consultado - tipo: ${tipoBusqueda || 'general'}, búsqueda: ${filtros.busqueda || 'ninguna'} - página ${filtros.page}`,
        undefined,
        true
      );

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
