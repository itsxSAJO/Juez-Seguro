// ============================================================================
// SERVICIO DE PLAZOS PROCESALES (HU-SJ-004)
// Motor de cálculo de días hábiles y control de vencimientos
// ============================================================================

import { casesPool } from "../db/connection.js";
import type {
  PlazoProcesal,
  CrearPlazoInput,
  TipoActuacion,
  DiaInhabil,
  CalculoVencimiento,
  AlertaPlazo,
  EstadoPlazo,
  TokenPayload,
} from "../types/index.js";
import { auditService } from "./audit.service.js";

class PlazosService {
  // ============================================================================
  // MOTOR DE CÁLCULO DE DÍAS HÁBILES
  // ============================================================================

  /**
   * Obtener todos los días inhábiles activos del sistema
   * @returns Lista de fechas inhábiles
   */
  async obtenerDiasInhabiles(): Promise<DiaInhabil[]> {
    const query = `
      SELECT 
        dia_id,
        fecha,
        descripcion,
        tipo
      FROM dias_inhabiles
      ORDER BY fecha
    `;

    const result = await casesPool.query(query);
    return result.rows.map((row) => ({
      diaId: row.dia_id,
      fecha: row.fecha,
      descripcion: row.descripcion,
      tipo: row.tipo,
      esRecurrente: false, // No existe en la BD, default false
      activo: true, // No existe en la BD, todos están activos
    }));
  }

  /**
   * Verificar si una fecha es día hábil
   * @param fecha Fecha a verificar
   * @param diasInhabiles Lista de días inhábiles (opcional, se carga si no se proporciona)
   * @returns true si es hábil, false si no
   */
  async esDiaHabil(
    fecha: Date,
    diasInhabiles?: DiaInhabil[]
  ): Promise<{ esHabil: boolean; motivo?: string }> {
    const diaSemana = fecha.getDay(); // 0 = Domingo, 6 = Sábado

    // Verificar fin de semana
    if (diaSemana === 0) {
      return { esHabil: false, motivo: "Domingo" };
    }
    if (diaSemana === 6) {
      return { esHabil: false, motivo: "Sábado" };
    }

    // Cargar días inhábiles si no se proporcionaron
    const feriados = diasInhabiles || (await this.obtenerDiasInhabiles());

    // Verificar si es feriado
    const fechaStr = fecha.toISOString().split("T")[0];
    for (const feriado of feriados) {
      const feriadoStr = new Date(feriado.fecha).toISOString().split("T")[0];

      // Feriado exacto
      if (fechaStr === feriadoStr) {
        return { esHabil: false, motivo: feriado.descripcion };
      }

      // Feriado recurrente (mismo día y mes, cualquier año)
      if (feriado.esRecurrente) {
        const fechaCheck = new Date(fecha);
        const feriadoCheck = new Date(feriado.fecha);
        if (
          fechaCheck.getMonth() === feriadoCheck.getMonth() &&
          fechaCheck.getDate() === feriadoCheck.getDate()
        ) {
          return { esHabil: false, motivo: `${feriado.descripcion} (anual)` };
        }
      }
    }

    return { esHabil: true };
  }

  /**
   * Calcular fecha de vencimiento sumando días hábiles
   * CRÍTICO: Usa hora del servidor, NO del cliente
   * @param fechaInicio Fecha de inicio del plazo
   * @param diasHabiles Número de días hábiles a sumar
   * @returns Cálculo detallado con fecha de vencimiento
   */
  async calcularFechaVencimiento(
    fechaInicio: Date,
    diasHabiles: number
  ): Promise<CalculoVencimiento> {
    // Usar hora del servidor
    const inicio = new Date(fechaInicio);
    const diasInhabiles = await this.obtenerDiasInhabiles();

    let fechaActual = new Date(inicio);
    let diasContados = 0;
    let diasSaltados = 0;
    const detalleDias: CalculoVencimiento["detalleDias"] = [];

    // El primer día de notificación NO cuenta (se empieza a contar desde el día siguiente)
    fechaActual.setDate(fechaActual.getDate() + 1);

    while (diasContados < diasHabiles) {
      const verificacion = await this.esDiaHabil(fechaActual, diasInhabiles);

      detalleDias.push({
        fecha: new Date(fechaActual),
        esHabil: verificacion.esHabil,
        motivo: verificacion.motivo,
      });

      if (verificacion.esHabil) {
        diasContados++;
      } else {
        diasSaltados++;
      }

      // Solo avanzar si no hemos llegado al límite
      if (diasContados < diasHabiles) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
    }

    return {
      fechaInicio: inicio,
      diasHabiles,
      fechaVencimiento: new Date(fechaActual),
      diasSaltados,
      detalleDias,
    };
  }

  // ============================================================================
  // CATÁLOGO DE TIPOS DE ACTUACIÓN
  // ============================================================================

  /**
   * Obtener catálogo de tipos de actuación
   * @param materia Filtrar por materia (opcional)
   * @returns Lista de tipos de actuación
   */
  async obtenerCatalogoActuaciones(materia?: string): Promise<TipoActuacion[]> {
    let query = `
      SELECT 
        tipo_id,
        codigo,
        nombre,
        descripcion,
        plazo_dias_habiles,
        parte_responsable_default,
        materia,
        activo
      FROM catalogo_tipos_actuacion
      WHERE activo = true
    `;

    const params: string[] = [];
    if (materia) {
      params.push(materia);
      query += ` AND (materia = $1 OR materia IS NULL)`;
    }

    query += ` ORDER BY nombre`;

    const result = await casesPool.query(query, params);
    return result.rows.map((row) => ({
      tipoId: row.tipo_id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      plazoDiasHabiles: row.plazo_dias_habiles,
      parteResponsableDefault: row.parte_responsable_default,
      materia: row.materia,
      activo: row.activo,
    }));
  }

  /**
   * Obtener tipo de actuación por código
   * @param codigo Código del tipo de actuación
   * @returns Tipo de actuación o null
   */
  async obtenerTipoActuacionPorCodigo(
    codigo: string
  ): Promise<TipoActuacion | null> {
    const query = `
      SELECT 
        tipo_id,
        codigo,
        nombre,
        descripcion,
        plazo_dias_habiles,
        parte_responsable_default,
        materia,
        activo
      FROM catalogo_tipos_actuacion
      WHERE codigo = $1 AND activo = true
    `;

    const result = await casesPool.query(query, [codigo]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      tipoId: row.tipo_id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      plazoDiasHabiles: row.plazo_dias_habiles,
      parteResponsableDefault: row.parte_responsable_default,
      materia: row.materia,
      activo: row.activo,
    };
  }

  // ============================================================================
  // CRUD DE PLAZOS PROCESALES
  // ============================================================================

  /**
   * Crear un nuevo plazo procesal
   * CRÍTICO: La fecha de inicio usa hora del servidor
   * @param input Datos del plazo
   * @param usuario Usuario que crea el plazo
   * @param ipOrigen IP de origen
   */
  async crearPlazo(
    input: CrearPlazoInput,
    usuario: TokenPayload,
    ipOrigen: string
  ): Promise<PlazoProcesal> {
    // Usar hora del servidor para fecha de inicio
    const fechaInicio = input.fechaInicio || new Date();

    // Calcular fecha de vencimiento
    const calculo = await this.calcularFechaVencimiento(
      fechaInicio,
      input.diasPlazo
    );

    const query = `
      INSERT INTO plazos_procesales (
        causa_id,
        notificacion_id,
        decision_id,
        tipo_plazo,
        descripcion,
        parte_responsable,
        fecha_inicio,
        dias_plazo,
        fecha_vencimiento,
        estado,
        creado_por_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'VIGENTE', $10)
      RETURNING *
    `;

    const result = await casesPool.query(query, [
      input.causaId,
      input.notificacionId || null,
      input.decisionId || null,
      input.tipoPlazo,
      input.descripcion,
      input.parteResponsable || null,
      fechaInicio,
      input.diasPlazo,
      calculo.fechaVencimiento,
      usuario.funcionarioId,
    ]);

    const row = result.rows[0];

    // Registrar auditoría
    await auditService.log({
      tipoEvento: "CREACION_PLAZO",
      usuarioId: usuario.funcionarioId,
      usuarioCorreo: usuario.correo,
      moduloAfectado: "CASOS",
      descripcion: `Plazo creado: ${input.tipoPlazo} - Vence: ${calculo.fechaVencimiento.toISOString().split("T")[0]}`,
      datosAfectados: {
        plazoId: row.plazo_id,
        causaId: input.causaId,
        diasHabiles: input.diasPlazo,
        fechaVencimiento: calculo.fechaVencimiento,
      },
      ipOrigen,
      userAgent: "sistema",
    });

    return this.mapearPlazo(row);
  }

  /**
   * Crear plazo automático desde tipo de actuación
   * @param causaId ID de la causa
   * @param notificacionId ID de la notificación origen
   * @param codigoActuacion Código del catálogo
   * @param usuario Usuario que crea
   * @param ipOrigen IP origen
   */
  async crearPlazoDesdeActuacion(
    causaId: number,
    notificacionId: number,
    codigoActuacion: string,
    usuario: TokenPayload,
    ipOrigen: string
  ): Promise<PlazoProcesal | null> {
    const tipoActuacion =
      await this.obtenerTipoActuacionPorCodigo(codigoActuacion);
    if (!tipoActuacion) return null;

    // Convertir código a minúsculas para cumplir con constraint de la BD
    const tipoPlazoLower = tipoActuacion.codigo.toLowerCase();

    return this.crearPlazo(
      {
        causaId,
        notificacionId,
        tipoPlazo: tipoPlazoLower,
        descripcion: tipoActuacion.nombre,
        parteResponsable:
          (tipoActuacion.parteResponsableDefault as CrearPlazoInput["parteResponsable"]) ||
          undefined,
        diasPlazo: tipoActuacion.plazoDiasHabiles,
      },
      usuario,
      ipOrigen
    );
  }

  /**
   * Obtener plazo por ID
   */
  async obtenerPlazoPorId(plazoId: number): Promise<PlazoProcesal | null> {
    const query = `
      SELECT * FROM plazos_procesales WHERE plazo_id = $1
    `;

    const result = await casesPool.query(query, [plazoId]);
    if (result.rows.length === 0) return null;

    return this.mapearPlazo(result.rows[0]);
  }

  /**
   * Listar plazos de una causa
   */
  async listarPlazosPorCausa(causaId: number): Promise<PlazoProcesal[]> {
    const query = `
      SELECT * FROM plazos_procesales 
      WHERE causa_id = $1
      ORDER BY fecha_vencimiento ASC
    `;

    const result = await casesPool.query(query, [causaId]);
    return result.rows.map((row) => this.mapearPlazo(row));
  }

  /**
   * Listar plazos vigentes próximos a vencer
   * @param diasUmbral Días de anticipación para considerar "próximo"
   */
  async listarPlazosProximosVencer(diasUmbral: number = 3): Promise<AlertaPlazo[]> {
    const query = `
      SELECT 
        p.plazo_id,
        p.causa_id,
        c.numero_proceso,
        p.tipo_plazo,
        p.descripcion,
        p.fecha_vencimiento,
        p.parte_responsable,
        c.juez_asignado_id,
        c.secretario_creador_id,
        EXTRACT(DAY FROM (p.fecha_vencimiento - NOW())) as dias_restantes
      FROM plazos_procesales p
      JOIN causas c ON p.causa_id = c.causa_id
      WHERE p.estado = 'VIGENTE'
        AND p.suspendido = false
        AND p.fecha_vencimiento <= NOW() + INTERVAL '1 day' * $1
      ORDER BY p.fecha_vencimiento ASC
    `;

    const result = await casesPool.query(query, [diasUmbral]);

    return result.rows.map((row) => {
      const diasRestantes = Math.floor(parseFloat(row.dias_restantes) || 0);
      let nivelAlerta: AlertaPlazo["nivelAlerta"];

      if (diasRestantes <= 0) {
        nivelAlerta = "CRITICO";
      } else if (diasRestantes <= 1) {
        nivelAlerta = "URGENTE";
      } else {
        nivelAlerta = "INFORMATIVO";
      }

      return {
        plazoId: row.plazo_id,
        causaId: row.causa_id,
        numeroProceso: row.numero_proceso,
        tipoPlazo: row.tipo_plazo,
        descripcion: row.descripcion,
        fechaVencimiento: row.fecha_vencimiento,
        diasRestantes,
        parteResponsable: row.parte_responsable,
        juezId: row.juez_asignado_id,
        secretarioId: row.secretario_creador_id,
        nivelAlerta,
      };
    });
  }

  /**
   * Actualizar estado de un plazo
   */
  async actualizarEstadoPlazo(
    plazoId: number,
    nuevoEstado: EstadoPlazo,
    usuario: TokenPayload,
    ipOrigen: string,
    datos?: {
      fechaCumplimiento?: Date;
      documentoCumplimientoId?: string;
      motivoSuspension?: string;
    }
  ): Promise<PlazoProcesal | null> {
    const plazoActual = await this.obtenerPlazoPorId(plazoId);
    if (!plazoActual) return null;

    let query = `
      UPDATE plazos_procesales SET
        estado = $1,
        fecha_actualizacion = NOW()
    `;
    const params: unknown[] = [nuevoEstado];
    let paramIndex = 2;

    if (nuevoEstado === "CUMPLIDO" && datos?.fechaCumplimiento) {
      query += `, fecha_cumplimiento = $${paramIndex}`;
      params.push(datos.fechaCumplimiento);
      paramIndex++;
    }

    if (datos?.documentoCumplimientoId) {
      query += `, documento_cumplimiento_id = $${paramIndex}`;
      params.push(datos.documentoCumplimientoId);
      paramIndex++;
    }

    if (nuevoEstado === "SUSPENDIDO") {
      query += `, suspendido = true, fecha_suspension = NOW()`;
      if (datos?.motivoSuspension) {
        query += `, motivo_suspension = $${paramIndex}`;
        params.push(datos.motivoSuspension);
        paramIndex++;
      }
    }

    query += ` WHERE plazo_id = $${paramIndex} RETURNING *`;
    params.push(plazoId);

    const result = await casesPool.query(query, params);

    // Auditoría
    await auditService.log({
      tipoEvento: "CAMBIO_ESTADO_PLAZO",
      usuarioId: usuario.funcionarioId,
      usuarioCorreo: usuario.correo,
      moduloAfectado: "CASOS",
      descripcion: `Plazo ${plazoId}: ${plazoActual.estado} → ${nuevoEstado}`,
      datosAfectados: {
        plazoId,
        estadoAnterior: plazoActual.estado,
        estadoNuevo: nuevoEstado,
      },
      ipOrigen,
      userAgent: "sistema",
    });

    return this.mapearPlazo(result.rows[0]);
  }

  /**
   * Marcar alerta como enviada
   */
  async marcarAlertaEnviada(
    plazoId: number,
    tipoAlerta: "3_dias" | "1_dia" | "vencido"
  ): Promise<void> {
    let campo: string;
    switch (tipoAlerta) {
      case "3_dias":
        campo = "alerta_enviada_3_dias";
        break;
      case "1_dia":
        campo = "alerta_enviada_1_dia";
        break;
      case "vencido":
        campo = "alerta_enviada_vencido";
        break;
    }

    await casesPool.query(
      `UPDATE plazos_procesales SET ${campo} = true WHERE plazo_id = $1`,
      [plazoId]
    );
  }

  /**
   * Obtener plazos pendientes de alerta
   * Para el job de monitoreo
   */
  async obtenerPlazosPendientesAlerta(): Promise<
    Array<AlertaPlazo & { alertas3Dias: boolean; alerta1Dia: boolean; alertaVencido: boolean }>
  > {
    const query = `
      SELECT 
        p.plazo_id,
        p.causa_id,
        c.numero_proceso,
        p.tipo_plazo,
        p.descripcion,
        p.fecha_vencimiento,
        p.parte_responsable,
        c.juez_asignado_id,
        c.secretario_creador_id,
        p.alerta_enviada_3_dias,
        p.alerta_enviada_1_dia,
        p.alerta_enviada_vencido,
        EXTRACT(EPOCH FROM (p.fecha_vencimiento - NOW())) / 86400 as dias_restantes_decimal
      FROM plazos_procesales p
      JOIN causas c ON p.causa_id = c.causa_id
      WHERE p.estado = 'VIGENTE'
        AND p.suspendido = false
        AND (
          -- Necesita alerta de 3 días
          (p.fecha_vencimiento <= NOW() + INTERVAL '3 days' AND NOT p.alerta_enviada_3_dias)
          OR
          -- Necesita alerta de 1 día
          (p.fecha_vencimiento <= NOW() + INTERVAL '1 day' AND NOT p.alerta_enviada_1_dia)
          OR
          -- Necesita alerta de vencido
          (p.fecha_vencimiento <= NOW() AND NOT p.alerta_enviada_vencido)
        )
      ORDER BY p.fecha_vencimiento ASC
    `;

    const result = await casesPool.query(query);

    return result.rows.map((row) => {
      const diasRestantes = Math.floor(parseFloat(row.dias_restantes_decimal) || 0);
      let nivelAlerta: AlertaPlazo["nivelAlerta"];

      if (diasRestantes <= 0) {
        nivelAlerta = "CRITICO";
      } else if (diasRestantes <= 1) {
        nivelAlerta = "URGENTE";
      } else {
        nivelAlerta = "INFORMATIVO";
      }

      return {
        plazoId: row.plazo_id,
        causaId: row.causa_id,
        numeroProceso: row.numero_proceso,
        tipoPlazo: row.tipo_plazo,
        descripcion: row.descripcion,
        fechaVencimiento: row.fecha_vencimiento,
        diasRestantes,
        parteResponsable: row.parte_responsable,
        juezId: row.juez_asignado_id,
        secretarioId: row.secretario_creador_id,
        nivelAlerta,
        alertas3Dias: row.alerta_enviada_3_dias,
        alerta1Dia: row.alerta_enviada_1_dia,
        alertaVencido: row.alerta_enviada_vencido,
      };
    });
  }

  // ============================================================================
  // HELPERS PRIVADOS
  // ============================================================================

  private mapearPlazo(row: Record<string, unknown>): PlazoProcesal {
    return {
      plazoId: row.plazo_id as number,
      causaId: row.causa_id as number,
      notificacionId: row.notificacion_id as number | undefined,
      decisionId: row.decision_id as number | undefined,
      tipoPlazo: row.tipo_plazo as string,
      descripcion: row.descripcion as string,
      parteResponsable: row.parte_responsable as PlazoProcesal["parteResponsable"],
      fechaInicio: row.fecha_inicio as Date,
      diasPlazo: row.dias_plazo as number,
      fechaVencimiento: row.fecha_vencimiento as Date,
      estado: row.estado as EstadoPlazo,
      alertaEnviada3Dias: row.alerta_enviada_3_dias as boolean,
      alertaEnviada1Dia: row.alerta_enviada_1_dia as boolean,
      alertaEnviadaVencido: row.alerta_enviada_vencido as boolean,
      suspendido: row.suspendido as boolean,
      fechaSuspension: row.fecha_suspension as Date | undefined,
      motivoSuspension: row.motivo_suspension as string | undefined,
      fechaReanudacion: row.fecha_reanudacion as Date | undefined,
      fechaCumplimiento: row.fecha_cumplimiento as Date | undefined,
      documentoCumplimientoId: row.documento_cumplimiento_id as string | undefined,
      fechaCreacion: row.fecha_creacion as Date,
      fechaActualizacion: row.fecha_actualizacion as Date | undefined,
      creadoPorId: row.creado_por_id as number,
    };
  }
}

export const plazosService = new PlazosService();
