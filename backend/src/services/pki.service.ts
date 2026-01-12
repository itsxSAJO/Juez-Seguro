// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Generación de Certificados PKI
// HU-JZ-003: Genera certificados X.509 para firma electrónica de jueces
// ============================================================================
// ADVERTENCIA: En producción, usar HSM (Hardware Security Module) real
// Este servicio simula la generación de certificados para desarrollo
// ============================================================================

import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { auditService } from "./audit.service.js";
import { loggers } from "./logger.service.js";

const log = loggers.pki;

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const PKI_BASE_PATH = process.env.PKI_JUECES_CERTS_PATH || "./certs/jueces";
const CA_CERT_PATH = process.env.PKI_CA_CERT_PATH || "./certs/ca/ca.crt";
const CA_KEY_PATH = process.env.PKI_CA_KEY_PATH || "./certs/ca/ca.key";

// Días de validez del certificado
const CERT_VALIDITY_DAYS = 730; // 2 años

// ============================================================================
// INTERFACES
// ============================================================================

interface DatosJuezCertificado {
  juezId: number;
  nombreCompleto: string;
  correo: string;
}

interface ResultadoGeneracion {
  exito: boolean;
  mensaje: string;
  rutaCertificado?: string;
  rutaClave?: string;
  serialNumber?: string;
  validoHasta?: Date;
}

// ============================================================================
// SERVICIO DE PKI
// ============================================================================

class PkiService {
  private inicializado: boolean = false;

  /**
   * Inicializa los directorios necesarios para PKI
   */
  async inicializar(): Promise<void> {
    if (this.inicializado) return;

    try {
      // Crear directorio de jueces si no existe
      await fs.mkdir(PKI_BASE_PATH, { recursive: true });
      
      // Verificar que existe la CA
      const caExists = await this.verificarCA();
      if (!caExists) {
        log.warn("No se encontró la CA. Generando CA de desarrollo...");
        await this.generarCADesarrollo();
      }

      this.inicializado = true;
      log.info("Servicio de certificados inicializado");
    } catch (error) {
      log.error("Error al inicializar:", error);
      throw error;
    }
  }

  /**
   * Verifica si existe la CA (Autoridad Certificadora)
   */
  private async verificarCA(): Promise<boolean> {
    try {
      await fs.access(CA_CERT_PATH);
      await fs.access(CA_KEY_PATH);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Genera una CA de desarrollo (solo para testing)
   */
  private async generarCADesarrollo(): Promise<void> {
    const caDir = path.dirname(CA_CERT_PATH);
    await fs.mkdir(caDir, { recursive: true });

    // Generar clave privada de CA
    await this.ejecutarOpenSSL([
      "genrsa", "-out", CA_KEY_PATH, "4096"
    ]);

    // Generar certificado autofirmado de CA
    await this.ejecutarOpenSSL([
      "req", "-x509", "-new", "-nodes",
      "-key", CA_KEY_PATH,
      "-sha256", "-days", "3650",
      "-out", CA_CERT_PATH,
      "-subj", "/C=EC/ST=Pichincha/L=Quito/O=Consejo de la Judicatura/OU=PKI/CN=CA Judicatura Ecuador Dev"
    ]);

    log.info("CA de desarrollo generada");
  }

  /**
   * Genera un certificado X.509 para un juez
   * Este certificado se usará para firmar decisiones judiciales
   */
  async generarCertificadoJuez(datos: DatosJuezCertificado): Promise<ResultadoGeneracion> {
    await this.inicializar();

    const keyPath = path.join(PKI_BASE_PATH, `juez_${datos.juezId}.key`);
    const csrPath = path.join(PKI_BASE_PATH, `juez_${datos.juezId}.csr`);
    const crtPath = path.join(PKI_BASE_PATH, `juez_${datos.juezId}.crt`);

    try {
      // Verificar si ya existe
      try {
        await fs.access(crtPath);
        log.info(`Certificado para juez ya existe`, { juezId: datos.juezId });
        return {
          exito: true,
          mensaje: "Certificado ya existe",
          rutaCertificado: crtPath,
          rutaClave: keyPath,
        };
      } catch {
        // No existe, continuar con generación
      }

      // Limpiar nombre para subject (remover caracteres especiales)
      const nombreLimpio = this.limpiarNombreSubject(datos.nombreCompleto);
      const subject = `/C=EC/ST=Pichincha/L=Quito/O=Funcion Judicial/OU=Jueces/CN=${nombreLimpio}/emailAddress=${datos.correo}`;

      // 1. Generar clave privada RSA 2048
      await this.ejecutarOpenSSL([
        "genrsa", "-out", keyPath, "2048"
      ]);

      // 2. Generar CSR (Certificate Signing Request)
      await this.ejecutarOpenSSL([
        "req", "-new",
        "-key", keyPath,
        "-out", csrPath,
        "-subj", subject
      ]);

      // 3. Firmar con la CA
      await this.ejecutarOpenSSL([
        "x509", "-req",
        "-in", csrPath,
        "-CA", CA_CERT_PATH,
        "-CAkey", CA_KEY_PATH,
        "-CAcreateserial",
        "-out", crtPath,
        "-days", CERT_VALIDITY_DAYS.toString(),
        "-sha256"
      ]);

      // 4. Eliminar CSR (ya no es necesario)
      await fs.unlink(csrPath).catch(() => {});

      // 5. Obtener información del certificado generado
      const certInfo = await this.obtenerInfoCertificado(crtPath);

      log.info(`Certificado generado para juez`, { juezId: datos.juezId, nombre: nombreLimpio });

      return {
        exito: true,
        mensaje: `Certificado generado exitosamente para ${nombreLimpio}`,
        rutaCertificado: crtPath,
        rutaClave: keyPath,
        serialNumber: certInfo.serial,
        validoHasta: certInfo.validTo,
      };

    } catch (error) {
      log.error(`Error al generar certificado para juez ${datos.juezId}:`, error);
      
      // Limpiar archivos parciales
      await fs.unlink(keyPath).catch(() => {});
      await fs.unlink(csrPath).catch(() => {});
      await fs.unlink(crtPath).catch(() => {});

      return {
        exito: false,
        mensaje: error instanceof Error ? error.message : "Error desconocido al generar certificado",
      };
    }
  }

  /**
   * Revoca un certificado de juez (cuando se inhabilita la cuenta)
   */
  async revocarCertificado(juezId: number): Promise<boolean> {
    const keyPath = path.join(PKI_BASE_PATH, `juez_${juezId}.key`);
    const crtPath = path.join(PKI_BASE_PATH, `juez_${juezId}.crt`);
    const revokedPath = path.join(PKI_BASE_PATH, `juez_${juezId}.revoked`);

    try {
      // Mover a carpeta de revocados (en producción, agregar a CRL)
      await fs.rename(crtPath, revokedPath);
      await fs.unlink(keyPath).catch(() => {}); // Eliminar clave privada

      log.info(`Certificado de juez revocado`, { juezId });
      return true;
    } catch (error) {
      log.error(`Error al revocar certificado de juez ${juezId}:`, error);
      return false;
    }
  }

  /**
   * Verifica si un juez tiene certificado válido
   */
  async tieneCertificadoValido(juezId: number): Promise<boolean> {
    const crtPath = path.join(PKI_BASE_PATH, `juez_${juezId}.crt`);
    
    try {
      await fs.access(crtPath);
      const info = await this.obtenerInfoCertificado(crtPath);
      return new Date() < info.validTo;
    } catch {
      return false;
    }
  }

  /**
   * Limpia el nombre para usarlo en el subject del certificado
   */
  private limpiarNombreSubject(nombre: string): string {
    return nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remover acentos
      .replace(/[^a-zA-Z\s]/g, "") // Solo letras y espacios
      .trim();
  }

  /**
   * Obtiene información de un certificado existente
   */
  private async obtenerInfoCertificado(crtPath: string): Promise<{ serial: string; validTo: Date }> {
    try {
      // Obtener fecha de expiración
      const dates = await this.ejecutarOpenSSL([
        "x509", "-in", crtPath, "-noout", "-dates"
      ]);
      
      // Obtener serial
      const serial = await this.ejecutarOpenSSL([
        "x509", "-in", crtPath, "-noout", "-serial"
      ]);

      // Parsear fecha de expiración
      const notAfterMatch = dates.match(/notAfter=(.+)/);
      const validTo = notAfterMatch 
        ? new Date(notAfterMatch[1]) 
        : new Date(Date.now() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

      // Parsear serial
      const serialMatch = serial.match(/serial=([A-F0-9]+)/i);
      const serialNumber = serialMatch ? serialMatch[1] : "UNKNOWN";

      return { serial: serialNumber, validTo };
    } catch {
      return { 
        serial: "UNKNOWN", 
        validTo: new Date(Date.now() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000) 
      };
    }
  }

  /**
   * Ejecuta un comando OpenSSL y retorna la salida
   */
  private ejecutarOpenSSL(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proceso = spawn("openssl", args);
      let stdout = "";
      let stderr = "";

      proceso.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proceso.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proceso.on("close", (code) => {
        if (code === 0) {
          resolve(stdout || stderr); // OpenSSL a veces usa stderr para output normal
        } else {
          reject(new Error(`OpenSSL error (code ${code}): ${stderr}`));
        }
      });

      proceso.on("error", (error) => {
        reject(new Error(`No se pudo ejecutar OpenSSL: ${error.message}. Asegúrese de que OpenSSL esté instalado.`));
      });
    });
  }
}

// Exportar instancia singleton
export const pkiService = new PkiService();
