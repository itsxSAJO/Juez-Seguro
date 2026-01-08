// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Notificaciones
// ============================================================================

import { casesPool } from "../db/connection.js";
import { v4 as uuidv4 } from "uuid";
import type { 
  Notificacion, 
  TipoNotificacion, 
  EstadoNotificacion,
  NotificacionInterna,
  TipoNotificacionInterna,
  PrioridadNotificacion
} from "../types/index.js";

interface CrearNotificacionInput {
  causaId: string;
  tipo: TipoNotificacion;
  destinatario: string;
  asunto: string;
  mensaje: string;
  prioridad?: "alta" | "normal" | "baja";
}

interface CrearNotificacionInternaInput {
  destinatarioId: number;
  tipo: TipoNotificacionInterna;
  titulo: string;
  mensaje: string;
  causaId?: number;
  audienciaId?: number;
  prioridad?: PrioridadNotificacion;
  datosAdicionales?: Record<string, any>;
  creadoPorId?: number;
  ipOrigen?: string;
}

interface FiltrosNotificaciones {
  causaId?: string;
  destinatarioId?: string;
  estado?: EstadoNotificacion;
  tipo?: TipoNotificacion;
  page?: number;
  pageSize?: number;
}

interface FiltrosNotificacionesInternas {
  destinatarioId: number;
  estado?: "no_leida" | "leida" | "archivada" | "todas";
  tipo?: TipoNotificacionInterna;
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
        `SELECT n.*, c.numero_proceso
         FROM notificaciones n
         LEFT JOIN causas c ON n.causa_id = c.causa_id
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
        `SELECT n.*, c.numero_proceso
         FROM notificaciones n
         LEFT JOIN causas c ON n.causa_id = c.causa_id
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
      numeroExpediente: row.numero_proceso,
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

  // ==========================================================================
  // NOTIFICACIONES INTERNAS DEL SISTEMA (para jueces)
  // ==========================================================================

  /**
   * Crea una notificación interna del sistema
   */
  async crearNotificacionInterna(input: CrearNotificacionInternaInput): Promise<NotificacionInterna> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `INSERT INTO notificaciones_internas (
          destinatario_id, tipo, titulo, mensaje, causa_id, audiencia_id,
          prioridad, datos_adicionales, creado_por_id, ip_origen
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          input.destinatarioId,
          input.tipo,
          input.titulo,
          input.mensaje,
          input.causaId || null,
          input.audienciaId || null,
          input.prioridad || "normal",
          input.datosAdicionales ? JSON.stringify(input.datosAdicionales) : null,
          input.creadoPorId || null,
          input.ipOrigen || null,
        ]
      );

      return this.mapearNotificacionInterna(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Crea notificación cuando se asigna una causa a un juez
   */
  async notificarCausaAsignada(
    juezId: number,
    causaId: number,
    numeroProceso: string,
    materia: string,
    creadoPorId?: number,
    ipOrigen?: string
  ): Promise<NotificacionInterna> {
    return this.crearNotificacionInterna({
      destinatarioId: juezId,
      tipo: "causa_asignada",
      titulo: "Nueva causa asignada",
      mensaje: `Se le ha asignado la causa ${numeroProceso} (${materia}).`,
      causaId,
      prioridad: "alta",
      datosAdicionales: {
        numeroProceso,
        materia,
        fechaAsignacion: new Date().toISOString(),
      },
      creadoPorId,
      ipOrigen,
    });
  }

  /**
   * Crea notificación cuando se programa una audiencia
   */
  async notificarAudienciaProgramada(
    juezId: number,
    audienciaId: number,
    causaId: number,
    numeroProceso: string,
    fechaHora: Date,
    tipoAudiencia: string,
    creadoPorId?: number,
    ipOrigen?: string
  ): Promise<NotificacionInterna> {
    const fechaFormateada = fechaHora.toLocaleDateString("es-EC", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return this.crearNotificacionInterna({
      destinatarioId: juezId,
      tipo: "audiencia_programada",
      titulo: "Audiencia programada",
      mensaje: `Se ha programado una audiencia de ${tipoAudiencia} para la causa ${numeroProceso}. Fecha: ${fechaFormateada}.`,
      causaId,
      audienciaId,
      prioridad: "alta",
      datosAdicionales: {
        numeroProceso,
        tipoAudiencia,
        fechaHora: fechaHora.toISOString(),
      },
      creadoPorId,
      ipOrigen,
    });
  }

  /**
   * Crea notificación cuando se reprograma una audiencia
   */
  async notificarAudienciaReprogramada(
    juezId: number,
    audienciaId: number,
    causaId: number,
    numeroProceso: string,
    fechaAnterior: Date,
    fechaNueva: Date,
    motivo: string,
    creadoPorId?: number,
    ipOrigen?: string
  ): Promise<NotificacionInterna> {
    const fechaAnteriorStr = fechaAnterior.toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const fechaNuevaStr = fechaNueva.toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    return this.crearNotificacionInterna({
      destinatarioId: juezId,
      tipo: "audiencia_reprogramada",
      titulo: "⚠️ Audiencia reprogramada",
      mensaje: `La audiencia de la causa ${numeroProceso} ha sido reprogramada. Fecha anterior: ${fechaAnteriorStr}. Nueva fecha: ${fechaNuevaStr}. Motivo: ${motivo}`,
      causaId,
      audienciaId,
      prioridad: "urgente",
      datosAdicionales: {
        numeroProceso,
        fechaAnterior: fechaAnterior.toISOString(),
        fechaNueva: fechaNueva.toISOString(),
        motivo,
      },
      creadoPorId,
      ipOrigen,
    });
  }

  /**
   * Obtiene notificaciones internas para un usuario
   */
  async getMisNotificaciones(filtros: FiltrosNotificacionesInternas): Promise<{ 
    notificaciones: NotificacionInterna[]; 
    total: number;
    noLeidas: number;
  }> {
    const client = await casesPool.connect();

    try {
      const conditions: string[] = ["n.destinatario_id = $1"];
      const params: unknown[] = [filtros.destinatarioId];
      let paramIndex = 2;

      if (filtros.estado && filtros.estado !== "todas") {
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
        `SELECT COUNT(*) FROM notificaciones_internas n ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Contar no leídas
      const noLeidasResult = await client.query(
        `SELECT COUNT(*) FROM notificaciones_internas WHERE destinatario_id = $1 AND estado = 'no_leida'`,
        [filtros.destinatarioId]
      );
      const noLeidas = parseInt(noLeidasResult.rows[0].count, 10);

      // Paginación
      const page = filtros.page || 1;
      const pageSize = filtros.pageSize || 20;
      const offset = (page - 1) * pageSize;

      params.push(pageSize, offset);

      const result = await client.query(
        `SELECT n.*, c.numero_proceso
         FROM notificaciones_internas n
         LEFT JOIN causas c ON n.causa_id = c.causa_id
         ${whereClause}
         ORDER BY 
           CASE n.estado WHEN 'no_leida' THEN 0 ELSE 1 END,
           CASE n.prioridad 
             WHEN 'urgente' THEN 1 
             WHEN 'alta' THEN 2 
             WHEN 'normal' THEN 3 
             ELSE 4 
           END,
           n.fecha_creacion DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        notificaciones: result.rows.map(this.mapearNotificacionInterna),
        total,
        noLeidas,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Marca una notificación interna como leída
   */
  async marcarNotificacionInternaLeida(id: number, usuarioId: number): Promise<NotificacionInterna | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE notificaciones_internas 
         SET estado = 'leida', fecha_lectura = NOW()
         WHERE notificacion_id = $1 AND destinatario_id = $2
         RETURNING *`,
        [id, usuarioId]
      );

      return result.rows[0] ? this.mapearNotificacionInterna(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Marca todas las notificaciones internas como leídas
   */
  async marcarTodasLeidas(usuarioId: number): Promise<number> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE notificaciones_internas 
         SET estado = 'leida', fecha_lectura = NOW()
         WHERE destinatario_id = $1 AND estado = 'no_leida'`,
        [usuarioId]
      );

      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * Archiva una notificación interna
   */
  async archivarNotificacionInterna(id: number, usuarioId: number): Promise<NotificacionInterna | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE notificaciones_internas 
         SET estado = 'archivada'
         WHERE notificacion_id = $1 AND destinatario_id = $2
         RETURNING *`,
        [id, usuarioId]
      );

      return result.rows[0] ? this.mapearNotificacionInterna(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el conteo de notificaciones no leídas
   */
  async getConteoNoLeidas(usuarioId: number): Promise<number> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT COUNT(*) FROM notificaciones_internas 
         WHERE destinatario_id = $1 AND estado = 'no_leida'`,
        [usuarioId]
      );

      return parseInt(result.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  /**
   * Mapea fila de BD a tipo NotificacionInterna
   */
  private mapearNotificacionInterna(row: any): NotificacionInterna {
    return {
      id: row.notificacion_id,
      notificacion_id: row.notificacion_id,
      destinatarioId: row.destinatario_id,
      destinatario_id: row.destinatario_id,
      tipo: row.tipo,
      titulo: row.titulo,
      mensaje: row.mensaje,
      causaId: row.causa_id,
      causa_id: row.causa_id,
      audienciaId: row.audiencia_id,
      audiencia_id: row.audiencia_id,
      estado: row.estado,
      prioridad: row.prioridad,
      datosAdicionales: row.datos_adicionales,
      datos_adicionales: row.datos_adicionales,
      creadoPorId: row.creado_por_id,
      creado_por_id: row.creado_por_id,
      ipOrigen: row.ip_origen,
      ip_origen: row.ip_origen,
      fechaCreacion: row.fecha_creacion,
      fecha_creacion: row.fecha_creacion,
      fechaLectura: row.fecha_lectura,
      fecha_lectura: row.fecha_lectura,
      numeroProceso: row.numero_proceso,
      numero_proceso: row.numero_proceso,
    };
  }
}

export const notificacionesService = new NotificacionesService();
export default notificacionesService;
