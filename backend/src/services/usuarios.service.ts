// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Funcionarios (FIA)
// Gestión de cuentas con control de acceso
// Tablas: funcionarios, roles, historial_estados
// ============================================================================

import { usersPool } from "../db/connection.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auditService } from "./audit.service.js";
import { pseudonimosService } from "./pseudonimos.service.js";
import { emailService } from "./email.service.js";
import { pkiService } from "./pki.service.js";
import type { Funcionario, FuncionarioPublico, UserRole, EstadoCuenta, Rol } from "../types/index.js";

// Constante para identificar el rol de JUEZ
const ROL_JUEZ_ID = 2; // Según el esquema: ADMIN_CJ=1, JUEZ=2, SECRETARIO=3

/**
 * Genera una contraseña segura aleatoria
 * Incluye mayúsculas, minúsculas, números y caracteres especiales
 */
function generarPasswordSeguro(longitud: number = 12): string {
  const mayusculas = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Sin I, O para evitar confusión
  const minusculas = "abcdefghjkmnpqrstuvwxyz"; // Sin i, l, o
  const numeros = "23456789"; // Sin 0, 1 para evitar confusión
  const especiales = "!@#$%&*";
  
  // Garantizar al menos uno de cada tipo
  let password = "";
  password += mayusculas[crypto.randomInt(mayusculas.length)];
  password += minusculas[crypto.randomInt(minusculas.length)];
  password += numeros[crypto.randomInt(numeros.length)];
  password += especiales[crypto.randomInt(especiales.length)];
  
  // Completar con caracteres aleatorios
  const todosCaracteres = mayusculas + minusculas + numeros + especiales;
  for (let i = password.length; i < longitud; i++) {
    password += todosCaracteres[crypto.randomInt(todosCaracteres.length)];
  }
  
  // Mezclar los caracteres
  return password.split("").sort(() => crypto.randomInt(3) - 1).join("");
}

interface CrearFuncionarioInput {
  identificacion: string;
  nombresCompletos: string;
  correoInstitucional: string;
  password?: string; // Opcional - se genera automáticamente si no se proporciona
  rolId: number;
  unidadJudicial: string;
  materia: string;
}

interface ActualizarFuncionarioInput {
  nombresCompletos?: string;
  correoInstitucional?: string;
  rolId?: number;
  unidadJudicial?: string;
  materia?: string;
  estado?: EstadoCuenta;
}

interface FiltrosFuncionarios {
  rolId?: number;
  estado?: EstadoCuenta;
  unidadJudicial?: string;
  materia?: string;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Servicio de Funcionarios - FIA
 * Gestión de identidades y atributos de seguridad
 */
class FuncionariosService {
  /**
   * Crea un nuevo funcionario
   */
  async crearFuncionario(
    input: CrearFuncionarioInput,
    adminId: number,
    ip: string,
    userAgent: string
  ): Promise<FuncionarioPublico> {
    const client = await usersPool.connect();

    try {
      // Verificar si ya existe identificación o correo
      const existe = await client.query(
        "SELECT funcionario_id FROM funcionarios WHERE identificacion = $1 OR correo_institucional = $2",
        [input.identificacion, input.correoInstitucional.toLowerCase()]
      );

      if (existe.rows.length > 0) {
        throw new Error("Ya existe un funcionario con esa identificación o correo");
      }

      // Verificar que el rol existe
      const rolExiste = await client.query(
        "SELECT rol_id FROM roles WHERE rol_id = $1",
        [input.rolId]
      );

      if (rolExiste.rows.length === 0) {
        throw new Error("El rol especificado no existe");
      }

      // Generar contraseña automáticamente si no se proporciona
      const passwordTemporal = input.password || generarPasswordSeguro(12);
      const passwordHash = await bcrypt.hash(passwordTemporal, 12);

      const result = await client.query(
        `INSERT INTO funcionarios (
          identificacion, nombres_completos, correo_institucional, password_hash,
          rol_id, unidad_judicial, materia, estado, intentos_fallidos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'HABILITABLE', 0)
        RETURNING *`,
        [
          input.identificacion,
          input.nombresCompletos,
          input.correoInstitucional.toLowerCase(),
          passwordHash,
          input.rolId,
          input.unidadJudicial,
          input.materia,
        ]
      );

      const funcionario = result.rows[0] as Funcionario;

      // Enviar correo con las credenciales al funcionario usando el servicio de email
      const correoEnviado = await emailService.enviarCredenciales(
        input.correoInstitucional.toLowerCase(),
        input.nombresCompletos,
        passwordTemporal
      );

      if (!correoEnviado) {
        console.warn(`⚠️ No se pudo enviar el correo de credenciales a ${input.correoInstitucional}`);
      }

      // EVENTO CRÍTICO: Si el rol es JUEZ, generar pseudónimo inmediatamente
      // Esto garantiza que el pseudónimo exista ANTES de asignar cualquier causa
      let pseudonimoGenerado: string | null = null;
      let certificadoGenerado: boolean = false;
      
      if (input.rolId === ROL_JUEZ_ID) {
        // 1. Generar pseudónimo
        pseudonimoGenerado = await pseudonimosService.crearPseudonimoJuez(
          funcionario.funcionario_id,
          adminId,
          ip,
          userAgent
        );

        // 2. Generar certificado PKI para firma electrónica
        try {
          const resultadoPKI = await pkiService.generarCertificadoJuez({
            juezId: funcionario.funcionario_id,
            nombreCompleto: input.nombresCompletos,
            correo: input.correoInstitucional.toLowerCase(),
          });
          
          certificadoGenerado = resultadoPKI.exito;
          
          if (resultadoPKI.exito) {
            console.log(`[USUARIOS] Certificado PKI generado para juez ${funcionario.funcionario_id}`);
          } else {
            console.warn(`[USUARIOS] ⚠️ No se pudo generar certificado PKI: ${resultadoPKI.mensaje}`);
          }
        } catch (pkiError) {
          console.error("[USUARIOS] Error al generar certificado PKI:", pkiError);
          // No fallar el registro si falla el certificado - se puede generar después
        }
      }

      await auditService.log({
        tipoEvento: "CREACION_USUARIO",
        usuarioId: adminId,
        moduloAfectado: "ADMIN",
        descripcion: `Funcionario creado: ${input.identificacion} - ${input.nombresCompletos}${pseudonimoGenerado ? " (pseudónimo generado)" : ""}${certificadoGenerado ? " (certificado PKI generado)" : ""}`,
        datosAfectados: { 
          funcionarioId: funcionario.funcionario_id, 
          identificacion: input.identificacion,
          rolId: input.rolId,
          pseudonimoGenerado: pseudonimoGenerado !== null,
          certificadoGenerado: certificadoGenerado
        },
        ipOrigen: ip,
        userAgent,
      });

      return this.toPublic(funcionario);
    } finally {
      client.release();
    }
  }

  /**
   * Verifica si un correo electrónico está disponible
   */
  async verificarDisponibilidadCorreo(correo: string): Promise<boolean> {
    const client = await usersPool.connect();

    try {
      const result = await client.query(
        "SELECT funcionario_id FROM funcionarios WHERE correo_institucional = $1",
        [correo.toLowerCase()]
      );

      return result.rows.length === 0;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene funcionarios con filtros
   */
  async getFuncionarios(filtros: FiltrosFuncionarios): Promise<{ funcionarios: FuncionarioPublico[]; total: number }> {
    const client = await usersPool.connect();

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filtros.rolId) {
        conditions.push(`f.rol_id = $${paramIndex}`);
        params.push(filtros.rolId);
        paramIndex++;
      }

      if (filtros.estado) {
        conditions.push(`f.estado = $${paramIndex}`);
        params.push(filtros.estado);
        paramIndex++;
      }

      if (filtros.unidadJudicial) {
        conditions.push(`f.unidad_judicial = $${paramIndex}`);
        params.push(filtros.unidadJudicial);
        paramIndex++;
      }

      if (filtros.materia) {
        conditions.push(`f.materia = $${paramIndex}`);
        params.push(filtros.materia);
        paramIndex++;
      }

      if (filtros.busqueda) {
        conditions.push(`(f.nombres_completos ILIKE $${paramIndex} OR f.correo_institucional ILIKE $${paramIndex} OR f.identificacion ILIKE $${paramIndex})`);
        params.push(`%${filtros.busqueda}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Contar total
      const countResult = await client.query(
        `SELECT COUNT(*) FROM funcionarios f ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Paginación
      const page = filtros.page || 1;
      const pageSize = filtros.pageSize || 20;
      const offset = (page - 1) * pageSize;

      params.push(pageSize, offset);

      const result = await client.query(
        `SELECT f.*, r.nombre as rol_nombre
         FROM funcionarios f
         JOIN roles r ON f.rol_id = r.rol_id
         ${whereClause}
         ORDER BY f.fecha_creacion DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        funcionarios: result.rows.map((row) => this.toPublic(row)),
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene un funcionario por ID
   */
  async getFuncionarioById(id: number): Promise<FuncionarioPublico | null> {
    const client = await usersPool.connect();

    try {
      const result = await client.query(
        `SELECT f.*, r.nombre as rol_nombre
         FROM funcionarios f
         JOIN roles r ON f.rol_id = r.rol_id
         WHERE f.funcionario_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toPublic(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Actualiza un funcionario
   */
  async actualizarFuncionario(
    id: number,
    input: ActualizarFuncionarioInput,
    adminId: number,
    ip: string,
    userAgent: string
  ): Promise<FuncionarioPublico | null> {
    const client = await usersPool.connect();

    try {
      // Obtener estado actual para historial
      const actual = await client.query(
        "SELECT * FROM funcionarios WHERE funcionario_id = $1",
        [id]
      );

      if (actual.rows.length === 0) {
        return null;
      }

      const funcionarioActual = actual.rows[0] as Funcionario;
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (input.nombresCompletos) {
        updates.push(`nombres_completos = $${paramIndex}`);
        params.push(input.nombresCompletos);
        paramIndex++;
      }

      if (input.correoInstitucional) {
        updates.push(`correo_institucional = $${paramIndex}`);
        params.push(input.correoInstitucional.toLowerCase());
        paramIndex++;
      }

      if (input.rolId) {
        updates.push(`rol_id = $${paramIndex}`);
        params.push(input.rolId);
        paramIndex++;
      }

      if (input.unidadJudicial) {
        updates.push(`unidad_judicial = $${paramIndex}`);
        params.push(input.unidadJudicial);
        paramIndex++;
      }

      if (input.materia) {
        updates.push(`materia = $${paramIndex}`);
        params.push(input.materia);
        paramIndex++;
      }

      if (input.estado && input.estado !== funcionarioActual.estado) {
        updates.push(`estado = $${paramIndex}`);
        params.push(input.estado);
        paramIndex++;

        // Registrar cambio de estado en historial
        await client.query(
          `INSERT INTO historial_estados (funcionario_id, estado_anterior, estado_nuevo, usuario_modificador_id)
           VALUES ($1, $2, $3, $4)`,
          [id, funcionarioActual.estado, input.estado, adminId]
        );
      }

      if (updates.length === 0) {
        return this.toPublic(funcionarioActual);
      }

      updates.push("fecha_actualizacion = NOW()");
      params.push(id);

      const result = await client.query(
        `UPDATE funcionarios SET ${updates.join(", ")} WHERE funcionario_id = $${paramIndex} RETURNING *`,
        params
      );

      await auditService.log({
        tipoEvento: "MODIFICACION_USUARIO",
        usuarioId: adminId,
        moduloAfectado: "ADMIN",
        descripcion: `Funcionario actualizado: ${funcionarioActual.identificacion}`,
        datosAfectados: { funcionarioId: id, cambios: input },
        ipOrigen: ip,
        userAgent,
      });

      return this.toPublic(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Cambia el estado de un funcionario
   */
  async cambiarEstado(
    id: number,
    nuevoEstado: EstadoCuenta,
    adminId: number,
    ip: string,
    userAgent: string
  ): Promise<boolean> {
    const client = await usersPool.connect();

    try {
      const actual = await client.query(
        "SELECT estado, identificacion FROM funcionarios WHERE funcionario_id = $1",
        [id]
      );

      if (actual.rows.length === 0) {
        return false;
      }

      const estadoAnterior = actual.rows[0].estado;
      const identificacion = actual.rows[0].identificacion;

      await client.query(
        `UPDATE funcionarios SET estado = $1, fecha_actualizacion = NOW() WHERE funcionario_id = $2`,
        [nuevoEstado, id]
      );

      // Registrar en historial
      await client.query(
        `INSERT INTO historial_estados (funcionario_id, estado_anterior, estado_nuevo, usuario_modificador_id)
         VALUES ($1, $2, $3, $4)`,
        [id, estadoAnterior, nuevoEstado, adminId]
      );

      await auditService.log({
        tipoEvento: "CAMBIO_ESTADO",
        usuarioId: adminId,
        moduloAfectado: "ADMIN",
        descripcion: `Estado de funcionario ${identificacion} cambiado de ${estadoAnterior} a ${nuevoEstado}`,
        datosAfectados: { funcionarioId: id, estadoAnterior, estadoNuevo: nuevoEstado },
        ipOrigen: ip,
        userAgent,
      });

      return true;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene todos los roles
   */
  async getRoles(): Promise<Rol[]> {
    const client = await usersPool.connect();

    try {
      const result = await client.query("SELECT * FROM roles ORDER BY rol_id");
      return result.rows as Rol[];
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene historial de estados de un funcionario
   */
  async getHistorialEstados(funcionarioId: number): Promise<any[]> {
    const client = await usersPool.connect();

    try {
      const result = await client.query(
        `SELECT h.*, f.nombres_completos as modificador_nombre
         FROM historial_estados h
         LEFT JOIN funcionarios f ON h.usuario_modificador_id = f.funcionario_id
         WHERE h.funcionario_id = $1
         ORDER BY h.fecha_cambio DESC`,
        [funcionarioId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Convierte funcionario a formato público
   */
  private toPublic(f: any): FuncionarioPublico {
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
      ultimoAcceso: f.ultimo_acceso || null,
    };
  }
}

export const funcionariosService = new FuncionariosService();

// Alias para compatibilidad
export const usuariosService = funcionariosService;
