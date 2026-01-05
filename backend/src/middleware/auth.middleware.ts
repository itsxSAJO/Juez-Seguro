// ============================================================================
// JUEZ SEGURO BACKEND - Middleware de Autenticación
// Protección de rutas y validación de JWT
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";
import { auditService } from "../services/audit.service.js";
import type { TokenPayload, UserRole } from "../types/index.js";

// Extender Request para incluir usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      token?: string;
    }
  }
}

/**
 * Middleware de autenticación
 * Verifica el token JWT en el header Authorization
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Token de autenticación no proporcionado",
      });
      return;
    }

    const token = authHeader.substring(7); // Remover "Bearer "
    const payload = await authService.validateToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: "Token inválido o expirado",
      });
      return;
    }

    req.user = payload;
    req.token = token;

    next();
  } catch (error) {
    console.error("Error en autenticación:", error);
    res.status(500).json({
      success: false,
      error: "Error interno de autenticación",
    });
  }
}

/**
 * Middleware de autorización por roles
 * Verifica que el usuario tenga uno de los roles permitidos
 */
export function authorize(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Usuario no autenticado",
        });
        return;
      }

      const userRole = req.user.rol;

      if (!allowedRoles.includes(userRole)) {
        const ip = getClientIp(req);
        const userAgent = getUserAgent(req);
        
        await auditService.logAccesoDenegado(
          req.user.funcionarioId,
          `${req.method} ${req.path}`,
          ip,
          userAgent,
          req.user.correo
        );

        res.status(403).json({
          success: false,
          error: "No tiene permisos para acceder a este recurso",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Error en autorización:", error);
      res.status(500).json({
        success: false,
        error: "Error interno de autorización",
      });
    }
  };
}

/**
 * Obtiene la IP del cliente considerando proxies
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Obtiene el User-Agent del cliente
 */
export function getUserAgent(req: Request): string {
  return req.headers["user-agent"] || "unknown";
}
