// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Autenticación (FIA)
// Identificación y autenticación según Common Criteria
// Tablas: funcionarios, roles, historial_estados
// ============================================================================

import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { usersPool } from "../db/connection.js";
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
  ): Promise<{ user: FuncionarioPublico; token: string; expiresAt: string } | null> {
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

      // Verificar si la cuenta está activa
      if (funcionario.estado !== "ACTIVA") {
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
      };

      const signOptions: SignOptions = {
        expiresIn: 1800, // 30 minutos
      };

      const token = jwt.sign(payload, config.jwt.secret as Secret, signOptions);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await auditService.logLogin(correo, ip, userAgent, true, funcionario.funcionario_id);

      return {
        user: this.toPublicFuncionario(funcionario),
        token,
        expiresAt,
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
      `INSERT INTO historial_estados (funcionario_id, estado_anterior, estado_nuevo, usuario_modificador_id)
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
   */
  async validateToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret as Secret) as TokenPayload;
      
      // Verificar que el funcionario sigue activo
      const client = await usersPool.connect();
      try {
        const result = await client.query(
          "SELECT estado FROM funcionarios WHERE funcionario_id = $1",
          [decoded.funcionarioId]
        );
        
        if (result.rows.length === 0 || result.rows[0].estado !== "ACTIVA") {
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
   */
  async cambiarPassword(
    funcionarioId: number,
    passwordActual: string,
    passwordNueva: string,
    ip: string,
    userAgent: string
  ): Promise<boolean> {
    const client = await usersPool.connect();

    try {
      const result = await client.query(
        "SELECT password_hash FROM funcionarios WHERE funcionario_id = $1",
        [funcionarioId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const passwordValid = await bcrypt.compare(passwordActual, result.rows[0].password_hash);
      if (!passwordValid) {
        await auditService.log({
          tipoEvento: "CAMBIO_PASSWORD_FALLIDO",
          usuarioId: funcionarioId,
          moduloAfectado: "AUTH",
          descripcion: "Intento de cambio de contraseña con password actual incorrecto",
          ipOrigen: ip,
          userAgent,
        });
        return false;
      }

      const nuevoHash = await bcrypt.hash(passwordNueva, 12);
      await client.query(
        `UPDATE funcionarios 
         SET password_hash = $1, fecha_actualizacion = NOW()
         WHERE funcionario_id = $2`,
        [nuevoHash, funcionarioId]
      );

      await auditService.log({
        tipoEvento: "CAMBIO_PASSWORD_EXITOSO",
        usuarioId: funcionarioId,
        moduloAfectado: "AUTH",
        descripcion: "Contraseña cambiada exitosamente",
        ipOrigen: ip,
        userAgent,
      });

      return true;
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
   * Convierte funcionario a formato público (sin password)
   */
  private toPublicFuncionario(f: Funcionario & { rol_nombre?: UserRole }): FuncionarioPublico {
    return {
      funcionarioId: f.funcionario_id,
      identificacion: f.identificacion,
      nombresCompletos: f.nombres_completos,
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
