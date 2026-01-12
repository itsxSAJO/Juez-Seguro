// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Pseudónimos (FDP)
// Generación de códigos irreversibles para protección de identidad de jueces
// Tabla: mapa_pseudonimos en db_casos
// ============================================================================

import crypto from "crypto";
import { casesPool } from "../db/connection.js";
import { config } from "../config/index.js";
import { auditService } from "./audit.service.js";

/**
 * Servicio de Pseudónimos - FDP (Functional Data Protection)
 * Implementa protección de identidad de jueces mediante códigos irreversibles
 * Usa HMAC-SHA256 para garantizar que el pseudónimo no pueda ser revertido
 */
class PseudonimosService {
  /**
   * Cache del secreto HMAC (lazy loading)
   * Se carga en el primer uso, después de que SecretsManager esté inicializado
   */
  private _hmacSecret: string | null = null;

  /**
   * Obtiene el secreto HMAC de forma lazy
   * Esto permite que el servicio se instancie antes de SecretsManager
   */
  private get HMAC_SECRET(): string {
    if (!this._hmacSecret) {
      this._hmacSecret = config.security.pseudonimoHmacSecret;
    }
    return this._hmacSecret;
  }

  /**
   * Genera un pseudónimo único e irreversible para un juez
   * Usa HMAC-SHA256(JuezID + Salt + Timestamp) para máxima seguridad
   * 
   * @param juezId - ID del funcionario con rol JUEZ
   * @returns Pseudónimo en formato "JUEZ-XXXXXX" (6 caracteres alfanuméricos)
   */
  generatePseudonimo(juezId: number): string {
    // Crear datos para HMAC: ID + timestamp para unicidad adicional
    const data = `${juezId}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    
    // Generar HMAC-SHA256
    const hmac = crypto.createHmac("sha256", this.HMAC_SECRET);
    hmac.update(data);
    const hash = hmac.digest("hex");
    
    // Tomar los primeros 8 caracteres y convertir a formato amigable
    // Usamos Base36 (0-9, A-Z) para legibilidad
    const shortCode = hash.substring(0, 8).toUpperCase();
    
    return `JUEZ-${shortCode}`;
  }

  /**
   * Crea y almacena un pseudónimo para un juez nuevo
   * DEBE ser llamado inmediatamente al crear un funcionario con rol JUEZ
   * 
   * @param juezId - ID del funcionario juez en db_usuarios
   * @param adminId - ID del administrador que crea el usuario
   * @param ip - IP de origen
   * @param userAgent - User agent
   * @returns El pseudónimo generado
   */
  async crearPseudonimoJuez(
    juezId: number,
    adminId: number,
    ip: string,
    userAgent: string
  ): Promise<string> {
    const client = await casesPool.connect();

    try {
      // Verificar que no exista ya un pseudónimo para este juez
      const existe = await client.query(
        "SELECT pseudonimo_publico FROM mapa_pseudonimos WHERE juez_id_real = $1",
        [juezId]
      );

      if (existe.rows.length > 0) {
        // Ya existe, retornar el existente
        return existe.rows[0].pseudonimo_publico;
      }

      // Generar nuevo pseudónimo
      let pseudonimo: string;
      let intentos = 0;
      const maxIntentos = 10;

      // Asegurar unicidad del pseudónimo
      do {
        pseudonimo = this.generatePseudonimo(juezId);
        
        const duplicado = await client.query(
          "SELECT mapa_id FROM mapa_pseudonimos WHERE pseudonimo_publico = $1",
          [pseudonimo]
        );

        if (duplicado.rows.length === 0) {
          break; // Pseudónimo único encontrado
        }

        intentos++;
      } while (intentos < maxIntentos);

      if (intentos >= maxIntentos) {
        throw new Error("No se pudo generar un pseudónimo único después de múltiples intentos");
      }

      // Insertar en mapa_pseudonimos
      await client.query(
        `INSERT INTO mapa_pseudonimos (juez_id_real, pseudonimo_publico)
         VALUES ($1, $2)`,
        [juezId, pseudonimo]
      );

      // Registrar en auditoría (sin revelar la relación ID-pseudónimo)
      await auditService.log({
        tipoEvento: "CREACION_PSEUDONIMO",
        usuarioId: adminId,
        moduloAfectado: "ADMIN",
        descripcion: `Pseudónimo generado para nuevo juez`,
        datosAfectados: { 
          // NO incluir juezId para mantener la privacidad
          pseudonimoGenerado: true 
        },
        ipOrigen: ip,
        userAgent,
      });

      return pseudonimo;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el pseudónimo de un juez por su ID real
   * SOLO debe usarse internamente, nunca exponer la relación en APIs públicas
   * 
   * @param juezId - ID real del juez
   * @returns Pseudónimo o null si no existe
   */
  async getPseudonimoByJuezId(juezId: number): Promise<string | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        "SELECT pseudonimo_publico FROM mapa_pseudonimos WHERE juez_id_real = $1",
        [juezId]
      );

      return result.rows[0]?.pseudonimo_publico || null;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica si un juez ya tiene pseudónimo asignado
   * 
   * @param juezId - ID del juez
   * @returns true si ya tiene pseudónimo
   */
  async tienePseudonimo(juezId: number): Promise<boolean> {
    const pseudonimo = await this.getPseudonimoByJuezId(juezId);
    return pseudonimo !== null;
  }

  /**
   * Obtiene estadísticas de pseudónimos (solo para admin)
   */
  async getEstadisticas(): Promise<{ totalPseudonimos: number }> {
    const client = await casesPool.connect();

    try {
      const result = await client.query("SELECT COUNT(*) as total FROM mapa_pseudonimos");
      return {
        totalPseudonimos: parseInt(result.rows[0].total, 10),
      };
    } finally {
      client.release();
    }
  }
}

export const pseudonimosService = new PseudonimosService();
export default pseudonimosService;
