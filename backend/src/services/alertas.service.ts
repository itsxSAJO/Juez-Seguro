// ============================================================================
// SERVICIO DE ALERTAS DE PLAZOS (HU-SJ-004)
// Proceso de monitoreo y disparo de alertas a jueces y secretarios
// ============================================================================

import { casesPool } from "../db/connection.js";
import type { AlertaPlazo, TokenPayload } from "../types/index.js";
import { auditService } from "./audit.service.js";
import { plazosService } from "./plazos.service.js";
import { loggers } from "./logger.service.js";

const log = loggers.system;

// Tipo para notificación interna del sistema
interface NotificacionInterna {
  usuarioId: number;
  titulo: string;
  mensaje: string;
  tipo: "alerta" | "info" | "urgente";
  leida: boolean;
  enlaceCausa?: number;
}

class AlertasService {
  private intervaloMonitoreo: ReturnType<typeof setInterval> | null = null;
  private ejecutando = false;

  // ============================================================================
  // PROCESO DE MONITOREO
  // ============================================================================

  /**
   * Iniciar proceso de monitoreo de plazos
   * Se ejecuta cada X minutos para verificar plazos próximos a vencer
   * @param intervaloMinutos Intervalo entre escaneos (default: 60 minutos)
   */
  iniciarMonitoreo(intervaloMinutos: number = 60): void {
    if (this.intervaloMonitoreo) {
      log.info("Monitoreo ya está activo");
      return;
    }

    log.info(`Iniciando monitoreo de plazos cada ${intervaloMinutos} minutos`);

    // Ejecutar inmediatamente la primera vez
    this.ejecutarEscaneo();

    // Programar ejecuciones periódicas
    this.intervaloMonitoreo = setInterval(
      () => this.ejecutarEscaneo(),
      intervaloMinutos * 60 * 1000
    );
  }

  /**
   * Detener proceso de monitoreo
   */
  detenerMonitoreo(): void {
    if (this.intervaloMonitoreo) {
      clearInterval(this.intervaloMonitoreo);
      this.intervaloMonitoreo = null;
      log.info("Monitoreo detenido");
    }
  }

  /**
   * Ejecutar escaneo de plazos
   * Verifica todos los plazos VIGENTES y dispara alertas según umbrales
   */
  async ejecutarEscaneo(): Promise<{
    escaneados: number;
    alertasEnviadas: number;
    errores: number;
  }> {
    if (this.ejecutando) {
      log.debug("Escaneo ya en progreso, omitiendo...");
      return { escaneados: 0, alertasEnviadas: 0, errores: 0 };
    }

    this.ejecutando = true;
    const inicio = new Date();
    let escaneados = 0;
    let alertasEnviadas = 0;
    let errores = 0;

    try {
      log.debug(`Iniciando escaneo de plazos: ${inicio.toISOString()}`);

      // Obtener plazos que necesitan alertas
      const plazosPendientes = await plazosService.obtenerPlazosPendientesAlerta();
      escaneados = plazosPendientes.length;

      for (const plazo of plazosPendientes) {
        try {
          await this.procesarAlertaPlazo(plazo);
          alertasEnviadas++;
        } catch (error) {
          errores++;
          log.error(
            `Error procesando plazo ${plazo.plazoId}:`,
            error
          );
        }
      }

      // Registrar auditoría del escaneo
      await auditService.log({
        tipoEvento: "ESCANEO_PLAZOS",
        usuarioId: null, // Proceso automático
        usuarioCorreo: "sistema@juez-seguro.gob.ec",
        moduloAfectado: "CASOS",
        descripcion: `Escaneo automático: ${escaneados} plazos, ${alertasEnviadas} alertas`,
        datosAfectados: {
          escaneados,
          alertasEnviadas,
          errores,
          duracionMs: Date.now() - inicio.getTime(),
        },
        ipOrigen: "127.0.0.1",
        userAgent: "sistema-monitoreo",
      });

      log.info("Escaneo completado", { escaneados, alertasEnviadas, errores });
    } catch (error) {
      log.error("Error en escaneo:", error);
    } finally {
      this.ejecutando = false;
    }

    return { escaneados, alertasEnviadas, errores };
  }

  /**
   * Procesar alerta para un plazo específico
   */
  private async procesarAlertaPlazo(
    plazo: AlertaPlazo & {
      alertas3Dias: boolean;
      alerta1Dia: boolean;
      alertaVencido: boolean;
    }
  ): Promise<void> {
    const { diasRestantes, plazoId, juezId, secretarioId } = plazo;

    // Determinar qué tipo de alerta enviar
    let tipoAlerta: "3_dias" | "1_dia" | "vencido" | null = null;
    let nivelUrgencia: NotificacionInterna["tipo"] = "info";

    if (diasRestantes <= 0 && !plazo.alertaVencido) {
      tipoAlerta = "vencido";
      nivelUrgencia = "urgente";
    } else if (diasRestantes <= 1 && !plazo.alerta1Dia) {
      tipoAlerta = "1_dia";
      nivelUrgencia = "alerta";
    } else if (diasRestantes <= 3 && !plazo.alertas3Dias) {
      tipoAlerta = "3_dias";
      nivelUrgencia = "info";
    }

    if (!tipoAlerta) return;

    // Crear mensaje de alerta
    const mensaje = this.generarMensajeAlerta(plazo, tipoAlerta);

    // Enviar alerta al Juez
    await this.crearNotificacionInterna({
      usuarioId: juezId,
      titulo: this.generarTituloAlerta(tipoAlerta),
      mensaje,
      tipo: nivelUrgencia,
      leida: false,
      enlaceCausa: plazo.causaId,
    });

    // Enviar alerta al Secretario (si existe)
    if (secretarioId) {
      await this.crearNotificacionInterna({
        usuarioId: secretarioId,
        titulo: this.generarTituloAlerta(tipoAlerta),
        mensaje,
        tipo: nivelUrgencia,
        leida: false,
        enlaceCausa: plazo.causaId,
      });
    }

    // Marcar alerta como enviada
    await plazosService.marcarAlertaEnviada(plazoId, tipoAlerta);

    // Registrar en auditoría
    await auditService.log({
      tipoEvento: "ALERTA_PLAZO_ENVIADA",
      usuarioId: null,
      usuarioCorreo: "sistema@juez-seguro.gob.ec",
      moduloAfectado: "CASOS",
      descripcion: `Alerta ${tipoAlerta} enviada para plazo ${plazoId}`,
      datosAfectados: {
        plazoId,
        causaId: plazo.causaId,
        numeroProceso: plazo.numeroProceso,
        tipoAlerta,
        diasRestantes,
        destinatarios: [juezId, secretarioId].filter(Boolean),
      },
      ipOrigen: "127.0.0.1",
      userAgent: "sistema-monitoreo",
    });
  }

  /**
   * Generar título de alerta según tipo
   */
  private generarTituloAlerta(tipo: "3_dias" | "1_dia" | "vencido"): string {
    switch (tipo) {
      case "3_dias":
        return "⏰ Plazo próximo a vencer (3 días)";
      case "1_dia":
        return "⚠️ URGENTE: Plazo vence mañana";
      case "vencido":
        return "🚨 CRÍTICO: Plazo judicial vencido";
    }
  }

  /**
   * Generar mensaje de alerta
   */
  private generarMensajeAlerta(
    plazo: AlertaPlazo,
    tipo: "3_dias" | "1_dia" | "vencido"
  ): string {
    const fechaVenc = new Date(plazo.fechaVencimiento).toLocaleDateString("es-EC", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    switch (tipo) {
      case "3_dias":
        return (
          `El plazo "${plazo.descripcion}" en el proceso ${plazo.numeroProceso} ` +
          `vence el ${fechaVenc}. Restan ${plazo.diasRestantes} días hábiles.`
        );
      case "1_dia":
        return (
          `ATENCIÓN: El plazo "${plazo.descripcion}" en el proceso ${plazo.numeroProceso} ` +
          `vence MAÑANA ${fechaVenc}. Tome las acciones necesarias.`
        );
      case "vencido":
        return (
          `ALERTA CRÍTICA: El plazo "${plazo.descripcion}" en el proceso ${plazo.numeroProceso} ` +
          `HA VENCIDO el ${fechaVenc}. Revise las consecuencias procesales.`
        );
    }
  }

  /**
   * Crear notificación interna en el sistema
   * Usa la tabla notificaciones_internas existente
   */
  private async crearNotificacionInterna(
    notif: NotificacionInterna
  ): Promise<void> {
    try {
      // Verificar si existe la tabla notificaciones_internas
      const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'notificaciones_internas'
        )
      `;
      const checkResult = await casesPool.query(checkQuery);

      if (checkResult.rows[0].exists) {
        // Insertar en tabla existente
        const insertQuery = `
          INSERT INTO notificaciones_internas (
            usuario_id,
            titulo,
            mensaje,
            tipo,
            leida,
            causa_id,
            fecha_creacion
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `;

        await casesPool.query(insertQuery, [
          notif.usuarioId,
          notif.titulo,
          notif.mensaje,
          notif.tipo,
          notif.leida,
          notif.enlaceCausa || null,
        ]);
      } else {
        // Si no existe la tabla, registrar en log
        log.debug(`Notificación pendiente para usuario ${notif.usuarioId}: ${notif.titulo}`);
      }
    } catch (error) {
      log.error("Error creando notificación interna:", error);
      // No lanzar error para no interrumpir el proceso de alertas
    }
  }

  // ============================================================================
  // CONSULTAS DE ALERTAS
  // ============================================================================

  /**
   * Obtener alertas pendientes para un usuario
   */
  async obtenerAlertasUsuario(
    usuarioId: number,
    soloNoLeidas: boolean = false
  ): Promise<
    Array<{
      id: number;
      titulo: string;
      mensaje: string;
      tipo: string;
      leida: boolean;
      causaId?: number;
      fechaCreacion: Date;
    }>
  > {
    try {
      let query = `
        SELECT 
          notificacion_id,
          titulo,
          mensaje,
          tipo,
          leida,
          causa_id,
          fecha_creacion
        FROM notificaciones_internas
        WHERE usuario_id = $1
      `;

      if (soloNoLeidas) {
        query += ` AND leida = false`;
      }

      query += ` ORDER BY fecha_creacion DESC LIMIT 50`;

      const result = await casesPool.query(query, [usuarioId]);

      return result.rows.map((row) => ({
        id: row.notificacion_id,
        titulo: row.titulo,
        mensaje: row.mensaje,
        tipo: row.tipo,
        leida: row.leida,
        causaId: row.causa_id,
        fechaCreacion: row.fecha_creacion,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Marcar alerta como leída
   */
  async marcarAlertaLeida(notificacionId: number, usuarioId: number): Promise<boolean> {
    try {
      const result = await casesPool.query(
        `UPDATE notificaciones_internas 
         SET leida = true 
         WHERE notificacion_id = $1 AND usuario_id = $2`,
        [notificacionId, usuarioId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Obtener conteo de alertas no leídas
   */
  async contarAlertasNoLeidas(usuarioId: number): Promise<number> {
    try {
      const result = await casesPool.query(
        `SELECT COUNT(*) as count FROM notificaciones_internas 
         WHERE usuario_id = $1 AND leida = false`,
        [usuarioId]
      );
      return parseInt(result.rows[0].count) || 0;
    } catch {
      return 0;
    }
  }

  // ============================================================================
  // EJECUCIÓN MANUAL (para pruebas o forzar escaneo)
  // ============================================================================

  /**
   * Forzar escaneo manual (para administradores)
   */
  async forzarEscaneo(
    usuario: TokenPayload,
    ipOrigen: string
  ): Promise<{ escaneados: number; alertasEnviadas: number; errores: number }> {
    // Solo administradores pueden forzar escaneos
    if (usuario.rol !== "ADMIN_CJ") {
      throw new Error("Solo administradores pueden forzar escaneos de plazos");
    }

    await auditService.log({
      tipoEvento: "ESCANEO_MANUAL_PLAZOS",
      usuarioId: usuario.funcionarioId,
      usuarioCorreo: usuario.correo,
      moduloAfectado: "ADMIN",
      descripcion: "Escaneo manual de plazos forzado por administrador",
      datosAfectados: {},
      ipOrigen,
      userAgent: "sistema-admin",
    });

    return this.ejecutarEscaneo();
  }
}

export const alertasService = new AlertasService();
