// ============================================================================
// JUEZ SEGURO BACKEND - Rutas de Funcionarios (Solo ADMIN_CJ)
// Gestión de cuentas de usuarios del sistema
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { funcionariosService } from "../services/usuarios.service.js";
import { authService } from "../services/auth.service.js";
import { auditService } from "../services/audit.service.js";
import { otpService } from "../services/otp.service.js";
import { authenticate, authorize, getClientIp, getUserAgent } from "../middleware/auth.middleware.js";

const router = Router();

// Importar validadores seguros con límites
import {
  nombreSchema,
  identificacionSchema,
  emailSchema,
  materiaSchema,
  unidadJudicialSchema,
  LIMITES,
} from "../utils/validation.utils.js";

// ============================================================================
// Esquemas de validación con límites de seguridad
// ============================================================================

const crearFuncionarioSchema = z.object({
  identificacion: identificacionSchema,
  nombresCompletos: nombreSchema,
  correoInstitucional: emailSchema,
  rolId: z.number().int().positive("Rol inválido"),
  unidadJudicial: unidadJudicialSchema,
  materia: materiaSchema,
});

const actualizarFuncionarioSchema = z.object({
  nombresCompletos: nombreSchema.optional(),
  correoInstitucional: emailSchema.optional(),
  rolId: z.number().int().positive().optional(),
  unidadJudicial: z.string().max(150, "Máximo 150 caracteres").optional(),
  materia: z.string().max(100, "Máximo 100 caracteres").optional(),
  estado: z.enum(["HABILITABLE", "ACTIVA", "SUSPENDIDA", "INACTIVA", "BLOQUEADA"]).optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(["HABILITABLE", "ACTIVA", "SUSPENDIDA", "INACTIVA", "BLOQUEADA"]),
});

// ============================================================================
// GET /api/usuarios/verificar-disponibilidad
// Verifica si un correo electrónico está disponible (Solo ADMIN_CJ)
// ============================================================================
router.get(
  "/verificar-disponibilidad",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correoParam = req.query.correo;

      // SEGURIDAD: Validación de tipo en runtime (CWE-1287)
      // req.query.* puede ser string | string[] | undefined
      // El cast 'as string' NO valida en runtime y puede causar crash
      if (typeof correoParam !== 'string') {
        res.status(400).json({
          success: false,
          error: "Parámetro 'correo' debe ser un string válido",
          code: "TIPO_INVALIDO",
        });
        return;
      }

      if (!correoParam.trim()) {
        res.status(400).json({
          success: false,
          error: "Correo requerido",
        });
        return;
      }

      const disponible = await funcionariosService.verificarDisponibilidadCorreo(
        correoParam.toLowerCase()
      );

      res.json({
        success: true,
        data: { disponible },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/usuarios
// Obtiene lista de funcionarios (Solo ADMIN_CJ)
// ============================================================================
router.get(
  "/",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = {
        rolId: req.query.rolId ? parseInt(req.query.rolId as string) : undefined,
        estado: req.query.estado as any,
        unidadJudicial: req.query.unidadJudicial as string,
        materia: req.query.materia as string,
        busqueda: req.query.busqueda as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };

      const resultado = await funcionariosService.getFuncionarios(filtros);

      // Registrar consulta en auditoría
      await auditService.log({
        tipoEvento: "CONSULTA_FUNCIONARIOS",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Consulta de lista de funcionarios`,
        datosAfectados: { 
          filtros,
          resultados: resultado.total 
        },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: resultado.funcionarios,
        total: resultado.total,
        page: filtros.page || 1,
        pageSize: filtros.pageSize || 20,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/usuarios/roles
// Obtiene lista de roles disponibles
// ============================================================================
router.get(
  "/roles",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await funcionariosService.getRoles();

      // Registrar consulta en auditoría
      await auditService.log({
        tipoEvento: "CONSULTA_ROLES",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Consulta de roles disponibles`,
        datosAfectados: { totalRoles: roles.length },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/usuarios/jueces
// Obtiene lista de jueces (para asignación de causas)
// ============================================================================
router.get(
  "/jueces",
  authenticate,
  authorize("ADMIN_CJ", "SECRETARIO"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultado = await funcionariosService.getFuncionarios({
        rolId: 2, // JUEZ
        estado: "ACTIVA",
      });

      // Registrar consulta en auditoría
      await auditService.log({
        tipoEvento: "CONSULTA_JUECES",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Consulta de lista de jueces activos`,
        datosAfectados: { totalJueces: resultado.funcionarios.length },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: resultado.funcionarios,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/usuarios/protegidos/lista
// Obtiene lista de funcionarios con datos OFUSCADOS (Solo ADMIN_CJ)
// Solo muestra ID y rol, para proteger datos sensibles
// ============================================================================
router.get(
  "/protegidos/lista",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = {
        rolId: req.query.rolId ? parseInt(req.query.rolId as string) : undefined,
        estado: req.query.estado as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };

      const resultado = await funcionariosService.getFuncionarios(filtros);

      // Devolver datos ofuscados - solo ID, rol y estado
      // NOTA: resultado.funcionarios ya viene transformado por toPublic() con campos camelCase
      const funcionariosOfuscados = resultado.funcionarios.map((f: any) => ({
        funcionario_id: f.funcionarioId,  // toPublic usa funcionarioId
        rol_nombre: f.rolNombre || "N/A",
        estado_cuenta: f.estado || "N/A",
        unidad_judicial: f.unidadJudicial || "N/A",
        // Datos sensibles OFUSCADOS
        identificacion: "***PROTEGIDO***",
        nombres_completos: "***PROTEGIDO***",
        correo_institucional: "***PROTEGIDO***",
      }));

      // Registrar consulta en auditoría
      await auditService.log({
        tipoEvento: "CONSULTA_FUNCIONARIOS_OFUSCADOS",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Consulta de lista de funcionarios (datos protegidos)`,
        datosAfectados: { 
          filtros,
          resultados: resultado.total 
        },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: funcionariosOfuscados,
        total: resultado.total,
        page: filtros.page || 1,
        pageSize: filtros.pageSize || 20,
        protegido: true,
        mensaje: "Datos sensibles protegidos. Solicite OTP para ver detalles.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /api/usuarios/protegidos/:id/solicitar-otp
// Solicita un OTP para ver datos completos de un funcionario
// ============================================================================
router.post(
  "/protegidos/:id/solicitar-otp",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const funcionarioId = parseInt(req.params.id);
      if (isNaN(funcionarioId)) {
        res.status(400).json({
          success: false,
          error: "ID de funcionario inválido",
        });
        return;
      }

      // Verificar que el funcionario existe
      const existe = await funcionariosService.getFuncionarioById(funcionarioId);
      if (!existe) {
        res.status(404).json({
          success: false,
          error: "Funcionario no encontrado",
        });
        return;
      }

      const resultado = await otpService.solicitarOTP(
        funcionarioId,
        req.user!,
        getClientIp(req)
      );

      res.json({
        success: resultado.success,
        message: resultado.message,
        expiresIn: resultado.expiresIn,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /api/usuarios/protegidos/:id/validar-otp
// Valida OTP y devuelve datos completos del funcionario
// ============================================================================
router.post(
  "/protegidos/:id/validar-otp",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const funcionarioId = parseInt(req.params.id);
      if (isNaN(funcionarioId)) {
        res.status(400).json({
          success: false,
          error: "ID de funcionario inválido",
        });
        return;
      }

      const { otp } = req.body;
      if (!otp || typeof otp !== "string") {
        res.status(400).json({
          success: false,
          error: "OTP requerido",
        });
        return;
      }

      const esValido = await otpService.validarOTP(
        funcionarioId,
        otp,
        req.user!,
        getClientIp(req)
      );

      if (!esValido) {
        res.status(401).json({
          success: false,
          error: "OTP inválido, expirado o ya utilizado",
        });
        return;
      }

      // OTP válido - obtener datos completos
      const funcionario = await funcionariosService.getFuncionarioById(funcionarioId);

      if (!funcionario) {
        res.status(404).json({
          success: false,
          error: "Funcionario no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        data: funcionario,
        mensaje: "Acceso autorizado con OTP. Datos desprotegidos.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/usuarios/:id
// Obtiene un funcionario por ID
// ============================================================================
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const funcionario = await funcionariosService.getFuncionarioById(id);

      if (!funcionario) {
        // Registrar intento de acceso a usuario inexistente
        await auditService.log({
          tipoEvento: "CONSULTA_FUNCIONARIO_NO_ENCONTRADO",
          usuarioId: req.user!.funcionarioId,
          usuarioCorreo: req.user!.correo,
          moduloAfectado: "ADMIN",
          descripcion: `Intento de consulta de funcionario inexistente ID: ${id}`,
          datosAfectados: { funcionarioIdBuscado: id },
          ipOrigen: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.status(404).json({
          success: false,
          error: "Funcionario no encontrado",
        });
        return;
      }

      // Registrar consulta exitosa
      await auditService.log({
        tipoEvento: "CONSULTA_FUNCIONARIO",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Consulta de funcionario: ${funcionario.identificacion}`,
        datosAfectados: { 
          funcionarioIdConsultado: id,
          identificacion: funcionario.identificacion 
        },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: funcionario,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET /api/usuarios/:id/historial
// Obtiene historial de estados de un funcionario
// ============================================================================
router.get(
  "/:id/historial",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const historial = await funcionariosService.getHistorialEstados(id);

      // Registrar consulta de historial en auditoría
      await auditService.log({
        tipoEvento: "CONSULTA_HISTORIAL_ESTADOS",
        usuarioId: req.user!.funcionarioId,
        usuarioCorreo: req.user!.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Consulta de historial de estados del funcionario ID: ${id}`,
        datosAfectados: { 
          funcionarioIdConsultado: id,
          registrosHistorial: historial.length 
        },
        ipOrigen: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({
        success: true,
        data: historial,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /api/usuarios
// Crea un nuevo funcionario (Solo ADMIN_CJ)
// ============================================================================
router.post(
  "/",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = crearFuncionarioSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
        return;
      }

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      const funcionario = await funcionariosService.crearFuncionario(
        validation.data,
        req.user!.funcionarioId,
        ip,
        userAgent
      );

      res.status(201).json({
        success: true,
        data: funcionario,
        message: "Funcionario creado correctamente",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Ya existe")) {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

// ============================================================================
// PUT /api/usuarios/:id
// Actualiza un funcionario
// ============================================================================
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const validation = actualizarFuncionarioSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
        return;
      }

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      const funcionario = await funcionariosService.actualizarFuncionario(
        id,
        validation.data,
        req.user!.funcionarioId,
        ip,
        userAgent
      );

      if (!funcionario) {
        res.status(404).json({
          success: false,
          error: "Funcionario no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        data: funcionario,
        message: "Funcionario actualizado correctamente",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// PATCH /api/usuarios/:id/estado
// Cambia el estado de un funcionario
// ============================================================================
router.patch(
  "/:id/estado",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const validation = cambiarEstadoSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error.errors[0].message,
        });
        return;
      }

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      const result = await funcionariosService.cambiarEstado(
        id,
        validation.data.estado,
        req.user!.funcionarioId,
        ip,
        userAgent
      );

      if (!result) {
        res.status(404).json({
          success: false,
          error: "Funcionario no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: `Estado cambiado a ${validation.data.estado}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// POST /api/usuarios/:id/desbloquear
// Desbloquea una cuenta bloqueada
// ============================================================================
router.post(
  "/:id/desbloquear",
  authenticate,
  authorize("ADMIN_CJ"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "ID inválido",
        });
        return;
      }

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      const result = await authService.desbloquearCuenta(
        id,
        req.user!.funcionarioId,
        ip,
        userAgent
      );

      if (!result) {
        res.status(404).json({
          success: false,
          error: "Funcionario no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: "Cuenta desbloqueada correctamente",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
