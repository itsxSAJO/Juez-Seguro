// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Audiencias
// ============================================================================

import { casesPool } from "../db/connection.js";
import { v4 as uuidv4 } from "uuid";
import type { Audiencia, EstadoAudiencia, TipoAudiencia } from "../types/index.js";

interface CrearAudienciaInput {
  causaId: string;
  tipo: TipoAudiencia;
  fechaHora: Date;
  sala: string;
  duracionMinutos?: number;
  modalidad: "presencial" | "virtual";
  enlaceVirtual?: string;
  observaciones?: string;
}

interface FiltrosAudiencias {
  causaId?: string;
  juezId?: string;
  estado?: EstadoAudiencia;
  fechaDesde?: Date;
  fechaHasta?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Servicio de Audiencias
 */
class AudienciasService {
  /**
   * Crea una nueva audiencia
   */
  async crearAudiencia(
    input: CrearAudienciaInput,
    programadaPorId: number | string
  ): Promise<Audiencia> {
    const client = await casesPool.connect();

    try {
      const id = uuidv4();

      const result = await client.query(
        `INSERT INTO audiencias (
          id, causa_id, tipo, fecha_hora, sala, duracion_minutos,
          modalidad, enlace_virtual, observaciones, programada_por_id,
          estado, fecha_creacion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'programada', NOW())
        RETURNING *`,
        [
          id,
          input.causaId,
          input.tipo,
          input.fechaHora,
          input.sala,
          input.duracionMinutos || 60,
          input.modalidad,
          input.enlaceVirtual || null,
          input.observaciones || null,
          programadaPorId,
        ]
      );

      return this.mapearAudiencia(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene audiencias con filtros
   */
  async getAudiencias(filtros: FiltrosAudiencias): Promise<{ audiencias: Audiencia[]; total: number }> {
    const client = await casesPool.connect();

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filtros.causaId) {
        conditions.push(`a.causa_id = $${paramIndex}`);
        params.push(filtros.causaId);
        paramIndex++;
      }

      if (filtros.juezId) {
        conditions.push(`c.juez_asignado_id = $${paramIndex}`);
        params.push(filtros.juezId);
        paramIndex++;
      }

      if (filtros.estado) {
        conditions.push(`a.estado = $${paramIndex}`);
        params.push(filtros.estado);
        paramIndex++;
      }

      if (filtros.fechaDesde) {
        conditions.push(`a.fecha_programada >= $${paramIndex}`);
        params.push(filtros.fechaDesde);
        paramIndex++;
      }

      if (filtros.fechaHasta) {
        conditions.push(`a.fecha_programada <= $${paramIndex}`);
        params.push(filtros.fechaHasta);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Contar total
      const countResult = await client.query(
        `SELECT COUNT(*) FROM audiencias a
         LEFT JOIN causas c ON a.causa_id = c.causa_id
         ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Paginación
      const page = filtros.page || 1;
      const pageSize = filtros.pageSize || 20;
      const offset = (page - 1) * pageSize;

      params.push(pageSize, offset);

      const result = await client.query(
        `SELECT a.*, c.numero_proceso, c.materia
         FROM audiencias a
         LEFT JOIN causas c ON a.causa_id = c.causa_id
         ${whereClause}
         ORDER BY a.fecha_programada ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        audiencias: result.rows.map(this.mapearAudiencia),
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene audiencias del día actual
   */
  async getAudienciasHoy(juezId?: string): Promise<Audiencia[]> {
    const client = await casesPool.connect();

    try {
      let query = `
        SELECT a.*, c.numero_proceso, c.materia
        FROM audiencias a
        LEFT JOIN causas c ON a.causa_id = c.causa_id
        WHERE DATE(a.fecha_programada) = CURRENT_DATE
      `;
      const params: unknown[] = [];

      if (juezId) {
        query += ` AND c.juez_asignado_id = $1`;
        params.push(juezId);
      }

      query += ` ORDER BY a.fecha_programada ASC`;

      const result = await client.query(query, params);

      return result.rows.map(this.mapearAudiencia);
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene audiencias de la semana
   */
  async getAudienciasSemana(juezId?: string): Promise<Audiencia[]> {
    const client = await casesPool.connect();

    try {
      let query = `
        SELECT a.*, c.numero_proceso, c.materia
        FROM audiencias a
        LEFT JOIN causas c ON a.causa_id = c.causa_id
        WHERE a.fecha_programada >= DATE_TRUNC('week', CURRENT_DATE)
          AND a.fecha_programada < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
      `;
      const params: unknown[] = [];

      if (juezId) {
        query += ` AND c.juez_asignado_id = $1`;
        params.push(juezId);
      }

      query += ` ORDER BY a.fecha_programada ASC`;

      const result = await client.query(query, params);

      return result.rows.map(this.mapearAudiencia);
    } finally {
      client.release();
    }
  }

  /**
   * Actualiza estado de audiencia
   */
  async cambiarEstado(id: string, estado: EstadoAudiencia): Promise<Audiencia | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE audiencias SET estado = $1, fecha_actualizacion = NOW()
         WHERE id = $2 RETURNING *`,
        [estado, id]
      );

      return result.rows[0] ? this.mapearAudiencia(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Reprograma una audiencia
   */
  async reprogramar(
    id: string,
    nuevaFecha: Date,
    motivo: string
  ): Promise<Audiencia | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE audiencias 
         SET fecha_hora = $1, 
             estado = 'reprogramada',
             observaciones = COALESCE(observaciones, '') || E'\n[REPROGRAMADA]: ' || $2,
             fecha_actualizacion = NOW()
         WHERE id = $3 RETURNING *`,
        [nuevaFecha, motivo, id]
      );

      return result.rows[0] ? this.mapearAudiencia(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Mapea fila de BD a tipo Audiencia
   */
  private mapearAudiencia(row: any): Audiencia {
    return {
      id: row.id,
      causa_id: row.causa_id,
      causaId: row.causa_id,
      numeroExpediente: row.numero_proceso,
      materia: row.materia,
      tipo: row.tipo,
      fecha: row.fecha_hora,
      fecha_hora: row.fecha_hora,
      fechaHora: row.fecha_hora,
      sala: row.sala,
      duracion_minutos: row.duracion_minutos,
      duracionMinutos: row.duracion_minutos,
      modalidad: row.modalidad,
      enlace_virtual: row.enlace_virtual,
      enlaceVirtual: row.enlace_virtual,
      observaciones: row.observaciones,
      programada_por_id: row.programada_por_id,
      programadaPorId: row.programada_por_id,
      estado: row.estado,
      fecha_creacion: row.fecha_creacion,
      fechaCreacion: row.fecha_creacion,
    };
  }
}

export const audienciasService = new AudienciasService();
export default audienciasService;
