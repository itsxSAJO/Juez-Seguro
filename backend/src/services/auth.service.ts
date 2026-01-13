// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Autenticación (FIA)
// Identificación y autenticación según Common Criteria
// Tablas: funcionarios, roles, historial_estados
// ============================================================================

import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { usersPool, casesPool } from "../db/connection.js";
import { config } from "../config/index.js";
import { auditService } from "./audit.service.js";
import type { Funcionario, FuncionarioPublico, TokenPayload, UserRole, EstadoCuenta } from "../types/index.js";

/**
 * Servicio de Autenticación - FIA (Functional Identification and Authentication)
 * Implementa FIA_UID (Identificación), FIA_ATD (Atributos), FIA_AFL (Bloqueo)
 */
class AuthService {
  /**
   * Valida credenciales y genera tokens
   */
  async login(
    correo: string,
    password: string,
    ip: string,
    userAgent: string
  ): Promise<{ user: FuncionarioPublico; token: string; expiresAt: string; requiereCambioPassword?: boolean } | null> {
    const client = await usersPool.connect();

    try {
      // Buscar funcionario con su rol
      const result = await client.query(
        `SELECT f.*, r.nombre as rol_nombre 
         FROM funcionarios f 
         JOIN roles r ON f.rol_id = r.rol_id 
         WHERE f.correo_institucional = $1`,
        [correo.toLowerCase()]
      );

      const funcionario = result.rows[0] as (Funcionario & { rol_nombre: UserRole }) | undefined;

      // Usuario no encontrado
      if (!funcionario) {
        await auditService.logLogin(correo, ip, userAgent, false);
        return null;
      }

      // Verificar si la cuenta está bloqueada (FIA_AFL)
      if (funcionario.estado === "BLOQUEADA") {
        // Verificar si el tiempo de bloqueo ha expirado
        if (funcionario.fecha_bloqueo) {
          const tiempoBloqueoMs = config.security.lockoutDurationMinutes * 60 * 1000;
          const fechaDesbloqueo = new Date(funcionario.fecha_bloqueo.getTime() + tiempoBloqueoMs);
          
          if (new Date() >= fechaDesbloqueo) {
            // Desbloquear automáticamente
            await client.query(
              `UPDATE funcionarios 
               SET estado = 'ACTIVA', intentos_fallidos = 0, fecha_bloqueo = NULL, fecha_actualizacion = NOW()
               WHERE funcionario_id = $1`,
              [funcionario.funcionario_id]
            );
            funcionario.estado = "ACTIVA" as EstadoCuenta;
            funcionario.intentos_fallidos = 0;
            funcionario.fecha_bloqueo = null;
            
            // Registrar desbloqueo automático
            await this.registrarCambioEstado(
              client,
              funcionario.funcionario_id,
              "BLOQUEADA",
              "ACTIVA",
              null // Sistema automático
            );
          } else {
            // Aún bloqueado
            const minutosRestantes = Math.ceil((fechaDesbloqueo.getTime() - Date.now()) / 60000);
            await auditService.logLogin(correo, ip, userAgent, false, funcionario.funcionario_id);
            throw new Error(`CUENTA_BLOQUEADA:${minutosRestantes}`);
          }
        } else {
          await auditService.logLogin(correo, ip, userAgent, false, funcionario.funcionario_id);
          throw new Error("CUENTA_BLOQUEADA");
        }
      }

      // Verificar si la cuenta está activa o HABILITABLE (primer login)
      const esHabilitable = funcionario.estado === "HABILITABLE";
      if (funcionario.estado !== "ACTIVA" && !esHabilitable) {
        await auditService.logLogin(correo, ip, userAgent, false, funcionario.funcionario_id);
        throw new Error("CUENTA_NO_ACTIVA");
      }

      // Verificar contraseña
      const passwordValid = await bcrypt.compare(password, funcionario.password_hash);

      if (!passwordValid) {
        // Incrementar intentos fallidos (FIA_AFL)
        const nuevosIntentos = funcionario.intentos_fallidos + 1;
        let nuevoEstado: EstadoCuenta = funcionario.estado;
        let fechaBloqueo: Date | null = null;

        // Bloquear si excede intentos máximos
        if (nuevosIntentos >= config.security.maxLoginAttempts) {
          nuevoEstado = "BLOQUEADA" as EstadoCuenta;
          fechaBloqueo = new Date();
          
          // Registrar cambio de estado en historial
          await this.registrarCambioEstado(
            client,
            funcionario.funcionario_id,
            funcionario.estado,
            "BLOQUEADA",
            null // Sistema automático
          );
        }

        await client.query(
          `UPDATE funcionarios 
           SET intentos_fallidos = $1, estado = $2, fecha_bloqueo = $3, fecha_actualizacion = NOW()
           WHERE funcionario_id = $4`,
          [nuevosIntentos, nuevoEstado, fechaBloqueo, funcionario.funcionario_id]
        );

        await auditService.logLogin(correo, ip, userAgent, false, funcionario.funcionario_id);
        return null;
      }

      // Login exitoso - resetear intentos
      await client.query(
        `UPDATE funcionarios 
         SET intentos_fallidos = 0, fecha_bloqueo = NULL, fecha_actualizacion = NOW()
         WHERE funcionario_id = $1`,
        [funcionario.funcionario_id]
      );

      // Generar token JWT (FIA_USB - Atributos de sesión)
      const payload: TokenPayload = {
        funcionarioId: funcionario.funcionario_id,
        identificacion: funcionario.identificacion,
        correo: funcionario.correo_institucional,
        rol: funcionario.rol_nombre,
        rolId: funcionario.rol_id,
        unidadJudicial: funcionario.unidad_judicial,
        materia: funcionario.materia,
        requiereCambioPassword: esHabilitable, // Flag para primer login
      };

      // Determinar tiempo de expiración según rol:
      // - ADMIN_CJ: 5 minutos (mayor riesgo, acceso completo)
      // - JUEZ/SECRETARIO: 15 minutos (operaciones normales)
      // - Cambio de password: 5 minutos (temporal)
      let expiresInSeconds: number;
      if (esHabilitable) {
        expiresInSeconds = 300; // 5 minutos para cambio de password
      } else if (funcionario.rol_nombre === "ADMIN_CJ") {
        expiresInSeconds = 300; // 5 minutos para admin
      } else {
        expiresInSeconds = 900; // 15 minutos para juez y secretario
      }

      const signOptions: SignOptions = {
        expiresIn: expiresInSeconds,
      };

      const token = jwt.sign(payload, config.jwt.secret as Secret, signOptions);
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

      await auditService.logLogin(correo, ip, userAgent, true, funcionario.funcionario_id);

      // Obtener pseudónimo según rol para proteger identidad
      let pseudonimo: string | null = null;
      if (funcionario.rol_nombre === "JUEZ") {
        // Para jueces, buscar en mapa_pseudonimos
        const casesClient = await casesPool.connect();
        try {
          const pseudoResult = await casesClient.query(
            "SELECT pseudonimo_publico FROM mapa_pseudonimos WHERE juez_id_real = $1",
            [funcionario.funcionario_id]
          );
          pseudonimo = pseudoResult.rows[0]?.pseudonimo_publico || `JUEZ-${funcionario.funcionario_id.toString().padStart(4, '0')}`;
        } finally {
          casesClient.release();
        }
      } else if (funcionario.rol_nombre === "SECRETARIO") {
        // Para secretarios, generar pseudónimo basado en ID
        pseudonimo = `SECRETARIO-${funcionario.funcionario_id.toString().padStart(4, '0')}`;
      } else {
        // Para ADMIN_CJ, usar identificador genérico
        pseudonimo = `ADMIN-${funcionario.funcionario_id.toString().padStart(4, '0')}`;
      }

      return {
        user: this.toPublicFuncionario(funcionario, pseudonimo),
        token,
        expiresAt,
        requiereCambioPassword: esHabilitable,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Registra cambio de estado en historial
   */
  private async registrarCambioEstado(
    client: any,
    funcionarioId: number,
    estadoAnterior: string,
    estadoNuevo: string,
    modificadorId: number | null
  ): Promise<void> {
    await client.query(
      `INSERT INTO historial_estados (funcionario_id, estado_anterior, estado_nuevo, modificado_por_id)
       VALUES ($1, $2, $3, $4)`,
      [funcionarioId, estadoAnterior, estadoNuevo, modificadorId]
    );
  }

  /**
   * Cierra la sesión actual
   */
  async logout(funcionarioId: number, ip: string, userAgent: string): Promise<void> {
    await auditService.logLogout(funcionarioId, ip, userAgent);
  }

  /**
   * Valida un token JWT
   * Permite tokens de usuarios ACTIVA o HABILITABLE (para cambio de contraseña)
   */
  async validateToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret as Secret) as TokenPayload;
      
      // Verificar que el funcionario sigue activo o es HABILITABLE
      const client = await usersPool.connect();
      try {
        const result = await client.query(
          "SELECT estado FROM funcionarios WHERE funcionario_id = $1",
          [decoded.funcionarioId]
        );
        
        const estado = result.rows[0]?.estado;
        if (result.rows.length === 0 || (estado !== "ACTIVA" && estado !== "HABILITABLE")) {
          return null;
        }
        
        return decoded;
      } finally {
        client.release();
      }
    } catch {
      return null;
    }
  }

  /**
   * Cambiar contraseña
   * Si el usuario está en estado HABILITABLE, se activa la cuenta automáticamente
   */
  async cambiarPassword(
    funcionarioId: number,
    passwordActual: string,
    passwordNueva: string,
    ip: string,
    userAgent: string
  ): Promise<{ success: boolean; cuentaActivada?: boolean }> {
    const client = await usersPool.connect();

    try {
      const result = await client.query(
        `SELECT f.password_hash, f.estado, f.correo_institucional, r.nombre as rol_nombre
         FROM funcionarios f
         JOIN roles r ON f.rol_id = r.rol_id
         WHERE f.funcionario_id = $1`,
        [funcionarioId]
      );

      if (result.rows.length === 0) {
        return { success: false };
      }

      const { password_hash, estado, correo_institucional, rol_nombre } = result.rows[0];
      const esHabilitable = estado === "HABILITABLE";

      const passwordValid = await bcrypt.compare(passwordActual, password_hash);
      if (!passwordValid) {
        await auditService.log({
          tipoEvento: "CAMBIO_PASSWORD_FALLIDO",
          usuarioId: funcionarioId,
          usuarioCorreo: correo_institucional,
          rolUsuario: rol_nombre,
          moduloAfectado: "AUTH",
          descripcion: "Intento de cambio de contraseña con password actual incorrecto",
          ipOrigen: ip,
          userAgent,
        });
        return { success: false };
      }

      const nuevoHash = await bcrypt.hash(passwordNueva, 12);
      
      // Si es HABILITABLE, activar la cuenta al cambiar contraseña
      if (esHabilitable) {
        await client.query(
          `UPDATE funcionarios 
           SET password_hash = $1, estado = 'ACTIVA', fecha_actualizacion = NOW()
           WHERE funcionario_id = $2`,
          [nuevoHash, funcionarioId]
        );

        // Registrar cambio de estado en historial
        await this.registrarCambioEstado(
          client,
          funcionarioId,
          "HABILITABLE",
          "ACTIVA",
          funcionarioId // El propio usuario activa su cuenta
        );

        await auditService.log({
          tipoEvento: "ACTIVACION_CUENTA_PRIMER_LOGIN",
          usuarioId: funcionarioId,
          usuarioCorreo: correo_institucional,
          rolUsuario: rol_nombre,
          moduloAfectado: "AUTH",
          descripcion: "Cuenta activada tras cambio de contraseña en primer login",
          datosAfectados: { 
            estadoAnterior: "HABILITABLE", 
            estadoNuevo: "ACTIVA",
            funcionarioId,
            correo: correo_institucional,
          },
          ipOrigen: ip,
          userAgent,
        });
      } else {
        await client.query(
          `UPDATE funcionarios 
           SET password_hash = $1, fecha_actualizacion = NOW()
           WHERE funcionario_id = $2`,
          [nuevoHash, funcionarioId]
        );
      }

      await auditService.log({
        tipoEvento: "CAMBIO_PASSWORD_EXITOSO",
        usuarioId: funcionarioId,
        usuarioCorreo: correo_institucional,
        rolUsuario: rol_nombre,
        moduloAfectado: "AUTH",
        descripcion: esHabilitable 
          ? "Contraseña cambiada exitosamente en primer login - cuenta activada"
          : "Contraseña cambiada exitosamente",
        datosAfectados: {
          funcionarioId,
          correo: correo_institucional,
          primerLogin: esHabilitable,
          cuentaActivada: esHabilitable,
        },
        ipOrigen: ip,
        userAgent,
      });

      return { success: true, cuentaActivada: esHabilitable };
    } finally {
      client.release();
    }
  }

  /**
   * Desbloquear cuenta (solo ADMIN_CJ)
   */
  async desbloquearCuenta(
    funcionarioId: number,
    adminId: number,
    ip: string,
    userAgent: string
  ): Promise<boolean> {
    const client = await usersPool.connect();

    try {
      const result = await client.query(
        "SELECT estado FROM funcionarios WHERE funcionario_id = $1",
        [funcionarioId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const estadoAnterior = result.rows[0].estado;

      await client.query(
        `UPDATE funcionarios 
         SET estado = 'ACTIVA', intentos_fallidos = 0, fecha_bloqueo = NULL, fecha_actualizacion = NOW()
         WHERE funcionario_id = $1`,
        [funcionarioId]
      );

      // Registrar en historial
      await this.registrarCambioEstado(client, funcionarioId, estadoAnterior, "ACTIVA", adminId);

      await auditService.log({
        tipoEvento: "DESBLOQUEO_CUENTA",
        usuarioId: adminId,
        moduloAfectado: "ADMIN",
        descripcion: `Cuenta ${funcionarioId} desbloqueada por admin ${adminId}`,
        datosAfectados: { funcionarioId, estadoAnterior, estadoNuevo: "ACTIVA" },
        ipOrigen: ip,
        userAgent,
      });

      return true;
    } finally {
      client.release();
    }
  }

  /**
   * Convierte funcionario a formato público (sin password ni nombre real)
   * Se usa el pseudónimo para proteger la identidad del funcionario
   */
  private toPublicFuncionario(f: Funcionario & { rol_nombre?: UserRole }, pseudonimo?: string | null): FuncionarioPublico {
    return {
      funcionarioId: f.funcionario_id,
      identificacion: f.identificacion,
      nombresCompletos: pseudonimo || `${f.rol_nombre || 'FUNC'}-${f.funcionario_id.toString().padStart(4, '0')}`, // Usar pseudónimo en vez de nombre real
      pseudonimo: pseudonimo || null,
      correoInstitucional: f.correo_institucional,
      rolId: f.rol_id,
      rolNombre: f.rol_nombre,
      unidadJudicial: f.unidad_judicial,
      materia: f.materia,
      estado: f.estado,
      intentosFallidos: f.intentos_fallidos,
      fechaBloqueo: f.fecha_bloqueo,
      fechaCreacion: f.fecha_creacion,
      fechaActualizacion: f.fecha_actualizacion,
    };
  }
}

export const authService = new AuthService();
