// ============================================================================
// INTERCEPTOR DE EVENTOS DE AUDITORÍA (Sprint 3)
// Middleware transversal para captura automática de eventos críticos
// Implementa el patrón Observer para auditoría centralizada
// ============================================================================

import { auditService } from "../services/audit.service.js";
import type { TipoEventoAuditoria, ModuloAfectado } from "../types/index.js";
import type { Request, Response, NextFunction } from "express";

// ============================================================================
// TIPOS DE EVENTOS CRÍTICOS
// ============================================================================

export interface EventoCritico {
  tipo: TipoEventoAuditoria;
  modulo: ModuloAfectado;
  usuarioId: number;
  usuarioCorreo: string;
  descripcion: string;
  datos: Record<string, unknown>;
  ipOrigen: string;
  userAgent: string;
  criticidad: "ALTA" | "MEDIA" | "BAJA";
  timestamp?: Date;
}

export type EventoCallback = (evento: EventoCritico) => void | Promise<void>;

// ============================================================================
// CATÁLOGO DE EVENTOS CRÍTICOS POR MÓDULO
// ============================================================================

export const EVENTOS_CRITICOS_SPRINT3 = {
  // HU-JZ-003: Decisiones y Firmas Electrónicas
  DECISIONES: {
    CREACION_DECISION: { criticidad: "MEDIA" as const, descripcion: "Creación de nueva decisión judicial" },
    ACTUALIZACION_DECISION: { criticidad: "MEDIA" as const, descripcion: "Modificación de decisión judicial" },
    DECISION_LISTA_FIRMA: { criticidad: "ALTA" as const, descripcion: "Decisión marcada como lista para firma" },
    DECISION_FIRMADA: { criticidad: "ALTA" as const, descripcion: "Firma electrónica aplicada a decisión" },
    FIRMA_DENEGADA: { criticidad: "ALTA" as const, descripcion: "Intento de firma denegado" },
    MODIFICACION_DENEGADA: { criticidad: "ALTA" as const, descripcion: "Intento de modificación denegado en decisión firmada" },
    ELIMINACION_DECISION: { criticidad: "ALTA" as const, descripcion: "Eliminación de decisión judicial" },
    VERIFICACION_FIRMA: { criticidad: "MEDIA" as const, descripcion: "Verificación de firma electrónica" },
  },
  // HU-SJ-004: Notificaciones y Plazos
  NOTIFICACIONES: {
    CREACION_NOTIFICACION: { criticidad: "MEDIA" as const, descripcion: "Generación de notificación procesal" },
    ENVIO_NOTIFICACION: { criticidad: "ALTA" as const, descripcion: "Envío de notificación a destinatario" },
    ENTREGA_NOTIFICACION: { criticidad: "ALTA" as const, descripcion: "Confirmación de entrega de notificación" },
    FALLO_NOTIFICACION: { criticidad: "ALTA" as const, descripcion: "Fallo en entrega de notificación" },
  },
  PLAZOS: {
    CREACION_PLAZO: { criticidad: "MEDIA" as const, descripcion: "Creación de plazo procesal" },
    CAMBIO_ESTADO_PLAZO: { criticidad: "ALTA" as const, descripcion: "Cambio de estado en plazo procesal" },
    ESCANEO_PLAZOS: { criticidad: "BAJA" as const, descripcion: "Escaneo automático de plazos" },
    ESCANEO_MANUAL_PLAZOS: { criticidad: "MEDIA" as const, descripcion: "Escaneo manual de plazos" },
    ALERTA_PLAZO_ENVIADA: { criticidad: "ALTA" as const, descripcion: "Alerta de plazo enviada" },
    LECTURA_ALERTA: { criticidad: "BAJA" as const, descripcion: "Alerta marcada como leída" },
  },
} as const;

// ============================================================================
// CLASE INTERCEPTOR DE EVENTOS
// ============================================================================

class AuditInterceptor {
  private subscribers: Map<string, EventoCallback[]> = new Map();
  private eventQueue: EventoCritico[] = [];
  private processing = false;

  /**
   * Suscribir callback a un tipo de evento
   */
  subscribe(tipoEvento: TipoEventoAuditoria | "*", callback: EventoCallback): () => void {
    const key = tipoEvento;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key)!.push(callback);

    // Retornar función para desuscribir
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emitir evento crítico - Punto central de captura
   */
  async emit(evento: EventoCritico): Promise<void> {
    evento.timestamp = evento.timestamp || new Date();

    // Agregar a la cola
    this.eventQueue.push(evento);

    // Procesar cola si no está en proceso
    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Procesar cola de eventos
   */
  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.eventQueue.length > 0) {
      const evento = this.eventQueue.shift()!;

      try {
        // 1. Registrar en base de datos de auditoría
        await this.registrarEnAuditoria(evento);

        // 2. Notificar a suscriptores específicos
        const callbacks = this.subscribers.get(evento.tipo) || [];
        for (const callback of callbacks) {
          try {
            await callback(evento);
          } catch (error) {
            console.error(`[AuditInterceptor] Error en callback para ${evento.tipo}:`, error);
          }
        }

        // 3. Notificar a suscriptores globales (*)
        const globalCallbacks = this.subscribers.get("*") || [];
        for (const callback of globalCallbacks) {
          try {
            await callback(evento);
          } catch (error) {
            console.error("[AuditInterceptor] Error en callback global:", error);
          }
        }

        // 4. Log en consola para eventos de alta criticidad
        if (evento.criticidad === "ALTA") {
          console.log(
            `[EVENTO CRÍTICO] ${evento.tipo} - Usuario: ${evento.usuarioCorreo} - ${evento.descripcion}`
          );
        }
      } catch (error) {
        console.error("[AuditInterceptor] Error procesando evento:", error, evento);
      }
    }

    this.processing = false;
  }

  /**
   * Registrar evento en base de datos de auditoría
   */
  private async registrarEnAuditoria(evento: EventoCritico): Promise<void> {
    await auditService.log({
      tipoEvento: evento.tipo,
      usuarioId: evento.usuarioId,
      usuarioCorreo: evento.usuarioCorreo,
      moduloAfectado: evento.modulo,
      descripcion: `[${evento.criticidad}] ${evento.descripcion}`,
      datosAfectados: {
        ...evento.datos,
        criticidad: evento.criticidad,
        timestampEvento: evento.timestamp?.toISOString(),
      },
      ipOrigen: evento.ipOrigen,
      userAgent: evento.userAgent,
    });
  }

  /**
   * Helper para emitir evento de decisión
   */
  async emitDecision(
    tipo: keyof typeof EVENTOS_CRITICOS_SPRINT3.DECISIONES,
    usuarioId: number,
    usuarioCorreo: string,
    datos: Record<string, unknown>,
    ipOrigen: string,
    userAgent: string
  ): Promise<void> {
    const config = EVENTOS_CRITICOS_SPRINT3.DECISIONES[tipo];
    await this.emit({
      tipo,
      modulo: "DECISIONES",
      usuarioId,
      usuarioCorreo,
      descripcion: config.descripcion,
      datos,
      ipOrigen,
      userAgent,
      criticidad: config.criticidad,
    });
  }

  /**
   * Helper para emitir evento de notificación
   */
  async emitNotificacion(
    tipo: keyof typeof EVENTOS_CRITICOS_SPRINT3.NOTIFICACIONES,
    usuarioId: number,
    usuarioCorreo: string,
    datos: Record<string, unknown>,
    ipOrigen: string,
    userAgent: string
  ): Promise<void> {
    const config = EVENTOS_CRITICOS_SPRINT3.NOTIFICACIONES[tipo];
    await this.emit({
      tipo,
      modulo: "NOTIFICACIONES",
      usuarioId,
      usuarioCorreo,
      descripcion: config.descripcion,
      datos,
      ipOrigen,
      userAgent,
      criticidad: config.criticidad,
    });
  }

  /**
   * Helper para emitir evento de plazo
   */
  async emitPlazo(
    tipo: keyof typeof EVENTOS_CRITICOS_SPRINT3.PLAZOS,
    usuarioId: number,
    usuarioCorreo: string,
    datos: Record<string, unknown>,
    ipOrigen: string,
    userAgent: string
  ): Promise<void> {
    const config = EVENTOS_CRITICOS_SPRINT3.PLAZOS[tipo];
    await this.emit({
      tipo,
      modulo: "PLAZOS",
      usuarioId,
      usuarioCorreo,
      descripcion: config.descripcion,
      datos,
      ipOrigen,
      userAgent,
      criticidad: config.criticidad,
    });
  }

  /**
   * Obtener estadísticas de eventos procesados
   */
  getStats(): { queueSize: number; subscriberCount: number } {
    let subscriberCount = 0;
    this.subscribers.forEach((callbacks) => {
      subscriberCount += callbacks.length;
    });
    return {
      queueSize: this.eventQueue.length,
      subscriberCount,
    };
  }
}

// ============================================================================
// INSTANCIA SINGLETON
// ============================================================================

export const auditInterceptor = new AuditInterceptor();

// ============================================================================
// MIDDLEWARE EXPRESS PARA INYECTAR INTERCEPTOR EN REQUEST
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      auditInterceptor: AuditInterceptor;
    }
  }
}

export function injectAuditInterceptor(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  req.auditInterceptor = auditInterceptor;
  next();
}

// ============================================================================
// HELPERS PARA REGISTRO RÁPIDO
// ============================================================================

/**
 * Registrar evento de firma electrónica (evento crítico)
 */
export async function logFirmaElectronica(
  usuarioId: number,
  usuarioCorreo: string,
  decisionId: number,
  causaId: number,
  exitoso: boolean,
  ipOrigen: string,
  userAgent: string,
  detalles?: Record<string, unknown>
): Promise<void> {
  await auditInterceptor.emitDecision(
    exitoso ? "DECISION_FIRMADA" : "FIRMA_DENEGADA",
    usuarioId,
    usuarioCorreo,
    {
      decisionId,
      causaId,
      exitoso,
      ...detalles,
    },
    ipOrigen,
    userAgent
  );
}

/**
 * Registrar generación de notificación (evento crítico)
 */
export async function logGeneracionNotificacion(
  usuarioId: number,
  usuarioCorreo: string,
  notificacionId: number,
  decisionId: number,
  causaId: number,
  tipoNotificacion: string,
  ipOrigen: string,
  userAgent: string
): Promise<void> {
  await auditInterceptor.emitNotificacion(
    "CREACION_NOTIFICACION",
    usuarioId,
    usuarioCorreo,
    {
      notificacionId,
      decisionId,
      causaId,
      tipoNotificacion,
    },
    ipOrigen,
    userAgent
  );
}

/**
 * Registrar cambio de estado de plazo (evento crítico)
 */
export async function logCambioEstadoPlazo(
  usuarioId: number,
  usuarioCorreo: string,
  plazoId: number,
  causaId: number,
  estadoAnterior: string,
  estadoNuevo: string,
  ipOrigen: string,
  userAgent: string
): Promise<void> {
  await auditInterceptor.emitPlazo(
    "CAMBIO_ESTADO_PLAZO",
    usuarioId,
    usuarioCorreo,
    {
      plazoId,
      causaId,
      estadoAnterior,
      estadoNuevo,
    },
    ipOrigen,
    userAgent
  );
}

/**
 * Registrar alerta de plazo enviada
 */
export async function logAlertaPlazoEnviada(
  plazoId: number,
  causaId: number,
  tipoAlerta: string,
  destinatarios: number[]
): Promise<void> {
  await auditInterceptor.emitPlazo(
    "ALERTA_PLAZO_ENVIADA",
    0, // Sistema
    "sistema@juez-seguro.gob.ec",
    {
      plazoId,
      causaId,
      tipoAlerta,
      destinatarios,
      origen: "sistema-monitoreo",
    },
    "127.0.0.1",
    "sistema-monitoreo"
  );
}
