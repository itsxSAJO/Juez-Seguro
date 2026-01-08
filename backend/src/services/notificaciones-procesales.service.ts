// ============================================================================
// SERVICIO DE NOTIFICACIONES PROCESALES (HU-SJ-004)
// Registro de notificaciones vinculadas a decisiones judiciales
// ============================================================================

import { casesPool } from "../db/connection.js";
import type {
  NotificacionProcesal,
  CrearNotificacionInput,
  EstadoNotificacionProcesal,
  TokenPayload,
} from "../types/index.js";
import { auditService } from "./audit.service.js";
import { plazosService } from "./plazos.service.js";

class NotificacionesProcesalesService {
  // ============================================================================
  // REGISTRO DE NOTIFICACIONES
  // ============================================================================

  /**
   * Crear una nueva notificación procesal
   * CRÍTICO: Usa hora del servidor, vinculada obligatoriamente a una decisión
   * @param input Datos de la notificación
   * @param usuario Usuario que crea
   * @param ipOrigen IP de origen
   */
  async crearNotificacion(
    input: CrearNotificacionInput,
    usuario: TokenPayload,
    ipOrigen: string
  ): Promise<NotificacionProcesal> {
    // 1. Validar que la decisión existe y está FIRMADA
    const decisionQuery = `
      SELECT decision_id, estado, causa_id 
      FROM decisiones_judiciales 
      WHERE decision_id = $1
    `;
    const decisionResult = await casesPool.query(decisionQuery, [input.decisionId]);

    if (decisionResult.rows.length === 0) {
      throw new Error("La decisión judicial especificada no existe");
    }

    const decision = decisionResult.rows[0];
    if (decision.estado !== "FIRMADA") {
      throw new Error(
        "Solo se pueden crear notificaciones para decisiones FIRMADAS. " +
        `Estado actual: ${decision.estado}`
      );
    }

    // 2. Validar que la causa coincide
    if (decision.causa_id !== input.causaId) {
      throw new Error(
        "La causa especificada no coincide con la causa de la decisión"
      );
    }

    // 3. Verificar autorización del usuario
    const causaQuery = `
      SELECT juez_asignado_id, secretario_creador_id 
      FROM causas 
      WHERE causa_id = $1
    `;
    const causaResult = await casesPool.query(causaQuery, [input.causaId]);

    if (causaResult.rows.length === 0) {
      throw new Error("La causa especificada no existe");
    }

    const causa = causaResult.rows[0];
    const esJuez = causa.juez_asignado_id === usuario.funcionarioId;
    const esSecretario = causa.secretario_creador_id === usuario.funcionarioId;

    if (!esJuez && !esSecretario && usuario.rol !== "ADMIN_CJ") {
      await auditService.log({
        tipoEvento: "ACCESO_DENEGADO",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "NOTIFICACIONES",
        descripcion: `[ALTA] Intento de crear notificación sin autorización`,
        datosAfectados: { causaId: input.causaId, decisionId: input.decisionId },
        ipOrigen,
        userAgent: "sistema",
      });
      throw new Error("No tiene autorización para crear notificaciones en esta causa");
    }

    // 4. Insertar notificación (usa hora del servidor con NOW())
    const insertQuery = `
      INSERT INTO notificaciones_procesales (
        causa_id,
        decision_id,
        destinatario_tipo,
        destinatario_nombre,
        destinatario_identificacion,
        destinatario_correo,
        destinatario_direccion,
        destinatario_casillero,
        tipo_notificacion,
        asunto,
        contenido,
        medio_notificacion,
        estado,
        creado_por_id,
        ip_origen
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDIENTE', $13, $14)
      RETURNING *
    `;

    const result = await casesPool.query(insertQuery, [
      input.causaId,
      input.decisionId,
      input.destinatarioTipo,
      input.destinatarioNombre,
      input.destinatarioIdentificacion || null,
      input.destinatarioCorreo || null,
      input.destinatarioDireccion || null,
      input.destinatarioCasillero || null,
      input.tipoNotificacion,
      input.asunto,
      input.contenido || null,
      input.medioNotificacion,
      usuario.funcionarioId,
      ipOrigen,
    ]);

    const notificacion = this.mapearNotificacion(result.rows[0]);

    // 5. Registrar auditoría
    await auditService.log({
      tipoEvento: "CREACION_NOTIFICACION",
      usuarioId: usuario.funcionarioId,
      usuarioCorreo: usuario.correo,
      moduloAfectado: "NOTIFICACIONES",
      descripcion: `Notificación creada: ${input.tipoNotificacion} a ${input.destinatarioNombre}`,
      datosAfectados: {
        notificacionId: notificacion.notificacionId,
        causaId: input.causaId,
        decisionId: input.decisionId,
        destinatario: input.destinatarioNombre,
      },
      ipOrigen,
      userAgent: "sistema",
    });

    // 6. Si se especificó tipo de actuación, crear plazo automático
    if (input.tipoActuacionCodigo) {
      await plazosService.crearPlazoDesdeActuacion(
        input.causaId,
        notificacion.notificacionId,
        input.tipoActuacionCodigo,
        usuario,
        ipOrigen
      );
    }

    return notificacion;
  }

  /**
   * Enviar notificación (cambiar estado a ENVIADA)
   * CRÍTICO: Registra timestamp del servidor como fecha de envío
   */
  async enviarNotificacion(
    notificacionId: number,
    usuario: TokenPayload,
    ipOrigen: string
  ): Promise<NotificacionProcesal> {
    // 1. Obtener notificación actual
    const notificacion = await this.obtenerNotificacionPorId(notificacionId);
    if (!notificacion) {
      throw new Error("La notificación no existe");
    }

    if (notificacion.estado !== "PENDIENTE") {
      throw new Error(
        `No se puede enviar una notificación en estado ${notificacion.estado}`
      );
    }

    // 2. Actualizar estado con timestamp del servidor
    const updateQuery = `
      UPDATE notificaciones_procesales SET
        estado = 'ENVIADA',
        fecha_envio = NOW(),
        enviado_por_id = $1
      WHERE notificacion_id = $2
      RETURNING *
    `;

    const result = await casesPool.query(updateQuery, [
      usuario.funcionarioId,
      notificacionId,
    ]);

    // 3. Auditoría
    await auditService.log({
      tipoEvento: "ENVIO_NOTIFICACION",
      usuarioId: usuario.funcionarioId,
      usuarioCorreo: usuario.correo,
      moduloAfectado: "NOTIFICACIONES",
      descripcion: `Notificación ${notificacionId} enviada a ${notificacion.destinatarioNombre}`,
      datosAfectados: {
        notificacionId,
        causaId: notificacion.causaId,
        medio: notificacion.medioNotificacion,
      },
      ipOrigen,
      userAgent: "sistema",
    });

    return this.mapearNotificacion(result.rows[0]);
  }

  /**
   * Confirmar entrega de notificación
   */
  async confirmarEntrega(
    notificacionId: number,
    evidencia: string,
    usuario: TokenPayload,
    ipOrigen: string
  ): Promise<NotificacionProcesal> {
    const notificacion = await this.obtenerNotificacionPorId(notificacionId);
    if (!notificacion) {
      throw new Error("La notificación no existe");
    }

    if (notificacion.estado !== "ENVIADA") {
      throw new Error(
        `No se puede confirmar entrega de notificación en estado ${notificacion.estado}`
      );
    }

    const updateQuery = `
      UPDATE notificaciones_procesales SET
        estado = 'ENTREGADA',
        fecha_entrega = NOW(),
        evidencia_entrega = $1
      WHERE notificacion_id = $2
      RETURNING *
    `;

    const result = await casesPool.query(updateQuery, [evidencia, notificacionId]);

    await auditService.log({
      tipoEvento: "ENTREGA_NOTIFICACION",
      usuarioId: usuario.funcionarioId,
      usuarioCorreo: usuario.correo,
      moduloAfectado: "NOTIFICACIONES",
      descripcion: `Notificación ${notificacionId} entregada`,
      datosAfectados: { notificacionId, evidencia },
      ipOrigen,
      userAgent: "sistema",
    });

    return this.mapearNotificacion(result.rows[0]);
  }

  /**
   * Registrar fallo en envío
   */
  async registrarFallo(
    notificacionId: number,
    error: string,
    usuario: TokenPayload,
    ipOrigen: string
  ): Promise<NotificacionProcesal> {
    const updateQuery = `
      UPDATE notificaciones_procesales SET
        estado = 'FALLIDA',
        error_envio = $1
      WHERE notificacion_id = $2
      RETURNING *
    `;

    const result = await casesPool.query(updateQuery, [error, notificacionId]);

    await auditService.log({
      tipoEvento: "FALLO_NOTIFICACION",
      usuarioId: usuario.funcionarioId,
      usuarioCorreo: usuario.correo,
      moduloAfectado: "NOTIFICACIONES",
      descripcion: `Notificación ${notificacionId} falló: ${error}`,
      datosAfectados: { notificacionId, error },
      ipOrigen,
      userAgent: "sistema",
    });

    return this.mapearNotificacion(result.rows[0]);
  }

  // ============================================================================
  // CONSULTAS
  // ============================================================================

  /**
   * Obtener notificación por ID
   */
  async obtenerNotificacionPorId(
    notificacionId: number
  ): Promise<NotificacionProcesal | null> {
    const query = `
      SELECT * FROM notificaciones_procesales WHERE notificacion_id = $1
    `;

    const result = await casesPool.query(query, [notificacionId]);
    if (result.rows.length === 0) return null;

    return this.mapearNotificacion(result.rows[0]);
  }

  /**
   * Listar notificaciones de una causa
   */
  async listarNotificacionesPorCausa(
    causaId: number,
    filtros?: {
      estado?: EstadoNotificacionProcesal;
      destinatarioTipo?: string;
    }
  ): Promise<NotificacionProcesal[]> {
    let query = `
      SELECT * FROM notificaciones_procesales 
      WHERE causa_id = $1
    `;
    const params: unknown[] = [causaId];
    let paramIndex = 2;

    if (filtros?.estado) {
      query += ` AND estado = $${paramIndex}`;
      params.push(filtros.estado);
      paramIndex++;
    }

    if (filtros?.destinatarioTipo) {
      query += ` AND destinatario_tipo = $${paramIndex}`;
      params.push(filtros.destinatarioTipo);
    }

    query += ` ORDER BY fecha_creacion DESC`;

    const result = await casesPool.query(query, params);
    return result.rows.map((row) => this.mapearNotificacion(row));
  }

  /**
   * Listar notificaciones de una decisión
   */
  async listarNotificacionesPorDecision(
    decisionId: number
  ): Promise<NotificacionProcesal[]> {
    const query = `
      SELECT * FROM notificaciones_procesales 
      WHERE decision_id = $1
      ORDER BY fecha_creacion DESC
    `;

    const result = await casesPool.query(query, [decisionId]);
    return result.rows.map((row) => this.mapearNotificacion(row));
  }

  /**
   * Listar notificaciones pendientes (para proceso de envío)
   */
  async listarNotificacionesPendientes(): Promise<NotificacionProcesal[]> {
    const query = `
      SELECT * FROM notificaciones_procesales 
      WHERE estado = 'PENDIENTE'
      ORDER BY fecha_creacion ASC
    `;

    const result = await casesPool.query(query);
    return result.rows.map((row) => this.mapearNotificacion(row));
  }

  /**
   * Obtener estadísticas de notificaciones por causa
   */
  async obtenerEstadisticasPorCausa(causaId: number): Promise<{
    total: number;
    pendientes: number;
    enviadas: number;
    entregadas: number;
    fallidas: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'PENDIENTE') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'ENVIADA') as enviadas,
        COUNT(*) FILTER (WHERE estado = 'ENTREGADA') as entregadas,
        COUNT(*) FILTER (WHERE estado = 'FALLIDA') as fallidas
      FROM notificaciones_procesales
      WHERE causa_id = $1
    `;

    const result = await casesPool.query(query, [causaId]);
    const row = result.rows[0];

    return {
      total: parseInt(row.total) || 0,
      pendientes: parseInt(row.pendientes) || 0,
      enviadas: parseInt(row.enviadas) || 0,
      entregadas: parseInt(row.entregadas) || 0,
      fallidas: parseInt(row.fallidas) || 0,
    };
  }

  // ============================================================================
  // HELPERS PRIVADOS
  // ============================================================================

  private mapearNotificacion(row: Record<string, unknown>): NotificacionProcesal {
    return {
      notificacionId: row.notificacion_id as number,
      causaId: row.causa_id as number,
      decisionId: row.decision_id as number | undefined,
      documentoId: row.documento_id as string | undefined,
      destinatarioTipo: row.destinatario_tipo as NotificacionProcesal["destinatarioTipo"],
      destinatarioNombre: row.destinatario_nombre as string,
      destinatarioIdentificacion: row.destinatario_identificacion as string | undefined,
      destinatarioCorreo: row.destinatario_correo as string | undefined,
      destinatarioDireccion: row.destinatario_direccion as string | undefined,
      destinatarioCasillero: row.destinatario_casillero as string | undefined,
      tipoNotificacion: row.tipo_notificacion as NotificacionProcesal["tipoNotificacion"],
      asunto: row.asunto as string,
      contenido: row.contenido as string | undefined,
      medioNotificacion: row.medio_notificacion as NotificacionProcesal["medioNotificacion"],
      estado: row.estado as EstadoNotificacionProcesal,
      fechaCreacion: row.fecha_creacion as Date,
      fechaEnvio: row.fecha_envio as Date | undefined,
      fechaEntrega: row.fecha_entrega as Date | undefined,
      evidenciaEntrega: row.evidencia_entrega as string | undefined,
      errorEnvio: row.error_envio as string | undefined,
      creadoPorId: row.creado_por_id as number,
      enviadoPorId: row.enviado_por_id as number | undefined,
      ipOrigen: row.ip_origen as string | undefined,
    };
  }
}

export const notificacionesProcesalesService = new NotificacionesProcesalesService();
