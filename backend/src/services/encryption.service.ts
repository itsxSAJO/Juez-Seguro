// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Encriptación de Datos Sensibles
// Encriptación AES-256-GCM para datos de funcionarios en BD
// ============================================================================

import crypto from "crypto";
import { secretsManager } from "./secrets-manager.service.js";
import { loggers } from "./logger.service.js";

const log = loggers.system;

// Configuración de encriptación
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Prefijo para identificar datos encriptados
const ENCRYPTED_PREFIX = "ENC:";

/**
 * Servicio de encriptación para datos sensibles en la base de datos
 * Usa AES-256-GCM para encriptación autenticada
 */
class EncryptionService {
  private encryptionKey: Buffer | null = null;

  constructor() {
    this.initializeKey();
  }

  /**
   * Inicializa la clave de encriptación desde secrets manager
   */
  private initializeKey(): void {
    try {
      let keyBase: string | null = null;
      
      // Intentar obtener desde secretsManager (puede no estar inicializado)
      try {
        keyBase = secretsManager.getSecret("DATA_ENCRYPTION_KEY");
        
        if (!keyBase) {
          keyBase = secretsManager.getSecret("DOCS_ENCRYPTION_KEY");
        }
      } catch {
        // secretsManager no inicializado, continuar con fallbacks
      }
      
      if (!keyBase) {
        // Fallback: usar variable de entorno
        keyBase = process.env.DATA_ENCRYPTION_KEY || process.env.DOCS_ENCRYPTION_KEY || null;
      }

      if (keyBase) {
        // Derivar una clave de 256 bits usando PBKDF2
        this.encryptionKey = crypto.pbkdf2Sync(
          keyBase,
          "juez-seguro-db-encryption-salt-v1",
          100000, // Iteraciones altas para seguridad
          KEY_LENGTH,
          "sha256"
        );
        log.info("✅ Clave de encriptación de datos inicializada (AES-256-GCM)");
      } else {
        log.warn("⚠️ No se encontró clave de encriptación - generando una temporal");
        // En desarrollo, generar clave temporal (NO USAR EN PRODUCCIÓN)
        this.encryptionKey = crypto.pbkdf2Sync(
          "desarrollo-temporal-key-no-usar-en-produccion",
          "juez-seguro-db-encryption-salt-v1",
          100000,
          KEY_LENGTH,
          "sha256"
        );
      }
    } catch (error) {
      log.error("Error al inicializar clave de encriptación:", error);
      throw new Error("No se pudo inicializar la encriptación de datos");
    }
  }

  /**
   * Reinicializa la clave (útil después de cargar secretos)
   */
  reinitializeKey(): void {
    this.initializeKey();
  }

  /**
   * Encripta un texto plano
   * @param plaintext - Texto a encriptar
   * @returns Texto encriptado en formato: ENC:iv:authTag:ciphertext (base64)
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext || plaintext.trim() === "") {
      return null;
    }

    // Si ya está encriptado, devolverlo sin cambios
    if (plaintext.startsWith(ENCRYPTED_PREFIX)) {
      return plaintext;
    }

    if (!this.encryptionKey) {
      throw new Error("Clave de encriptación no inicializada");
    }

    try {
      // Generar IV aleatorio
      const iv = crypto.randomBytes(IV_LENGTH);

      // Crear cifrador
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      // Encriptar
      let encrypted = cipher.update(plaintext, "utf8", "base64");
      encrypted += cipher.final("base64");

      // Obtener tag de autenticación
      const authTag = cipher.getAuthTag();

      // Formato: ENC:iv:authTag:ciphertext (todo en base64)
      return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
    } catch (error) {
      log.error("Error al encriptar dato:", error);
      throw new Error("Error de encriptación");
    }
  }

  /**
   * Desencripta un texto encriptado
   * @param ciphertext - Texto encriptado en formato ENC:iv:authTag:ciphertext
   * @returns Texto plano original
   */
  decrypt(ciphertext: string | null | undefined): string | null {
    if (!ciphertext || ciphertext.trim() === "") {
      return null;
    }

    // Si no está encriptado, devolverlo sin cambios
    if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
      return ciphertext;
    }

    if (!this.encryptionKey) {
      throw new Error("Clave de encriptación no inicializada");
    }

    try {
      // Remover prefijo y parsear componentes
      const parts = ciphertext.slice(ENCRYPTED_PREFIX.length).split(":");
      if (parts.length !== 3) {
        throw new Error("Formato de dato encriptado inválido");
      }

      const iv = Buffer.from(parts[0], "base64");
      const authTag = Buffer.from(parts[1], "base64");
      const encrypted = parts[2];

      // Crear descifrador
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      // Desencriptar
      let decrypted = decipher.update(encrypted, "base64", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      log.error("Error al desencriptar dato:", error);
      // En caso de error, devolver el texto original (puede ser dato no encriptado legacy)
      return ciphertext;
    }
  }

  /**
   * Verifica si un texto está encriptado
   */
  isEncrypted(text: string | null | undefined): boolean {
    return text?.startsWith(ENCRYPTED_PREFIX) ?? false;
  }

  /**
   * Encripta campos sensibles de un objeto funcionario
   * NOTA: correo_institucional NO se encripta para permitir búsquedas en login
   */
  encryptFuncionarioData(data: {
    identificacion?: string;
    nombres_completos?: string;
    correo_institucional?: string;
    [key: string]: any;
  }): typeof data {
    return {
      ...data,
      identificacion: data.identificacion ? this.encrypt(data.identificacion) ?? undefined : data.identificacion,
      nombres_completos: data.nombres_completos ? this.encrypt(data.nombres_completos) ?? undefined : data.nombres_completos,
      // correo_institucional NO se encripta - necesario para búsqueda en login
    };
  }

  /**
   * Desencripta campos sensibles de un objeto funcionario
   * NOTA: correo_institucional no está encriptado
   */
  decryptFuncionarioData(data: {
    identificacion?: string;
    nombres_completos?: string;
    correo_institucional?: string;
    [key: string]: any;
  }): typeof data {
    return {
      ...data,
      identificacion: this.decrypt(data.identificacion) ?? data.identificacion,
      nombres_completos: this.decrypt(data.nombres_completos) ?? data.nombres_completos,
      // correo_institucional no necesita desencriptación
    };
  }

  /**
   * Encripta un array de funcionarios
   */
  encryptFuncionariosArray(funcionarios: any[]): any[] {
    return funcionarios.map((f) => this.encryptFuncionarioData(f));
  }

  /**
   * Desencripta un array de funcionarios
   */
  decryptFuncionariosArray(funcionarios: any[]): any[] {
    return funcionarios.map((f) => this.decryptFuncionarioData(f));
  }
}

export const encryptionService = new EncryptionService();
export default encryptionService;
