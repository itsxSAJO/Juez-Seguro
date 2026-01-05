// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Notificaciones
// ============================================================================

import { casesPool } from "../db/connection.js";
import { v4 as uuidv4 } from "uuid";
import type { Notificacion, TipoNotificacion, EstadoNotificacion } from "../types/index.js";

interface CrearNotificacionInput {
  causaId: string;
  tipo: TipoNotificacion;
  destinatario: string;
  asunto: string;
  mensaje: string;
  prioridad?: "alta" | "normal" | "baja";
}

interface FiltrosNotificaciones {
  causaId?: string;
  destinatarioId?: string;
  estado?: EstadoNotificacion;
  tipo?: TipoNotificacion;
  page?: number;
  pageSize?: number;
}

/**
 * Servicio de Notificaciones
 */
class NotificacionesService {
  /**
   * Crea una nueva notificación
   */
  async crearNotificacion(
    input: CrearNotificacionInput,
    creadaPorId: number | string
  ): Promise<Notificacion> {
    const client = await casesPool.connect();

    try {
      const id = uuidv4();

      const result = await client.query(
        `INSERT INTO notificaciones (
          id, causa_id, tipo, destinatario, asunto, mensaje,
          prioridad, creada_por_id, estado, fecha_creacion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', NOW())
        RETURNING *`,
        [
          id,
          input.causaId,
          input.tipo,
          input.destinatario,
          input.asunto,
          input.mensaje,
          input.prioridad || "normal",
          creadaPorId,
        ]
      );

      return this.mapearNotificacion(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene notificaciones con filtros
   */
  async getNotificaciones(filtros: FiltrosNotificaciones): Promise<{ notificaciones: Notificacion[]; total: number }> {
    const client = await casesPool.connect();

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filtros.causaId) {
        conditions.push(`n.causa_id = $${paramIndex}`);
        params.push(filtros.causaId);
        paramIndex++;
      }

      if (filtros.destinatarioId) {
        conditions.push(`n.destinatario_id = $${paramIndex}`);
        params.push(filtros.destinatarioId);
        paramIndex++;
      }

      if (filtros.estado) {
        conditions.push(`n.estado = $${paramIndex}`);
        params.push(filtros.estado);
        paramIndex++;
      }

      if (filtros.tipo) {
        conditions.push(`n.tipo = $${paramIndex}`);
        params.push(filtros.tipo);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Contar total
      const countResult = await client.query(
        `SELECT COUNT(*) FROM notificaciones n ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Paginación
      const page = filtros.page || 1;
      const pageSize = filtros.pageSize || 20;
      const offset = (page - 1) * pageSize;

      params.push(pageSize, offset);

      const result = await client.query(
        `SELECT n.*, c.numero_expediente
         FROM notificaciones n
         LEFT JOIN causas c ON n.causa_id = c.id
         ${whereClause}
         ORDER BY n.fecha_creacion DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        notificaciones: result.rows.map(this.mapearNotificacion),
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene notificaciones pendientes
   */
  async getNotificacionesPendientes(): Promise<Notificacion[]> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT n.*, c.numero_expediente
         FROM notificaciones n
         LEFT JOIN causas c ON n.causa_id = c.id
         WHERE n.estado = 'pendiente'
         ORDER BY 
           CASE n.prioridad 
             WHEN 'alta' THEN 1 
             WHEN 'normal' THEN 2 
             ELSE 3 
           END,
           n.fecha_creacion ASC`
      );

      return result.rows.map(this.mapearNotificacion);
    } finally {
      client.release();
    }
  }

  /**
   * Marca notificación como enviada
   */
  async marcarEnviada(id: string): Promise<Notificacion | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE notificaciones 
         SET estado = 'enviada', fecha_envio = NOW()
         WHERE id = $1 RETURNING *`,
        [id]
      );

      return result.rows[0] ? this.mapearNotificacion(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Marca notificación como leída
   */
  async marcarLeida(id: string): Promise<Notificacion | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE notificaciones 
         SET estado = 'leida', fecha_lectura = NOW()
         WHERE id = $1 RETURNING *`,
        [id]
      );

      return result.rows[0] ? this.mapearNotificacion(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Cancela una notificación
   */
  async cancelar(id: string, motivo: string): Promise<Notificacion | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE notificaciones 
         SET estado = 'cancelada', 
             mensaje = mensaje || E'\n[CANCELADA]: ' || $2
         WHERE id = $1 RETURNING *`,
        [id, motivo]
      );

      return result.rows[0] ? this.mapearNotificacion(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Reenvía una notificación
   */
  async reenviar(id: string): Promise<Notificacion | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE notificaciones 
         SET estado = 'pendiente',
             intentos_envio = COALESCE(intentos_envio, 0) + 1
         WHERE id = $1 RETURNING *`,
        [id]
      );

      return result.rows[0] ? this.mapearNotificacion(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Estadísticas de notificaciones
   */
  async getEstadisticas(): Promise<{
    total: number;
    pendientes: number;
    enviadas: number;
    leidas: number;
    fallidas: number;
  }> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
          COUNT(*) FILTER (WHERE estado = 'enviada') as enviadas,
          COUNT(*) FILTER (WHERE estado = 'leida') as leidas,
          COUNT(*) FILTER (WHERE estado = 'fallida') as fallidas
        FROM notificaciones
      `);

      const row = result.rows[0];
      return {
        total: parseInt(row.total, 10),
        pendientes: parseInt(row.pendientes, 10),
        enviadas: parseInt(row.enviadas, 10),
        leidas: parseInt(row.leidas, 10),
        fallidas: parseInt(row.fallidas, 10),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Mapea fila de BD a tipo Notificacion
   */
  private mapearNotificacion(row: any): Notificacion {
    return {
      id: row.id,
      causa_id: row.causa_id,
      causaId: row.causa_id,
      numeroExpediente: row.numero_expediente,
      tipo: row.tipo,
      destinatario: row.destinatario,
      asunto: row.asunto,
      mensaje: row.mensaje,
      prioridad: row.prioridad,
      creada_por_id: row.creada_por_id,
      creadaPorId: row.creada_por_id,
      estado: row.estado,
      fecha_creacion: row.fecha_creacion,
      fechaCreacion: row.fecha_creacion,
      fecha_envio: row.fecha_envio,
      fechaEnvio: row.fecha_envio,
      fecha_lectura: row.fecha_lectura,
      fechaLectura: row.fecha_lectura,
      intentos_envio: row.intentos_envio,
      intentosEnvio: row.intentos_envio,
    };
  }
}

export const notificacionesService = new NotificacionesService();
export default notificacionesService;
