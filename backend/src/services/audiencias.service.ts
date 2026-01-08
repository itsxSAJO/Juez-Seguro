// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Audiencias
// HU-SJ-003: Programación y gestión de audiencias
// HU-JZ-002: Consulta de la agenda de audiencias del juez
// ============================================================================

import { casesPool } from "../db/connection.js";
import { v4 as uuidv4 } from "uuid";
import { notificacionesService } from "./notificaciones.service.js";
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
  secretarioCreadorId?: string;
  estado?: EstadoAudiencia;
  fechaDesde?: Date;
  fechaHasta?: Date;
  page?: number;
  pageSize?: number;
}

// Interfaz para historial de reprogramaciones
interface HistorialReprogramacion {
  historialId: number;
  audienciaId: number;
  fechaHoraAnterior: Date;
  salaAnterior: string | null;
  fechaHoraNueva: Date;
  salaNueva: string | null;
  motivoReprogramacion: string;
  tipoCambio: "REPROGRAMACION" | "CANCELACION" | "CAMBIO_SALA";
  modificadoPorSecretarioId: number;
  modificadoPorRol: string;
  fechaModificacion: Date;
  ipModificacion: string | null;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
}

// Audiencia extendida con historial
interface AudienciaConHistorial extends Audiencia {
  historialCambios: HistorialReprogramacion[];
  fueReprogramada: boolean;
}

/**
 * Servicio de Audiencias
 * HU-SJ-003: Programación y gestión de audiencias
 * HU-JZ-002: Consulta de la agenda de audiencias del juez
 */
class AudienciasService {
  /**
   * Crea una nueva audiencia
   * HU-SJ-003: Valida que la fecha sea futura y notifica al juez
   */
  async crearAudiencia(
    input: CrearAudienciaInput,
    programadaPorId: number | string,
    ipOrigen?: string
  ): Promise<Audiencia> {
    const client = await casesPool.connect();

    try {
      // Validar que la fecha sea futura
      const ahora = new Date();
      if (input.fechaHora <= ahora) {
        throw new Error("La fecha de la audiencia debe ser futura");
      }

      // La tabla usa SERIAL, no UUID
      const result = await client.query(
        `INSERT INTO audiencias (
          causa_id, tipo, fecha_programada, sala, duracion_minutos,
          modalidad, observaciones, programado_por_id,
          estado, fecha_creacion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PROGRAMADA', NOW())
        RETURNING *, 
          fecha_programada as fecha_hora`,
        [
          input.causaId,
          input.tipo.toUpperCase(),
          input.fechaHora,
          input.sala,
          input.duracionMinutos || 60,
          input.modalidad.toUpperCase(),
          input.observaciones || null,
          programadaPorId,
        ]
      );

      const audiencia = this.mapearAudiencia(result.rows[0]);

      // Obtener información de la causa para notificar al juez
      try {
        const causaResult = await client.query(
          `SELECT causa_id, numero_proceso, juez_asignado_id FROM causas WHERE causa_id = $1`,
          [input.causaId]
        );

        if (causaResult.rows[0]) {
          const causa = causaResult.rows[0];
          await notificacionesService.notificarAudienciaProgramada(
            causa.juez_asignado_id,
            audiencia.id as unknown as number,
            causa.causa_id,
            causa.numero_proceso,
            input.fechaHora,
            input.tipo,
            typeof programadaPorId === "number" ? programadaPorId : parseInt(programadaPorId as string),
            ipOrigen
          );
        }
      } catch (notifError) {
        // No fallar la creación si la notificación falla
        console.error("Error al crear notificación de audiencia programada:", notifError);
      }

      return audiencia;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene audiencias con filtros
   * - juezId: Filtra por juez asignado a la causa
   * - secretarioCreadorId: Filtra por secretario que creó la causa
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

      // Filtro para secretario creador de la causa
      if (filtros.secretarioCreadorId) {
        conditions.push(`c.secretario_creador_id = $${paramIndex}`);
        params.push(filtros.secretarioCreadorId);
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
         WHERE audiencia_id = $2 RETURNING *`,
        [estado.toUpperCase(), parseInt(id)]
      );

      return result.rows[0] ? this.mapearAudiencia(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Reprograma una audiencia
   * HU-SJ-003: Guarda historial de reprogramaciones para trazabilidad
   */
  async reprogramar(
    id: string,
    nuevaFecha: Date,
    motivo: string,
    secretarioId: number,
    ip?: string
  ): Promise<Audiencia | null> {
    const client = await casesPool.connect();

    try {
      // Validar que la nueva fecha sea futura
      const ahora = new Date();
      if (nuevaFecha <= ahora) {
        throw new Error("La nueva fecha de la audiencia debe ser futura");
      }

      await client.query("BEGIN");

      // 1. Obtener datos actuales de la audiencia
      const audienciaActual = await client.query(
        `SELECT a.* FROM audiencias a WHERE a.audiencia_id = $1`,
        [parseInt(id)]
      );

      if (audienciaActual.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const audienciaVieja = audienciaActual.rows[0];
      const audienciaIdNum = audienciaVieja.audiencia_id;

      // Obtener la fecha anterior (puede estar en fecha_programada o fecha_hora_programada)
      const fechaAnterior = audienciaVieja.fecha_hora_programada || audienciaVieja.fecha_programada;

      // 2. Insertar registro en historial de reprogramaciones
      await client.query(
        `INSERT INTO audiencias_historial_reprogramaciones (
          audiencia_id,
          fecha_hora_anterior,
          sala_anterior,
          fecha_hora_nueva,
          sala_nueva,
          motivo_reprogramacion,
          tipo_cambio,
          modificado_por_secretario_id,
          modificado_por_rol,
          fecha_modificacion,
          ip_modificacion,
          estado_anterior,
          estado_nuevo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12)`,
        [
          audienciaIdNum,
          fechaAnterior,
          audienciaVieja.sala,
          nuevaFecha,
          audienciaVieja.sala, // Mantiene la misma sala
          motivo,
          "REPROGRAMACION",
          secretarioId,
          "SECRETARIO",
          ip || null,
          audienciaVieja.estado,
          "REPROGRAMADA",
        ]
      );

      // 3. Actualizar la audiencia con la nueva fecha y estado
      const result = await client.query(
        `UPDATE audiencias 
         SET fecha_programada = $1::timestamp,
             fecha_hora_programada = $1::timestamptz,
             estado = 'REPROGRAMADA',
             observaciones = COALESCE(observaciones, '') || E'\n[REPROGRAMADA ' || NOW()::DATE || ']: ' || $2,
             fecha_actualizacion = NOW()
         WHERE audiencia_id = $3
         RETURNING *`,
        [nuevaFecha.toISOString(), motivo, parseInt(id)]
      );

      await client.query("COMMIT");

      // 4. Notificar al juez sobre la reprogramación
      try {
        const causaResult = await client.query(
          `SELECT c.causa_id, c.numero_proceso, c.juez_asignado_id 
           FROM causas c
           JOIN audiencias a ON a.causa_id = c.causa_id
           WHERE a.audiencia_id = $1`,
          [parseInt(id)]
        );

        if (causaResult.rows[0]) {
          const causa = causaResult.rows[0];
          const fechaAnteriorNotif = audienciaVieja.fecha_hora_programada || audienciaVieja.fecha_programada;
          
          await notificacionesService.notificarAudienciaReprogramada(
            causa.juez_asignado_id,
            audienciaIdNum,
            causa.causa_id,
            causa.numero_proceso,
            new Date(fechaAnteriorNotif),
            nuevaFecha,
            motivo,
            secretarioId,
            ip
          );
        }
      } catch (notifError) {
        // No fallar la reprogramación si la notificación falla
        console.error("Error al crear notificación de reprogramación:", notifError);
      }

      return result.rows[0] ? this.mapearAudiencia(result.rows[0]) : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el historial de reprogramaciones de una audiencia
   * HU-JZ-002: Para que el juez sepa si le movieron la agenda
   */
  async getHistorialReprogramaciones(audienciaId: string): Promise<HistorialReprogramacion[]> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT h.* 
         FROM audiencias_historial_reprogramaciones h
         WHERE h.audiencia_id = $1
         ORDER BY h.fecha_modificacion DESC`,
        [parseInt(audienciaId)]
      );

      return result.rows.map((row) => ({
        historialId: row.historial_id,
        audienciaId: row.audiencia_id,
        fechaHoraAnterior: row.fecha_hora_anterior,
        salaAnterior: row.sala_anterior,
        fechaHoraNueva: row.fecha_hora_nueva,
        salaNueva: row.sala_nueva,
        motivoReprogramacion: row.motivo_reprogramacion,
        tipoCambio: row.tipo_cambio,
        modificadoPorSecretarioId: row.modificado_por_secretario_id,
        modificadoPorRol: row.modificado_por_rol,
        fechaModificacion: row.fecha_modificacion,
        ipModificacion: row.ip_modificacion,
        estadoAnterior: row.estado_anterior,
        estadoNuevo: row.estado_nuevo,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el historial de reprogramaciones de todas las audiencias de una causa
   * Para mostrar en la línea del tiempo del expediente electrónico
   */
  async getHistorialReprogramacionesByCausa(causaId: string): Promise<HistorialReprogramacion[]> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT h.*, a.tipo as tipo_audiencia
         FROM audiencias_historial_reprogramaciones h
         JOIN audiencias a ON h.audiencia_id = a.audiencia_id
         WHERE a.causa_id = $1
         ORDER BY h.fecha_modificacion DESC`,
        [parseInt(causaId)]
      );

      return result.rows.map((row) => ({
        historialId: row.historial_id,
        audienciaId: row.audiencia_id,
        tipoAudiencia: row.tipo_audiencia,
        fechaHoraAnterior: row.fecha_hora_anterior,
        salaAnterior: row.sala_anterior,
        fechaHoraNueva: row.fecha_hora_nueva,
        salaNueva: row.sala_nueva,
        motivoReprogramacion: row.motivo_reprogramacion,
        tipoCambio: row.tipo_cambio,
        modificadoPorSecretarioId: row.modificado_por_secretario_id,
        modificadoPorRol: row.modificado_por_rol,
        fechaModificacion: row.fecha_modificacion,
        ipModificacion: row.ip_modificacion,
        estadoAnterior: row.estado_anterior,
        estadoNuevo: row.estado_nuevo,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene la agenda del juez con marcas de audiencias modificadas
   * HU-JZ-002: Consulta de agenda con indicadores de reprogramación
   */
  async getAgendaJuez(
    juezId: string,
    fechaDesde?: Date,
    fechaHasta?: Date
  ): Promise<AudienciaConHistorial[]> {
    const client = await casesPool.connect();

    try {
      const params: unknown[] = [juezId];
      let paramIndex = 2;

      let query = `
        SELECT 
          a.*,
          c.numero_proceso,
          c.materia,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM audiencias_historial_reprogramaciones h 
              WHERE h.audiencia_id = a.audiencia_id
            ) THEN true 
            ELSE false 
          END as fue_reprogramada,
          (
            SELECT COUNT(*) FROM audiencias_historial_reprogramaciones h 
            WHERE h.audiencia_id = a.audiencia_id
          ) as total_reprogramaciones
        FROM audiencias a
        LEFT JOIN causas c ON a.causa_id = c.causa_id
        WHERE c.juez_asignado_id = $1
      `;

      if (fechaDesde) {
        query += ` AND a.fecha_programada >= $${paramIndex}`;
        params.push(fechaDesde);
        paramIndex++;
      }

      if (fechaHasta) {
        query += ` AND a.fecha_programada <= $${paramIndex}`;
        params.push(fechaHasta);
        paramIndex++;
      }

      query += ` ORDER BY a.fecha_programada ASC`;

      const result = await client.query(query, params);

      // Obtener historial para cada audiencia
      const audienciasConHistorial: AudienciaConHistorial[] = [];

      for (const row of result.rows) {
        const audiencia = this.mapearAudiencia(row);
        const audienciaIdNum = row.audiencia_id;

        // Obtener historial de cambios
        const historialResult = await client.query(
          `SELECT * FROM audiencias_historial_reprogramaciones 
           WHERE audiencia_id = $1 
           ORDER BY fecha_modificacion DESC`,
          [audienciaIdNum]
        );

        const historialCambios: HistorialReprogramacion[] = historialResult.rows.map((h) => ({
          historialId: h.historial_id,
          audienciaId: h.audiencia_id,
          fechaHoraAnterior: h.fecha_hora_anterior,
          salaAnterior: h.sala_anterior,
          fechaHoraNueva: h.fecha_hora_nueva,
          salaNueva: h.sala_nueva,
          motivoReprogramacion: h.motivo_reprogramacion,
          tipoCambio: h.tipo_cambio,
          modificadoPorSecretarioId: h.modificado_por_secretario_id,
          modificadoPorRol: h.modificado_por_rol,
          fechaModificacion: h.fecha_modificacion,
          ipModificacion: h.ip_modificacion,
          estadoAnterior: h.estado_anterior,
          estadoNuevo: h.estado_nuevo,
        }));

        audienciasConHistorial.push({
          ...audiencia,
          historialCambios,
          fueReprogramada: row.fue_reprogramada || historialCambios.length > 0,
        });
      }

      return audienciasConHistorial;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene audiencias del día para la agenda del juez
   * HU-JZ-002: Con indicadores de reprogramación
   */
  async getAudienciasHoyConHistorial(juezId?: string): Promise<AudienciaConHistorial[]> {
    if (juezId) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      return this.getAgendaJuez(juezId, hoy, manana);
    }

    // Si no hay juezId, retornar audiencias del día sin filtro de juez
    const client = await casesPool.connect();
    try {
      const result = await client.query(`
        SELECT 
          a.*,
          c.numero_proceso,
          c.materia,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM audiencias_historial_reprogramaciones h 
              WHERE h.audiencia_id = a.audiencia_id
            ) THEN true 
            ELSE false 
          END as fue_reprogramada
        FROM audiencias a
        LEFT JOIN causas c ON a.causa_id = c.causa_id
        WHERE DATE(a.fecha_programada) = CURRENT_DATE
        ORDER BY a.fecha_programada ASC
      `);

      return result.rows.map((row) => ({
        ...this.mapearAudiencia(row),
        historialCambios: [],
        fueReprogramada: row.fue_reprogramada,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene audiencias de la semana para la agenda del juez
   * HU-JZ-002: Con indicadores de reprogramación
   */
  async getAudienciasSemanaConHistorial(juezId?: string): Promise<AudienciaConHistorial[]> {
    if (juezId) {
      const hoy = new Date();
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1); // Lunes
      inicioSemana.setHours(0, 0, 0, 0);
      
      const finSemana = new Date(inicioSemana);
      finSemana.setDate(inicioSemana.getDate() + 7);
      
      return this.getAgendaJuez(juezId, inicioSemana, finSemana);
    }

    // Si no hay juezId, retornar audiencias de la semana sin filtro de juez
    const client = await casesPool.connect();
    try {
      const result = await client.query(`
        SELECT 
          a.*,
          c.numero_proceso,
          c.materia,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM audiencias_historial_reprogramaciones h 
              WHERE h.audiencia_id = a.audiencia_id
            ) THEN true 
            ELSE false 
          END as fue_reprogramada
        FROM audiencias a
        LEFT JOIN causas c ON a.causa_id = c.causa_id
        WHERE a.fecha_programada >= DATE_TRUNC('week', CURRENT_DATE)
          AND a.fecha_programada < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
        ORDER BY a.fecha_programada ASC
      `);

      return result.rows.map((row) => ({
        ...this.mapearAudiencia(row),
        historialCambios: [],
        fueReprogramada: row.fue_reprogramada,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene audiencias con cambios recientes (reprogramadas)
   * Para alertar al juez de cambios en su agenda
   */
  async getAudienciasReprogramadasRecientes(
    juezId: string,
    diasAtras: number = 7
  ): Promise<AudienciaConHistorial[]> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT 
          a.*,
          c.numero_proceso,
          c.materia,
          h.fecha_modificacion as ultima_modificacion,
          h.motivo_reprogramacion as ultimo_motivo
        FROM audiencias a
        LEFT JOIN causas c ON a.causa_id = c.causa_id
        INNER JOIN audiencias_historial_reprogramaciones h ON a.audiencia_id = h.audiencia_id
        WHERE c.juez_asignado_id = $1
          AND h.fecha_modificacion >= NOW() - INTERVAL '1 day' * $2
        ORDER BY h.fecha_modificacion DESC`,
        [juezId, diasAtras]
      );

      // Agrupar por audiencia y obtener historial completo
      const audienciasMap = new Map<string, AudienciaConHistorial>();

      for (const row of result.rows) {
        const audienciaId = row.id || row.audiencia_id?.toString();
        if (!audienciasMap.has(audienciaId)) {
          const historialResult = await client.query(
            `SELECT * FROM audiencias_historial_reprogramaciones 
             WHERE audiencia_id = $1 
             ORDER BY fecha_modificacion DESC`,
            [row.audiencia_id]
          );

          audienciasMap.set(audienciaId, {
            ...this.mapearAudiencia(row),
            historialCambios: historialResult.rows.map((h) => ({
              historialId: h.historial_id,
              audienciaId: h.audiencia_id,
              fechaHoraAnterior: h.fecha_hora_anterior,
              salaAnterior: h.sala_anterior,
              fechaHoraNueva: h.fecha_hora_nueva,
              salaNueva: h.sala_nueva,
              motivoReprogramacion: h.motivo_reprogramacion,
              tipoCambio: h.tipo_cambio,
              modificadoPorSecretarioId: h.modificado_por_secretario_id,
              modificadoPorRol: h.modificado_por_rol,
              fechaModificacion: h.fecha_modificacion,
              ipModificacion: h.ip_modificacion,
              estadoAnterior: h.estado_anterior,
              estadoNuevo: h.estado_nuevo,
            })),
            fueReprogramada: true,
          });
        }
      }

      return Array.from(audienciasMap.values());
    } finally {
      client.release();
    }
  }

  /**
   * Mapea fila de BD a tipo Audiencia
   */
  private mapearAudiencia(row: any): Audiencia {
    // fecha_programada es el nombre real en la BD
    const fechaHora = row.fecha_hora || row.fecha_programada || row.fecha_hora_programada;
    return {
      id: row.id || row.audiencia_id?.toString(),
      causa_id: row.causa_id,
      causaId: row.causa_id,
      numeroExpediente: row.numero_proceso,
      materia: row.materia,
      tipo: (row.tipo || row.tipo_audiencia || "").toLowerCase(),
      fecha: fechaHora,
      fecha_hora: fechaHora,
      fechaHora: fechaHora,
      sala: row.sala,
      duracion_minutos: row.duracion_minutos,
      duracionMinutos: row.duracion_minutos,
      modalidad: row.modalidad?.toLowerCase() || "presencial",
      enlace_virtual: row.enlace_virtual || row.enlace_videoconferencia,
      enlaceVirtual: row.enlace_virtual || row.enlace_videoconferencia,
      observaciones: row.observaciones,
      programada_por_id: row.programada_por_id || row.programado_por_id || row.creado_por_secretario_id,
      programadaPorId: row.programada_por_id || row.programado_por_id || row.creado_por_secretario_id,
      estado: row.estado?.toLowerCase() || "programada",
      fecha_creacion: row.fecha_creacion,
      fechaCreacion: row.fecha_creacion,
    };
  }

  /**
   * Obtiene una audiencia por ID con su historial
   */
  async getAudienciaById(id: string): Promise<AudienciaConHistorial | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT 
          a.*,
          c.numero_proceso,
          c.materia,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM audiencias_historial_reprogramaciones h 
              WHERE h.audiencia_id = a.audiencia_id
            ) THEN true 
            ELSE false 
          END as fue_reprogramada
        FROM audiencias a
        LEFT JOIN causas c ON a.causa_id = c.causa_id
        WHERE a.audiencia_id = $1`,
        [parseInt(id)]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const historial = await this.getHistorialReprogramaciones(id);

      return {
        ...this.mapearAudiencia(row),
        historialCambios: historial,
        fueReprogramada: row.fue_reprogramada || historial.length > 0,
      };
    } finally {
      client.release();
    }
  }
}

export const audienciasService = new AudienciasService();
export default audienciasService;
