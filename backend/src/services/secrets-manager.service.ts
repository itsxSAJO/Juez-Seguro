// ============================================================================
// JUEZ SEGURO BACKEND - Gestor de Secretos (FCS)
// Servicio singleton para gestionar secretos encriptados en db_secrets
// ============================================================================
// Common Criteria: FCS_CKM (Cryptographic Key Management)
// - Secretos encriptados con AES-256-GCM
// - Clave maestra derivada con PBKDF2 (100,000 iteraciones)
// - La MASTER_KEY nunca se almacena, solo en memoria durante ejecución
// ============================================================================

import crypto from "crypto";
import { Pool, PoolConfig } from "pg";
import { loggers } from "./logger.service.js";

const log = loggers.secrets;

// ============================================================================
// CONSTANTES DE SEGURIDAD
// ============================================================================
const PBKDF2_ITERATIONS = 100000;      // Iteraciones para derivar clave
const PBKDF2_KEY_LENGTH = 32;          // 256 bits para AES-256
const PBKDF2_DIGEST = "sha256";        // Algoritmo de hash
const AES_ALGORITHM = "aes-256-gcm";   // Algoritmo de cifrado
const IV_LENGTH = 12;                   // 12 bytes para GCM (recomendado)
const AUTH_TAG_LENGTH = 16;            // 16 bytes para GCM

// Salt fijo para PBKDF2 (se puede cambiar en producción)
// Este salt se usa para derivar la clave AES desde la MASTER_KEY_PASSWORD
const PBKDF2_SALT = "JuezSeguro_FCS_2026_Salt";

// ============================================================================
// TIPOS
// ============================================================================
export type TipoSecreto = "JWT" | "HMAC" | "AES" | "PKI" | "API" | "SMTP" | "OTRO";

export interface SecretoSistema {
  secretoId: number;
  nombre: string;
  tipo: TipoSecreto;
  descripcion: string | null;
  version: number;
  activo: boolean;
  fechaCreacion: Date;
  fechaRotacion: Date | null;
  fechaExpiracion: Date | null;
}

export interface SecretoDesencriptado extends SecretoSistema {
  valor: string;
}

// ============================================================================
// CLASE: SecretsManager (Singleton)
// ============================================================================
class SecretsManager {
  private static instance: SecretsManager | null = null;
  private pool: Pool | null = null;
  private derivedKey: Buffer | null = null;
  private secretsCache: Map<string, SecretoDesencriptado> = new Map();
  private initialized: boolean = false;

  // Constructor privado para singleton
  private constructor() {}

  /**
   * Obtiene la instancia singleton del gestor de secretos
   */
  public static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Inicializa el gestor de secretos
   * DEBE llamarse antes de usar cualquier otro método
   * 
   * @param masterKeyPassword - Contraseña maestra desde variable de entorno
   * @param dbConfig - Configuración de conexión a db_secrets
   */
  public async initialize(
    masterKeyPassword: string,
    dbConfig: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    }
  ): Promise<void> {
    if (this.initialized) {
      log.debug("Ya está inicializado");
      return;
    }

    // Validar que tenemos la master key
    if (!masterKeyPassword || masterKeyPassword.trim() === "") {
      throw new Error(
        "\n" +
        "╔══════════════════════════════════════════════════════════════════╗\n" +
        "║  ❌ ERROR FATAL: MASTER_KEY_PASSWORD no configurada              ║\n" +
        "╠══════════════════════════════════════════════════════════════════╣\n" +
        "║  Esta variable es OBLIGATORIA para desencriptar los secretos    ║\n" +
        "║  del sistema almacenados en db_secrets.                         ║\n" +
        "╠══════════════════════════════════════════════════════════════════╣\n" +
        "║  Configúrala en el archivo .env:                                ║\n" +
        "║  MASTER_KEY_PASSWORD=tu-clave-maestra-segura                    ║\n" +
        "╚══════════════════════════════════════════════════════════════════╝\n"
      );
    }

    // Derivar clave AES-256 desde la master key usando PBKDF2
    log.info("Derivando clave AES-256 con PBKDF2...");
    this.derivedKey = crypto.pbkdf2Sync(
      masterKeyPassword,
      PBKDF2_SALT,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST
    );

    // Crear pool de conexión a db_secrets
    const poolConfig: PoolConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      max: 5, // Menos conexiones, solo para secretos
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    this.pool = new Pool(poolConfig);

    // Probar conexión
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      log.info("✓ Conexión a db_secrets establecida");
    } catch (error) {
      throw new Error(`[SecretsManager] Error conectando a db_secrets: ${error}`);
    }

    // Marcar como inicializado ANTES de cargar secretos
    // Esto permite que loadAllSecrets y decrypt funcionen
    this.initialized = true;

    // Cargar todos los secretos activos en caché
    await this.loadAllSecrets();

    log.info("✓ Inicializado correctamente");
  }

  /**
   * Verifica si el gestor está inicializado
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.pool || !this.derivedKey) {
      throw new Error(
        "[SecretsManager] No inicializado. Llama a initialize() primero."
      );
    }
  }

  /**
   * Encripta un valor usando AES-256-GCM
   */
  private encrypt(plaintext: string): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
    this.ensureInitialized();

    // Generar IV aleatorio
    const iv = crypto.randomBytes(IV_LENGTH);

    // Crear cipher
    const cipher = crypto.createCipheriv(AES_ALGORITHM, this.derivedKey!, iv);

    // Encriptar
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    // Obtener authentication tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv,
      authTag,
    };
  }

  /**
   * Desencripta un valor usando AES-256-GCM
   */
  private decrypt(ciphertext: Buffer, iv: Buffer, authTag: Buffer): string {
    this.ensureInitialized();

    // Crear decipher
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, this.derivedKey!, iv);
    decipher.setAuthTag(authTag);

    // Desencriptar
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  /**
   * Carga todos los secretos activos desde la BD al caché
   */
  private async loadAllSecrets(): Promise<void> {
    this.ensureInitialized();

    const result = await this.pool!.query(`
      SELECT 
        secreto_id,
        nombre,
        tipo,
        descripcion,
        valor_cifrado,
        iv,
        auth_tag,
        version,
        activo,
        fecha_creacion,
        fecha_rotacion,
        fecha_expiracion
      FROM secretos_sistema
      WHERE activo = TRUE
    `);

    this.secretsCache.clear();

    for (const row of result.rows) {
      try {
        const valorDesencriptado = this.decrypt(
          row.valor_cifrado,
          row.iv,
          row.auth_tag
        );

        const secreto: SecretoDesencriptado = {
          secretoId: row.secreto_id,
          nombre: row.nombre,
          tipo: row.tipo,
          descripcion: row.descripcion,
          valor: valorDesencriptado,
          version: row.version,
          activo: row.activo,
          fechaCreacion: row.fecha_creacion,
          fechaRotacion: row.fecha_rotacion,
          fechaExpiracion: row.fecha_expiracion,
        };

        this.secretsCache.set(row.nombre, secreto);
        log.debug(`✓ Secreto cargado: ${row.nombre}`, { version: row.version });
      } catch (error) {
        log.error(`✗ Error desencriptando secreto ${row.nombre}`, { error: String(error) });
        throw new Error(
          `Error al desencriptar secreto "${row.nombre}". ` +
          `Verifica que MASTER_KEY_PASSWORD sea correcta.`
        );
      }
    }

    log.info(`${this.secretsCache.size} secretos cargados en caché`);
  }

  /**
   * Obtiene un secreto por nombre
   * @param nombre - Nombre del secreto (ej: "JWT_SECRET", "HMAC_SALT")
   * @returns El valor del secreto o null si no existe
   */
  public getSecret(nombre: string): string | null {
    this.ensureInitialized();
    const secreto = this.secretsCache.get(nombre);
    return secreto?.valor ?? null;
  }

  /**
   * Obtiene un secreto requerido (lanza error si no existe)
   * @param nombre - Nombre del secreto
   * @param descripcion - Descripción para el mensaje de error
   */
  public getRequiredSecret(nombre: string, descripcion?: string): string {
    const valor = this.getSecret(nombre);
    if (!valor) {
      const desc = descripcion ? ` (${descripcion})` : "";
      throw new Error(
        `\n` +
        `╔══════════════════════════════════════════════════════════════════╗\n` +
        `║  ❌ ERROR: Secreto no encontrado en db_secrets                   ║\n` +
        `╠══════════════════════════════════════════════════════════════════╣\n` +
        `║  Nombre: ${nombre.padEnd(54)}║\n` +
        `║  ${desc.padEnd(64)}║\n` +
        `╠══════════════════════════════════════════════════════════════════╣\n` +
        `║  Ejecuta el script de migración para crear los secretos:        ║\n` +
        `║  npm run db:migrate-secrets                                     ║\n` +
        `╚══════════════════════════════════════════════════════════════════╝\n`
      );
    }
    return valor;
  }

  /**
   * Obtiene información de un secreto (sin el valor)
   */
  public getSecretInfo(nombre: string): SecretoSistema | null {
    this.ensureInitialized();
    const secreto = this.secretsCache.get(nombre);
    if (!secreto) return null;

    // Retornar sin el valor
    const { valor, ...info } = secreto;
    return info;
  }

  /**
   * Lista todos los nombres de secretos disponibles
   */
  public listSecretNames(): string[] {
    this.ensureInitialized();
    return Array.from(this.secretsCache.keys());
  }

  /**
   * Crea un nuevo secreto en la BD
   */
  public async createSecret(
    nombre: string,
    valor: string,
    tipo: TipoSecreto,
    descripcion?: string,
    creadoPor?: string
  ): Promise<SecretoSistema> {
    this.ensureInitialized();

    // Encriptar el valor
    const { ciphertext, iv, authTag } = this.encrypt(valor);

    const result = await this.pool!.query(
      `INSERT INTO secretos_sistema 
        (nombre, tipo, descripcion, valor_cifrado, iv, auth_tag, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING secreto_id, nombre, tipo, descripcion, version, activo, 
                 fecha_creacion, fecha_rotacion, fecha_expiracion`,
      [nombre, tipo, descripcion, ciphertext, iv, authTag, creadoPor]
    );

    const row = result.rows[0];
    const secreto: SecretoDesencriptado = {
      secretoId: row.secreto_id,
      nombre: row.nombre,
      tipo: row.tipo,
      descripcion: row.descripcion,
      valor,
      version: row.version,
      activo: row.activo,
      fechaCreacion: row.fecha_creacion,
      fechaRotacion: row.fecha_rotacion,
      fechaExpiracion: row.fecha_expiracion,
    };

    // Agregar al caché
    this.secretsCache.set(nombre, secreto);

    log.info(`✓ Secreto creado: ${nombre}`);
    
    const { valor: _, ...info } = secreto;
    return info;
  }

  /**
   * Rota un secreto (crea nueva versión)
   */
  public async rotateSecret(
    nombre: string,
    nuevoValor: string,
    motivo: string,
    ejecutadoPor: string,
    ipOrigen?: string,
    userAgent?: string
  ): Promise<SecretoSistema> {
    this.ensureInitialized();

    const client = await this.pool!.connect();

    try {
      await client.query("BEGIN");

      // Obtener secreto actual
      const currentResult = await client.query(
        "SELECT secreto_id, version FROM secretos_sistema WHERE nombre = $1 AND activo = TRUE",
        [nombre]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Secreto "${nombre}" no encontrado`);
      }

      const { secreto_id, version: versionAnterior } = currentResult.rows[0];
      const nuevaVersion = versionAnterior + 1;

      // Encriptar nuevo valor
      const { ciphertext, iv, authTag } = this.encrypt(nuevoValor);

      // Actualizar secreto
      await client.query(
        `UPDATE secretos_sistema 
         SET valor_cifrado = $1, iv = $2, auth_tag = $3, 
             version = $4, fecha_rotacion = CURRENT_TIMESTAMP,
             modificado_por = $5
         WHERE secreto_id = $6`,
        [ciphertext, iv, authTag, nuevaVersion, ejecutadoPor, secreto_id]
      );

      // Registrar en historial
      await client.query(
        `SELECT registrar_rotacion($1, $2, $3, $4, $5::inet, $6, $7)`,
        [secreto_id, versionAnterior, nuevaVersion, motivo, ipOrigen, userAgent, ejecutadoPor]
      );

      await client.query("COMMIT");

      // Actualizar caché
      const secretoCached = this.secretsCache.get(nombre);
      if (secretoCached) {
        secretoCached.valor = nuevoValor;
        secretoCached.version = nuevaVersion;
        secretoCached.fechaRotacion = new Date();
      }

      log.info(`✓ Secreto rotado: ${nombre}`, { versionAnterior, nuevaVersion });

      return this.getSecretInfo(nombre)!;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Recarga los secretos desde la BD (útil tras rotación externa)
   */
  public async reloadSecrets(): Promise<void> {
    this.ensureInitialized();
    log.info("Recargando secretos...");
    await this.loadAllSecrets();
  }

  /**
   * Verifica la conexión a db_secrets
   */
  public async testConnection(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cierra la conexión a la BD
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.secretsCache.clear();
    this.derivedKey = null;
    this.initialized = false;
    log.info("Conexión cerrada");
  }

  /**
   * Verifica si el gestor está inicializado
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// EXPORTAR SINGLETON
// ============================================================================
export const secretsManager = SecretsManager.getInstance();
export default secretsManager;
