// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Causas (FDP)
// Protección de datos con pseudonimización
// Tablas: causas, mapa_pseudonimos, expedientes
// ============================================================================

import { casesPool } from "../db/connection.js";
import crypto from "crypto";
import { auditService } from "./audit.service.js";
import type { Causa, CausaPublica, EstadoProcesal, Expediente, MapaPseudonimo } from "../types/index.js";

interface CrearCausaInput {
  numeroProceso: string;
  materia: string;
  tipoProceso: string;
  unidadJudicial: string;
}

interface FiltrosCausas {
  estadoProcesal?: EstadoProcesal;
  materia?: string;
  unidadJudicial?: string;
  juezAsignadoId?: number;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Servicio de Causas - FDP (Functional Data Protection)
 * Implementa FDP_IFF (Flujo de información anonimizado)
 */
class CausasService {
  /**
   * Genera un pseudónimo único para un juez (FDP_IFF)
   */
  private generarPseudonimo(juezId: number): string {
    const hash = crypto.createHash("sha256")
      .update(juezId.toString() + process.env.PSEUDONYM_SALT || "salt")
      .digest("hex");
    return `N5-${hash.substring(0, 3).toUpperCase()}`;
  }

  /**
   * Obtiene o crea pseudónimo para un juez
   */
  async obtenerPseudonimo(juezIdReal: number): Promise<string> {
    const client = await casesPool.connect();

    try {
      // Buscar pseudónimo existente
      const existe = await client.query(
        "SELECT pseudonimo_publico FROM mapa_pseudonimos WHERE juez_id_real = $1",
        [juezIdReal]
      );

      if (existe.rows.length > 0) {
        return existe.rows[0].pseudonimo_publico;
      }

      // Generar nuevo pseudónimo
      const pseudonimo = this.generarPseudonimo(juezIdReal);

      await client.query(
        `INSERT INTO mapa_pseudonimos (juez_id_real, pseudonimo_publico)
         VALUES ($1, $2)
         ON CONFLICT (juez_id_real) DO NOTHING`,
        [juezIdReal, pseudonimo]
      );

      return pseudonimo;
    } finally {
      client.release();
    }
  }

  /**
   * Crea una nueva causa
   */
  async crearCausa(
    input: CrearCausaInput,
    juezAsignadoId: number,
    secretarioCreadorId: number,
    ip: string,
    userAgent: string
  ): Promise<Causa> {
    const client = await casesPool.connect();

    try {
      // Verificar que no existe el número de proceso
      const existe = await client.query(
        "SELECT causa_id FROM causas WHERE numero_proceso = $1",
        [input.numeroProceso]
      );

      if (existe.rows.length > 0) {
        throw new Error("Ya existe una causa con ese número de proceso");
      }

      // Obtener pseudónimo del juez
      const juezPseudonimo = await this.obtenerPseudonimo(juezAsignadoId);

      const result = await client.query(
        `INSERT INTO causas (
          numero_proceso, materia, tipo_proceso, unidad_judicial,
          juez_asignado_id, juez_pseudonimo, secretario_creador_id, estado_procesal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INICIADA')
        RETURNING *`,
        [
          input.numeroProceso,
          input.materia,
          input.tipoProceso,
          input.unidadJudicial,
          juezAsignadoId,
          juezPseudonimo,
          secretarioCreadorId,
        ]
      );

      const causa = result.rows[0] as Causa;

      // Crear expediente electrónico asociado
      await client.query(
        `INSERT INTO expedientes (causa_id, observaciones)
         VALUES ($1, 'Expediente creado automáticamente')`,
        [causa.causa_id]
      );

      await auditService.log({
        tipoEvento: "CREACION_CAUSA",
        usuarioId: secretarioCreadorId,
        moduloAfectado: "CASOS",
        descripcion: `Causa creada: ${input.numeroProceso}`,
        datosAfectados: { causaId: causa.causa_id, numeroProceso: input.numeroProceso },
        ipOrigen: ip,
        userAgent,
      });

      return causa;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene causas con filtros (vista interna - incluye IDs reales)
   */
  async getCausas(filtros: FiltrosCausas): Promise<{ causas: Causa[]; total: number }> {
    const client = await casesPool.connect();

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filtros.estadoProcesal) {
        conditions.push(`estado_procesal = $${paramIndex}`);
        params.push(filtros.estadoProcesal);
        paramIndex++;
      }

      if (filtros.materia) {
        conditions.push(`materia = $${paramIndex}`);
        params.push(filtros.materia);
        paramIndex++;
      }

      if (filtros.unidadJudicial) {
        conditions.push(`unidad_judicial = $${paramIndex}`);
        params.push(filtros.unidadJudicial);
        paramIndex++;
      }

      if (filtros.juezAsignadoId) {
        conditions.push(`juez_asignado_id = $${paramIndex}`);
        params.push(filtros.juezAsignadoId);
        paramIndex++;
      }

      if (filtros.busqueda) {
        conditions.push(`(numero_proceso ILIKE $${paramIndex} OR materia ILIKE $${paramIndex})`);
        params.push(`%${filtros.busqueda}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Contar total
      const countResult = await client.query(
        `SELECT COUNT(*) FROM causas ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Paginación
      const page = filtros.page || 1;
      const pageSize = filtros.pageSize || 20;
      const offset = (page - 1) * pageSize;

      params.push(pageSize, offset);

      const result = await client.query(
        `SELECT * FROM causas ${whereClause}
         ORDER BY fecha_creacion DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        causas: result.rows as Causa[],
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene causas públicas (vista ciudadana - solo pseudónimos, sin IDs reales)
   */
  async getCausasPublicas(filtros: FiltrosCausas): Promise<{ causas: CausaPublica[]; total: number }> {
    const { causas, total } = await this.getCausas(filtros);

    return {
      causas: causas.map(this.toPublic),
      total,
    };
  }

  /**
   * Obtiene una causa por ID (vista interna)
   */
  async getCausaById(id: number): Promise<Causa | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM causas WHERE causa_id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as Causa;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene una causa por número de proceso (vista pública)
   */
  async getCausaByNumeroProceso(numeroProceso: string): Promise<CausaPublica | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM causas WHERE numero_proceso = $1",
        [numeroProceso]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toPublic(result.rows[0] as Causa);
    } finally {
      client.release();
    }
  }

  /**
   * Cambia el estado procesal de una causa
   */
  async cambiarEstadoProcesal(
    causaId: number,
    nuevoEstado: EstadoProcesal,
    usuarioId: number,
    ip: string,
    userAgent: string
  ): Promise<Causa | null> {
    const client = await casesPool.connect();

    try {
      const actual = await client.query(
        "SELECT * FROM causas WHERE causa_id = $1",
        [causaId]
      );

      if (actual.rows.length === 0) {
        return null;
      }

      const estadoAnterior = actual.rows[0].estado_procesal;

      const result = await client.query(
        `UPDATE causas SET estado_procesal = $1 WHERE causa_id = $2 RETURNING *`,
        [nuevoEstado, causaId]
      );

      await auditService.log({
        tipoEvento: "CAMBIO_ESTADO",
        usuarioId,
        moduloAfectado: "CASOS",
        descripcion: `Estado de causa ${actual.rows[0].numero_proceso} cambiado de ${estadoAnterior} a ${nuevoEstado}`,
        datosAfectados: { causaId, estadoAnterior, estadoNuevo: nuevoEstado },
        ipOrigen: ip,
        userAgent,
      });

      return result.rows[0] as Causa;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el expediente de una causa
   */
  async getExpediente(causaId: number): Promise<Expediente | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM expedientes WHERE causa_id = $1",
        [causaId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as Expediente;
    } finally {
      client.release();
    }
  }

  /**
   * Convierte causa a formato público (sin IDs reales)
   */
  private toPublic(c: Causa): CausaPublica {
    return {
      causaId: c.causa_id,
      numeroProceso: c.numero_proceso,
      materia: c.materia,
      tipoProceso: c.tipo_proceso,
      unidadJudicial: c.unidad_judicial,
      juezPseudonimo: c.juez_pseudonimo, // Solo pseudónimo, nunca ID real
      estadoProcesal: c.estado_procesal,
      fechaCreacion: c.fecha_creacion,
    };
  }
}

export const causasService = new CausasService();
