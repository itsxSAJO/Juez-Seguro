// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de OTP (One-Time Password)
// Para acceso seguro a datos sensibles de funcionarios
// ============================================================================

import crypto from "crypto";
import { emailService } from "./email.service.js";
import { auditService } from "./audit.service.js";
import { loggers } from "./logger.service.js";
import type { TokenPayload } from "../types/index.js";

const log = loggers.auth;

// Almacenamiento en memoria de OTPs (en producción usar Redis)
interface OTPEntry {
  otp: string;
  funcionarioIdObjetivo: number; // ID del funcionario cuyos datos se quieren ver
  solicitadoPorId: number; // ID del admin que solicita
  creadoEn: number; // timestamp
  expiraEn: number; // timestamp
  usado: boolean;
}

// Rate limiting para solicitudes de OTP
interface RateLimitEntry {
  intentos: number;
  ultimoIntento: number;
  bloqueadoHasta: number;
}

// Map de OTPs activos: clave es `${solicitadoPorId}-${funcionarioIdObjetivo}`
const otpStorage = new Map<string, OTPEntry>();

// Map de rate limiting por admin: clave es `adminId`
const rateLimitStorage = new Map<number, RateLimitEntry>();

// Configuración
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 30; // 30 segundos para ingresar el OTP

// Rate limiting config
const MAX_SOLICITUDES_POR_MINUTO = 5; // Máximo 5 solicitudes por minuto
const TIEMPO_BLOQUEO_SEGUNDOS = 60; // 60 segundos de bloqueo si excede límite
const VENTANA_RATE_LIMIT_MS = 60000; // Ventana de 1 minuto

/**
 * Genera un OTP numérico de 6 dígitos
 */
function generarOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Limpia OTPs expirados del storage
 */
function limpiarOTPsExpirados(): void {
  const ahora = Date.now();
  for (const [key, entry] of otpStorage.entries()) {
    if (entry.expiraEn < ahora || entry.usado) {
      otpStorage.delete(key);
    }
  }
  // Limpiar también rate limits expirados
  for (const [key, entry] of rateLimitStorage.entries()) {
    if (entry.bloqueadoHasta < ahora && ahora - entry.ultimoIntento > VENTANA_RATE_LIMIT_MS) {
      rateLimitStorage.delete(key);
    }
  }
}

// Limpiar OTPs cada 60 segundos
setInterval(limpiarOTPsExpirados, 60000);

class OTPService {
  /**
   * Verifica rate limiting para un admin
   * Retorna: { permitido: boolean, tiempoEspera?: number, mensaje?: string }
   */
  private verificarRateLimit(adminId: number): { permitido: boolean; tiempoEspera?: number; mensaje?: string } {
    const ahora = Date.now();
    let entry = rateLimitStorage.get(adminId);

    // Si no hay entrada, crear una nueva
    if (!entry) {
      entry = { intentos: 0, ultimoIntento: ahora, bloqueadoHasta: 0 };
      rateLimitStorage.set(adminId, entry);
    }

    // Verificar si está bloqueado
    if (entry.bloqueadoHasta > ahora) {
      const segundosRestantes = Math.ceil((entry.bloqueadoHasta - ahora) / 1000);
      return {
        permitido: false,
        tiempoEspera: segundosRestantes,
        mensaje: `Demasiadas solicitudes. Espere ${segundosRestantes} segundos antes de solicitar otro OTP.`,
      };
    }

    // Si pasó la ventana de tiempo, reiniciar contador
    if (ahora - entry.ultimoIntento > VENTANA_RATE_LIMIT_MS) {
      entry.intentos = 0;
    }

    // Verificar si excede el límite
    if (entry.intentos >= MAX_SOLICITUDES_POR_MINUTO) {
      entry.bloqueadoHasta = ahora + (TIEMPO_BLOQUEO_SEGUNDOS * 1000);
      const segundosRestantes = TIEMPO_BLOQUEO_SEGUNDOS;
      log.warn(`Rate limit alcanzado para admin ${adminId}. Bloqueado por ${segundosRestantes}s`);
      return {
        permitido: false,
        tiempoEspera: segundosRestantes,
        mensaje: `Ha excedido el límite de solicitudes. Espere ${segundosRestantes} segundos.`,
      };
    }

    // Incrementar contador
    entry.intentos++;
    entry.ultimoIntento = ahora;

    return { permitido: true };
  }

  /**
   * Solicita un OTP para ver datos de un funcionario
   * El OTP se envía por correo al admin solicitante
   */
  async solicitarOTP(
    funcionarioIdObjetivo: number,
    solicitante: TokenPayload,
    ipOrigen: string
  ): Promise<{ success: boolean; message: string; expiresIn: number }> {
    try {
      // Verificar que el solicitante sea ADMIN_CJ
      if (solicitante.rol !== "ADMIN_CJ") {
        throw new Error("Solo ADMIN_CJ puede solicitar OTP para ver datos");
      }

      // Verificar rate limiting
      const rateCheck = this.verificarRateLimit(solicitante.funcionarioId);
      if (!rateCheck.permitido) {
        return {
          success: false,
          message: rateCheck.mensaje || "Demasiadas solicitudes",
          expiresIn: rateCheck.tiempoEspera || 60,
        };
      }

      const clave = `${solicitante.funcionarioId}-${funcionarioIdObjetivo}`;
      
      // Verificar si ya hay un OTP activo para esta combinación
      const otpExistente = otpStorage.get(clave);
      if (otpExistente && otpExistente.expiraEn > Date.now() && !otpExistente.usado) {
        const segundosRestantes = Math.ceil((otpExistente.expiraEn - Date.now()) / 1000);
        return {
          success: false,
          message: `Ya tiene un OTP activo. Espere ${segundosRestantes} segundos o úselo.`,
          expiresIn: segundosRestantes,
        };
      }

      // Generar nuevo OTP
      const otp = generarOTP();
      const ahora = Date.now();
      const expiraEn = ahora + (OTP_EXPIRY_SECONDS * 1000);

      // Almacenar OTP
      otpStorage.set(clave, {
        otp,
        funcionarioIdObjetivo,
        solicitadoPorId: solicitante.funcionarioId,
        creadoEn: ahora,
        expiraEn,
        usado: false,
      });

      // Enviar OTP por correo
      const correoEnviado = await emailService.enviarOTP(
        solicitante.correo,
        otp,
        OTP_EXPIRY_SECONDS,
        funcionarioIdObjetivo
      );

      if (!correoEnviado) {
        // Si falla el envío de correo, mostrar OTP en consola para desarrollo
        log.warn(`⚠️ No se pudo enviar OTP por correo. OTP de prueba: ${otp}`);
      }

      // Auditoría
      await auditService.log({
        tipoEvento: "SOLICITUD_OTP_DATOS_FUNCIONARIO",
        usuarioId: solicitante.funcionarioId,
        usuarioCorreo: solicitante.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Solicitud de OTP para ver datos del funcionario ID ${funcionarioIdObjetivo}`,
        datosAfectados: { funcionarioIdObjetivo },
        ipOrigen,
        userAgent: "sistema",
      });

      log.info(`OTP generado para admin ${solicitante.funcionarioId} -> funcionario ${funcionarioIdObjetivo}`);

      return {
        success: true,
        message: `OTP enviado a ${solicitante.correo}. Válido por ${OTP_EXPIRY_SECONDS} segundos.`,
        expiresIn: OTP_EXPIRY_SECONDS,
      };
    } catch (error) {
      log.error("Error al solicitar OTP:", error);
      throw error;
    }
  }

  /**
   * Valida un OTP y retorna si es válido
   */
  async validarOTP(
    funcionarioIdObjetivo: number,
    otpIngresado: string,
    solicitante: TokenPayload,
    ipOrigen: string
  ): Promise<boolean> {
    try {
      const clave = `${solicitante.funcionarioId}-${funcionarioIdObjetivo}`;
      const otpEntry = otpStorage.get(clave);

      // Verificar si existe
      if (!otpEntry) {
        await this.registrarIntentoFallido(solicitante, funcionarioIdObjetivo, "OTP no encontrado", ipOrigen);
        return false;
      }

      // Verificar si ya fue usado
      if (otpEntry.usado) {
        await this.registrarIntentoFallido(solicitante, funcionarioIdObjetivo, "OTP ya usado", ipOrigen);
        return false;
      }

      // Verificar si expiró
      if (otpEntry.expiraEn < Date.now()) {
        otpStorage.delete(clave);
        await this.registrarIntentoFallido(solicitante, funcionarioIdObjetivo, "OTP expirado", ipOrigen);
        return false;
      }

      // Verificar si coincide (comparación segura en tiempo constante)
      const otpValido = crypto.timingSafeEqual(
        Buffer.from(otpEntry.otp),
        Buffer.from(otpIngresado.padStart(OTP_LENGTH, '0').slice(0, OTP_LENGTH))
      );

      if (!otpValido) {
        await this.registrarIntentoFallido(solicitante, funcionarioIdObjetivo, "OTP incorrecto", ipOrigen);
        return false;
      }

      // Marcar como usado
      otpEntry.usado = true;

      // Auditoría de acceso exitoso
      await auditService.log({
        tipoEvento: "ACCESO_DATOS_FUNCIONARIO_OTP",
        usuarioId: solicitante.funcionarioId,
        usuarioCorreo: solicitante.correo,
        moduloAfectado: "ADMIN",
        descripcion: `Acceso autorizado con OTP a datos del funcionario ID ${funcionarioIdObjetivo}`,
        datosAfectados: { funcionarioIdObjetivo, otpValidado: true },
        ipOrigen,
        userAgent: "sistema",
      });

      log.info(`OTP validado: admin ${solicitante.funcionarioId} accedió a datos de funcionario ${funcionarioIdObjetivo}`);

      return true;
    } catch (error) {
      log.error("Error al validar OTP:", error);
      return false;
    }
  }

  /**
   * Registra un intento fallido de validación de OTP
   */
  private async registrarIntentoFallido(
    solicitante: TokenPayload,
    funcionarioIdObjetivo: number,
    razon: string,
    ipOrigen: string
  ): Promise<void> {
    await auditService.log({
      tipoEvento: "INTENTO_FALLIDO_OTP",
      usuarioId: solicitante.funcionarioId,
      usuarioCorreo: solicitante.correo,
      moduloAfectado: "ADMIN",
      descripcion: `Intento fallido de OTP para funcionario ID ${funcionarioIdObjetivo}: ${razon}`,
      datosAfectados: { funcionarioIdObjetivo, razon },
      ipOrigen,
      userAgent: "sistema",
    });

    log.warn(`Intento OTP fallido: ${razon} - admin ${solicitante.funcionarioId}`);
  }

  /**
   * Obtiene el tiempo restante de un OTP activo (si existe)
   */
  getTiempoRestante(
    funcionarioIdObjetivo: number,
    solicitanteId: number
  ): number {
    const clave = `${solicitanteId}-${funcionarioIdObjetivo}`;
    const otpEntry = otpStorage.get(clave);

    if (!otpEntry || otpEntry.usado || otpEntry.expiraEn < Date.now()) {
      return 0;
    }

    return Math.ceil((otpEntry.expiraEn - Date.now()) / 1000);
  }
}

export const otpService = new OTPService();
