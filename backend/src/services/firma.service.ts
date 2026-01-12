// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Firma Electrónica (Sprint 3)
// HU-JZ-003: Firma de autos, providencias y sentencias
// ============================================================================
// Implementa firma digital RSA con certificados X.509
// Garantiza No Repudio e Integridad de documentos firmados
// ============================================================================

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { auditService } from "./audit.service.js";
import type { MetadatosFirma, VerificacionFirma } from "../types/index.js";
import { configBase } from "../config/index.js";
import { secretsManager } from "./secrets-manager.service.js";
import { loggers } from "./logger.service.js";

const log = loggers.pki;

// ============================================================================
// CONFIGURACIÓN PKI (Lazy Loading - CWE-798 Mitigado)
// ============================================================================
// Las rutas se cargan de configBase (disponible inmediatamente)
// PFX_PASSWORD se obtiene de SecretsManager cuando se necesita
// ============================================================================

const PKI_BASE_PATH = configBase.pki.basePath;
const CA_CERT_PATH = configBase.pki.caCertPath;

/**
 * Obtiene la contraseña PFX de forma lazy desde SecretsManager
 */
const getPfxPassword = (): string => {
  const password = secretsManager.getSecret("PFX_PASSWORD");
  if (!password) {
    throw new Error("PFX_PASSWORD no disponible en SecretsManager");
  }
  return password;
};

// Algoritmo de firma
const SIGNATURE_ALGORITHM = "SHA256";
const SIGNATURE_PADDING = crypto.constants.RSA_PKCS1_PADDING;

// ============================================================================
// INTERFACES INTERNAS
// ============================================================================

interface CertificadoJuez {
  juezId: number;
  privateKey: crypto.KeyObject;
  certificate: string;
  commonName: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
}

interface DatosFirmante {
  commonName: string;
  email: string;
  organization: string;
  serialNumber: string;
}

// ============================================================================
// SERVICIO DE FIRMA ELECTRÓNICA
// ============================================================================

class FirmaElectronicaService {
  private certificadosCache: Map<number, CertificadoJuez> = new Map();

  /**
   * Carga el certificado y clave privada de un juez desde el archivo PFX
   * Simula el acceso a un token USB/smartcard
   * 
   * @param juezId - ID del juez en el sistema
   * @returns Certificado cargado o null si no existe
   */
  async cargarCertificadoJuez(juezId: number): Promise<CertificadoJuez | null> {
    // Verificar cache
    if (this.certificadosCache.has(juezId)) {
      const cached = this.certificadosCache.get(juezId)!;
      // Verificar que no haya expirado
      if (new Date() < cached.validTo) {
        return cached;
      }
      // Si expiró, eliminar del cache
      this.certificadosCache.delete(juezId);
    }

    try {
      // Construir ruta al archivo PFX
      const pfxPath = path.join(PKI_BASE_PATH, `juez_${juezId}.pfx`);
      const crtPath = path.join(PKI_BASE_PATH, `juez_${juezId}.crt`);
      const keyPath = path.join(PKI_BASE_PATH, `juez_${juezId}.key`);

      // Verificar si existen los archivos
      try {
        await fs.access(keyPath);
        await fs.access(crtPath);
      } catch {
        log.warn(`No se encontraron certificados para juez ${juezId}`);
        return null;
      }

      // Leer clave privada
      const keyPem = await fs.readFile(keyPath, "utf-8");
      const privateKey = crypto.createPrivateKey({
        key: keyPem,
        format: "pem",
      });

      // Leer certificado
      const certPem = await fs.readFile(crtPath, "utf-8");
      
      // Extraer información del certificado usando OpenSSL info
      const certInfo = this.parseCertificateInfo(certPem);

      const certificado: CertificadoJuez = {
        juezId,
        privateKey,
        certificate: certPem,
        commonName: certInfo.commonName,
        serialNumber: certInfo.serialNumber,
        validFrom: certInfo.validFrom,
        validTo: certInfo.validTo,
      };

      // Guardar en cache
      this.certificadosCache.set(juezId, certificado);

      log.info(`Certificado cargado para juez`, { juezId, commonName: certInfo.commonName });
      return certificado;

    } catch (error) {
      log.error(`Error al cargar certificado para juez ${juezId}:`, error);
      return null;
    }
  }

  /**
   * Extrae información básica del certificado X.509
   */
  private parseCertificateInfo(certPem: string): {
    commonName: string;
    serialNumber: string;
    validFrom: Date;
    validTo: Date;
  } {
    // Usar crypto para obtener info del certificado
    const cert = new crypto.X509Certificate(certPem);
    
    // Extraer CN del subject
    const subjectParts = cert.subject.split("\n");
    let commonName = "Desconocido";
    for (const part of subjectParts) {
      if (part.startsWith("CN=")) {
        commonName = part.substring(3);
        break;
      }
    }

    return {
      commonName,
      serialNumber: cert.serialNumber,
      validFrom: new Date(cert.validFrom),
      validTo: new Date(cert.validTo),
    };
  }

  /**
   * Firma digitalmente un documento (hash) con la clave privada del juez
   * Implementa el proceso de firma RSA con SHA-256
   * 
   * @param juezId - ID del juez firmante
   * @param contenido - Contenido a firmar (Buffer o string)
   * @param ipOrigen - IP de origen para auditoría
   * @param userAgent - User agent para auditoría
   * @returns Metadatos de la firma o null si falla
   */
  async firmarDocumento(
    juezId: number,
    contenido: Buffer | string,
    ipOrigen: string,
    userAgent: string
  ): Promise<MetadatosFirma | null> {
    try {
      // 1. Cargar certificado del juez
      const certificado = await this.cargarCertificadoJuez(juezId);
      
      if (!certificado) {
        await auditService.log({
          tipoEvento: "FIRMA_FALLIDA",
          usuarioId: juezId,
          moduloAfectado: "CASOS",
          descripcion: `[ALTA] Intento de firma sin certificado válido para juez ${juezId}`,
          datosAfectados: { juezId, motivo: "CERTIFICADO_NO_ENCONTRADO" },
          ipOrigen,
          userAgent,
        });
        return null;
      }

      // 2. Verificar que el certificado no haya expirado
      const ahora = new Date();
      if (ahora < certificado.validFrom || ahora > certificado.validTo) {
        await auditService.log({
          tipoEvento: "FIRMA_FALLIDA",
          usuarioId: juezId,
          moduloAfectado: "CASOS",
          descripcion: `[ALTA] Certificado expirado para juez ${juezId}`,
          datosAfectados: { 
            juezId, 
            motivo: "CERTIFICADO_EXPIRADO",
            validFrom: certificado.validFrom,
            validTo: certificado.validTo,
          },
          ipOrigen,
          userAgent,
        });
        return null;
      }

      // 3. Calcular hash del contenido
      const contentBuffer = typeof contenido === "string" 
        ? Buffer.from(contenido, "utf-8") 
        : contenido;
      
      const hashDocumento = crypto
        .createHash("sha256")
        .update(contentBuffer)
        .digest("hex");

      // 4. Firmar el hash con la clave privada
      const signer = crypto.createSign(SIGNATURE_ALGORITHM);
      signer.update(contentBuffer);
      const firmaBuffer = signer.sign({
        key: certificado.privateKey,
        padding: SIGNATURE_PADDING,
      });
      
      const firmaBase64 = firmaBuffer.toString("base64");

      // 5. Construir metadatos de firma
      const metadatos: MetadatosFirma = {
        certificadoFirmante: certificado.commonName,
        numeroSerieCertificado: certificado.serialNumber,
        algoritmoFirma: `${SIGNATURE_ALGORITHM}withRSA`,
        fechaFirma: new Date(),
        hashDocumento,
        firmaBase64,
        verificado: true,
      };

      // 6. Registrar en auditoría
      await auditService.log({
        tipoEvento: "DOCUMENTO_FIRMADO",
        usuarioId: juezId,
        moduloAfectado: "CASOS",
        descripcion: `[INFO] Documento firmado digitalmente por ${certificado.commonName}`,
        datosAfectados: {
          juezId,
          certificadoFirmante: certificado.commonName,
          serialNumber: certificado.serialNumber,
          hashDocumento,
          algoritmo: metadatos.algoritmoFirma,
        },
        ipOrigen,
        userAgent,
      });

      log.info(`Documento firmado`, { firmante: certificado.commonName, juezId });
      return metadatos;

    } catch (error) {
      log.error(`Error al firmar documento:`, error);
      
      await auditService.log({
        tipoEvento: "FIRMA_FALLIDA",
        usuarioId: juezId,
        moduloAfectado: "CASOS",
        descripcion: `[ALTA] Error al firmar documento: ${(error as Error).message}`,
        datosAfectados: { juezId, error: (error as Error).message },
        ipOrigen,
        userAgent,
      });

      return null;
    }
  }

  /**
   * Verifica la firma digital de un documento
   * 
   * @param contenidoOriginal - Contenido original del documento
   * @param firmaBase64 - Firma en Base64
   * @param juezId - ID del juez firmante
   * @returns Resultado de la verificación
   */
  async verificarFirma(
    contenidoOriginal: Buffer | string,
    firmaBase64: string,
    juezId: number
  ): Promise<VerificacionFirma> {
    try {
      // 1. Cargar certificado del juez
      const certificado = await this.cargarCertificadoJuez(juezId);
      
      if (!certificado) {
        return {
          valido: false,
          error: "Certificado del firmante no encontrado",
        };
      }

      // 2. Calcular hash actual del contenido
      const contentBuffer = typeof contenidoOriginal === "string"
        ? Buffer.from(contenidoOriginal, "utf-8")
        : contenidoOriginal;
      
      const hashActual = crypto
        .createHash("sha256")
        .update(contentBuffer)
        .digest("hex");

      // 3. Obtener clave pública del certificado
      const publicKey = crypto.createPublicKey(certificado.certificate);

      // 4. Verificar firma
      const firmaBuffer = Buffer.from(firmaBase64, "base64");
      const verifier = crypto.createVerify(SIGNATURE_ALGORITHM);
      verifier.update(contentBuffer);
      
      const esValida = verifier.verify({
        key: publicKey,
        padding: SIGNATURE_PADDING,
      }, firmaBuffer);

      if (esValida) {
        return {
          valido: true,
          firmante: certificado.commonName,
          fechaFirma: new Date(), // La fecha real está en los metadatos
          hashActual,
        };
      } else {
        return {
          valido: false,
          error: "La firma no coincide con el contenido",
          hashActual,
        };
      }

    } catch (error) {
      log.error(`Error al verificar firma:`, error);
      return {
        valido: false,
        error: `Error de verificación: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Calcula el hash SHA-256 de un contenido
   * Útil para verificar integridad de documentos
   * 
   * @param contenido - Contenido a hashear
   * @returns Hash en formato hexadecimal
   */
  calcularHash(contenido: Buffer | string): string {
    const buffer = typeof contenido === "string"
      ? Buffer.from(contenido, "utf-8")
      : contenido;
    
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Verifica si un juez tiene un certificado válido disponible
   * 
   * @param juezId - ID del juez
   * @returns true si tiene certificado válido
   */
  async tieneCartificadoValido(juezId: number): Promise<boolean> {
    const certificado = await this.cargarCertificadoJuez(juezId);
    if (!certificado) return false;

    const ahora = new Date();
    return ahora >= certificado.validFrom && ahora <= certificado.validTo;
  }

  /**
   * Obtiene información del certificado de un juez (sin exponer la clave privada)
   * 
   * @param juezId - ID del juez
   * @returns Información pública del certificado o null
   */
  async obtenerInfoCertificado(juezId: number): Promise<{
    commonName: string;
    serialNumber: string;
    validFrom: Date;
    validTo: Date;
    esValido: boolean;
  } | null> {
    const certificado = await this.cargarCertificadoJuez(juezId);
    if (!certificado) return null;

    const ahora = new Date();
    return {
      commonName: certificado.commonName,
      serialNumber: certificado.serialNumber,
      validFrom: certificado.validFrom,
      validTo: certificado.validTo,
      esValido: ahora >= certificado.validFrom && ahora <= certificado.validTo,
    };
  }

  /**
   * Limpia el cache de certificados (útil para recargar después de renovación)
   */
  limpiarCache(): void {
    this.certificadosCache.clear();
    log.info("Cache de certificados limpiado");
  }
}

// Exportar instancia singleton
export const firmaService = new FirmaElectronicaService();
