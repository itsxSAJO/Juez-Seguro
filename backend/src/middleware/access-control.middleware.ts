// ============================================================================
// JUEZ SEGURO BACKEND - Middleware de Control de Acceso a Recursos (Sprint 2)
// HU-JZ-001: Acceso del Juez con Control de Propiedad (FIA_ATD.1)
// ============================================================================
// Common Criteria: FIA_ATD.1 (User attribute definition)
// Implementa validación estricta de propiedad de recursos
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { casesPool } from "../db/connection.js";
import { auditService } from "../services/audit.service.js";
import { loggers } from "../services/logger.service.js";
import { getClientIp, getUserAgent } from "./auth.middleware.js";

const log = loggers.security;

/**
 * Middleware que verifica si un juez tiene acceso a una causa específica
 * Implementa FIA_ATD.1: Control de acceso basado en atributos
 * 
 * USO: Aplicar después de authenticate en rutas de causas/expedientes
 * 
 * @param paramName - Nombre del parámetro de ruta que contiene el causa_id (default: 'id')
 */
export function verificarPropiedadCausa(paramName: string = "id") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Solo aplicar a jueces (secretarios y admins tienen acceso completo)
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Usuario no autenticado",
        });
        return;
      }

      // Si no es JUEZ, permitir acceso (ADMIN_CJ y SECRETARIO tienen acceso total)
      if (req.user.rol !== "JUEZ") {
        next();
        return;
      }

      // Extraer causa_id del parámetro
      const causaId = parseInt(req.params[paramName]);
      if (isNaN(causaId)) {
        res.status(400).json({
          success: false,
          error: "ID de causa inválido",
        });
        return;
      }

      // Consultar en db_casos quién es el juez asignado
      const client = await casesPool.connect();
      try {
        const result = await client.query(
          `SELECT 
            causa_id, 
            numero_proceso, 
            juez_asignado_id, 
            juez_pseudonimo,
            estado_procesal,
            materia,
            unidad_judicial
           FROM causas 
           WHERE causa_id = $1`,
          [causaId]
        );

        // Verificar si la causa existe
        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Causa no encontrada",
          });
          return;
        }

        const causa = result.rows[0];
        const juezAsignadoDB = causa.juez_asignado_id;
        const juezTokenID = req.user.funcionarioId;

        // LÓGICA DE BLOQUEO: Verificar propiedad
        if (juezAsignadoDB !== juezTokenID) {
          // ========================================
          // ACCESO DENEGADO - Registrar en auditoría
          // ========================================
          
          const ip = getClientIp(req);
          const userAgent = getUserAgent(req);

          // Registrar intento de acceso no autorizado (ALTA severidad - Posible IDOR)
          await auditService.log({
            tipoEvento: "ACCESO_DENEGADO",
            usuarioId: juezTokenID,
            usuarioCorreo: req.user.correo,
            moduloAfectado: "CASOS",
            descripcion: `[ALTA] Intento de acceso a causa no asignada. Juez ${juezTokenID} intentó acceder a causa ${causaId} asignada a juez ${juezAsignadoDB}`,

            datosAfectados: {
              causaId,
              numeroProceso: causa.numero_proceso,
              juezAsignadoReal: juezAsignadoDB,
              juezIntentandoAcceder: juezTokenID,
              ruta: req.path,
              metodo: req.method,
              estado: causa.estado_procesal,
              materia: causa.materia,
              unidadJudicial: causa.unidad_judicial,
            },
            ipOrigen: ip,
            userAgent: userAgent,
          });

          // Log adicional en consola para alertas de seguridad
          log.warn(
            `ACCESO_DENEGADO - Posible IDOR: ` +
            `Juez ${juezTokenID} (${req.user.correo}) intentó acceder a causa ${causaId} ` +
            `desde IP ${ip}`
          );

          res.status(403).json({
            success: false,
            error: "No tiene autorización para acceder a esta causa",
            code: "FORBIDDEN_RESOURCE",
          });
          return;
        }

        // ========================================
        // ACCESO PERMITIDO
        // ========================================
        
        // Opcional: Registrar acceso exitoso para auditoría completa
        await auditService.log({
          tipoEvento: "ACCESO_CAUSA",
          usuarioId: juezTokenID,
          usuarioCorreo: req.user.correo,
          moduloAfectado: "CASOS",
          descripcion: `[BAJA] Acceso autorizado a causa ${causaId}`,

          datosAfectados: {
            causaId,
            numeroProceso: causa.numero_proceso,
            ruta: req.path,
            metodo: req.method,
          },
          ipOrigen: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        // Almacenar datos de la causa en req para uso posterior (opcional)
        (req as any).causa = causa;

        next();
      } finally {
        client.release();
      }
    } catch (error) {
      log.error("Error en verificación de propiedad de causa:", error);
      
      // Registrar error en auditoría
      if (req.user) {
        await auditService.log({
          tipoEvento: "ERROR_VERIFICACION_ACCESO",
          usuarioId: req.user.funcionarioId,
          usuarioCorreo: req.user.correo,
          moduloAfectado: "CASOS",
          descripcion: `[MEDIA] Error al verificar propiedad de causa: ${error instanceof Error ? error.message : 'Error desconocido'}`,

          datosAfectados: {
            causaId: req.params[paramName],
            ruta: req.path,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ipOrigen: getClientIp(req),
          userAgent: getUserAgent(req),
        });
      }

      res.status(500).json({
        success: false,
        error: "Error al verificar permisos de acceso",
      });
    }
  };
}

/**
 * Middleware para verificar propiedad en rutas de documentos
 * Valida que el documento pertenezca a una causa asignada al juez
 * 
 * @param documentoParamName - Nombre del parámetro del documento
 */
export function verificarPropiedadDocumento(documentoParamName: string = "documentoId") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || req.user.rol !== "JUEZ") {
        next();
        return;
      }

      const documentoId = req.params[documentoParamName];
      const juezTokenID = req.user.funcionarioId;

      const client = await casesPool.connect();
      try {
        // Obtener la causa asociada al documento
        const result = await client.query(
          `SELECT 
            d.id,
            d.causa_id,
            c.numero_proceso,
            c.juez_asignado_id,
            d.tipo,
            d.nombre
           FROM documentos d
           JOIN causas c ON d.causa_id = c.causa_id
           WHERE d.id = $1`,
          [documentoId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Documento no encontrado",
          });
          return;
        }

        const documento = result.rows[0];

        if (documento.juez_asignado_id !== juezTokenID) {
          // Registrar intento de acceso no autorizado
          await auditService.log({
            tipoEvento: "ACCESO_DENEGADO",
            usuarioId: juezTokenID,
            usuarioCorreo: req.user.correo,
            moduloAfectado: "DOCUMENTOS",
            descripcion: `[ALTA] Intento de acceso a documento no autorizado. Documento ${documentoId} de causa ${documento.causa_id}`,

            datosAfectados: {
              documentoId,
              causaId: documento.causa_id,
              numeroProceso: documento.numero_proceso,
              juezAsignadoReal: documento.juez_asignado_id,
              juezIntentandoAcceder: juezTokenID,
              tipoDocumento: documento.tipo,
            },
            ipOrigen: getClientIp(req),
            userAgent: getUserAgent(req),
          });

          res.status(403).json({
            success: false,
            error: "No tiene autorización para acceder a este documento",
            code: "FORBIDDEN_RESOURCE",
          });
          return;
        }

        // Almacenar datos del documento para uso posterior
        (req as any).documento = documento;

        next();
      } finally {
        client.release();
      }
    } catch (error) {
      log.error("Error en verificación de propiedad de documento:", error);
      res.status(500).json({
        success: false,
        error: "Error al verificar permisos de acceso al documento",
      });
    }
  };
}

/**
 * Middleware para verificar propiedad en rutas de audiencias
 * - JUEZ: Solo puede ver audiencias de causas asignadas a él
 * - SECRETARIO: Solo puede gestionar audiencias de causas que él creó
 */
export function verificarPropiedadAudiencia(audienciaParamName: string = "audienciaId") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Usuario no autenticado",
        });
        return;
      }

      // ADMIN_CJ tiene acceso total
      if (req.user.rol === "ADMIN_CJ") {
        next();
        return;
      }

      const audienciaId = parseInt(req.params[audienciaParamName]);
      const usuarioId = req.user.funcionarioId;

      const client = await casesPool.connect();
      try {
        const result = await client.query(
          `SELECT 
            a.audiencia_id,
            a.causa_id,
            c.numero_proceso,
            c.juez_asignado_id,
            c.secretario_creador_id,
            a.tipo,
            a.fecha_programada
           FROM audiencias a
           JOIN causas c ON a.causa_id = c.causa_id
           WHERE a.audiencia_id = $1`,
          [audienciaId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Audiencia no encontrada",
          });
          return;
        }

        const audiencia = result.rows[0];
        let tieneAcceso = false;

        // JUEZ: Solo acceso si la causa está asignada a él
        if (req.user.rol === "JUEZ") {
          tieneAcceso = audiencia.juez_asignado_id === usuarioId;
        }
        // SECRETARIO: Solo acceso si él creó la causa
        else if (req.user.rol === "SECRETARIO") {
          tieneAcceso = audiencia.secretario_creador_id === usuarioId;
        }

        if (!tieneAcceso) {
          await auditService.log({
            tipoEvento: "ACCESO_DENEGADO",
            usuarioId: usuarioId,
            usuarioCorreo: req.user.correo,
            moduloAfectado: "AUDIENCIAS",
            descripcion: `[ALTA] Intento de acceso a audiencia no autorizada. ${req.user.rol} ${usuarioId} intentó acceder a audiencia ${audienciaId}`,
            datosAfectados: {
              audienciaId,
              causaId: audiencia.causa_id,
              numeroProceso: audiencia.numero_proceso,
              juezAsignadoReal: audiencia.juez_asignado_id,
              secretarioCreador: audiencia.secretario_creador_id,
              usuarioIntentandoAcceder: usuarioId,
              rolUsuario: req.user.rol,
            },
            ipOrigen: getClientIp(req),
            userAgent: getUserAgent(req),
          });

          res.status(403).json({
            success: false,
            error: "No tiene autorización para acceder a esta audiencia",
            code: "FORBIDDEN_RESOURCE",
          });
          return;
        }

        (req as any).audiencia = audiencia;
        next();
      } finally {
        client.release();
      }
    } catch (error) {
      log.error("Error en verificación de propiedad de audiencia:", error);
      res.status(500).json({
        success: false,
        error: "Error al verificar permisos de acceso a la audiencia",
      });
    }
  };
}

/**
 * Middleware para verificar que un secretario puede gestionar audiencias de una causa
 * Solo el secretario que creó la causa puede programar/reprogramar audiencias
 */
export function verificarSecretarioPropietarioCausa(causaParamName: string = "causaId") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Usuario no autenticado",
        });
        return;
      }

      // ADMIN_CJ tiene acceso total
      if (req.user.rol === "ADMIN_CJ") {
        next();
        return;
      }

      // Solo aplica a secretarios
      if (req.user.rol !== "SECRETARIO") {
        next();
        return;
      }

      // Obtener causaId del body o params
      const causaId = req.body.causaId || req.params[causaParamName];
      if (!causaId) {
        res.status(400).json({
          success: false,
          error: "ID de causa requerido",
        });
        return;
      }

      const secretarioId = req.user.funcionarioId;

      const client = await casesPool.connect();
      try {
        const result = await client.query(
          `SELECT causa_id, numero_proceso, secretario_creador_id, juez_asignado_id
           FROM causas WHERE causa_id = $1`,
          [causaId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Causa no encontrada",
          });
          return;
        }

        const causa = result.rows[0];

        if (causa.secretario_creador_id !== secretarioId) {
          await auditService.log({
            tipoEvento: "ACCESO_DENEGADO",
            usuarioId: secretarioId,
            usuarioCorreo: req.user.correo,
            moduloAfectado: "AUDIENCIAS",
            descripcion: `[ALTA] Secretario ${secretarioId} intentó gestionar audiencia de causa que no creó (${causa.numero_proceso})`,
            datosAfectados: {
              causaId,
              numeroProceso: causa.numero_proceso,
              secretarioCreadorReal: causa.secretario_creador_id,
              secretarioIntentandoAcceder: secretarioId,
            },
            ipOrigen: getClientIp(req),
            userAgent: getUserAgent(req),
          });

          res.status(403).json({
            success: false,
            error: "Solo el secretario que creó esta causa puede gestionar sus audiencias",
            code: "FORBIDDEN_RESOURCE",
          });
          return;
        }

        (req as any).causa = causa;
        next();
      } finally {
        client.release();
      }
    } catch (error) {
      log.error("Error en verificación de secretario propietario:", error);
      res.status(500).json({
        success: false,
        error: "Error al verificar permisos de acceso",
      });
    }
  };
}
