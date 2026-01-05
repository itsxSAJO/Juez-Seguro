// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Autenticación
// Endpoints para login, logout y gestión de sesión
// ============================================================================

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service.js";
import { authenticate, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";

const router = Router();

// ============================================================================
// Esquemas de validación
// ============================================================================
const loginSchema = z.object({
  correo: z.string().email("Correo inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, "Contraseña actual requerida"),
  passwordNueva: z.string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener mayúscula")
    .regex(/[a-z]/, "Debe contener minúscula")
    .regex(/[0-9]/, "Debe contener número"),
});

// ============================================================================
// POST /api/auth/login
// ============================================================================
router.post("/login", async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const { correo, password } = validation.data;
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const result = await authService.login(correo, password, ip, userAgent);

    if (!result) {
      res.status(401).json({
        success: false,
        error: "Credenciales inválidas",
      });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CUENTA_BLOQUEADA") {
        res.status(403).json({
          success: false,
          error: "Cuenta bloqueada por múltiples intentos fallidos. Contacte al administrador.",
        });
        return;
      }
      if (error.message === "CUENTA_NO_ACTIVA") {
        res.status(403).json({
          success: false,
          error: "La cuenta no está activa. Contacte al administrador.",
        });
        return;
      }
    }

    console.error("Error en login:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ============================================================================
// POST /api/auth/logout
// ============================================================================
router.post("/logout", authenticate, async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    await authService.logout(req.user!.funcionarioId, ip, userAgent);

    res.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  } catch (error) {
    console.error("Error en logout:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ============================================================================
// GET /api/auth/me
// Obtiene información del usuario actual
// ============================================================================
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        funcionarioId: req.user!.funcionarioId,
        identificacion: req.user!.identificacion,
        correo: req.user!.correo,
        rol: req.user!.rol,
        rolId: req.user!.rolId,
      },
    });
  } catch (error) {
    console.error("Error en /me:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ============================================================================
// POST /api/auth/cambiar-password
// ============================================================================
router.post("/cambiar-password", authenticate, async (req: Request, res: Response) => {
  try {
    const validation = cambiarPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
      return;
    }

    const { passwordActual, passwordNueva } = validation.data;
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const result = await authService.cambiarPassword(
      req.user!.funcionarioId,
      passwordActual,
      passwordNueva,
      ip,
      userAgent
    );

    if (!result) {
      res.status(400).json({
        success: false,
        error: "Contraseña actual incorrecta",
      });
      return;
    }

    res.json({
      success: true,
      message: "Contraseña cambiada correctamente",
    });
  } catch (error) {
    console.error("Error en cambiar-password:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ============================================================================
// POST /api/auth/validar-token
// ============================================================================
router.post("/validar-token", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: "Token requerido",
      });
      return;
    }

    const payload = await authService.validateToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        valid: false,
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      data: {
        funcionarioId: payload.funcionarioId,
        rol: payload.rol,
      },
    });
  } catch (error) {
    console.error("Error en validar-token:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
