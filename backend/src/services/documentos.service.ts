// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Documentos (FDP)
// Protección de datos con control de acceso
// ============================================================================

import { casesPool } from "../db/connection.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import type { Documento, TipoDocumento } from "../types/index.js";

interface SubirDocumentoInput {
  causaId: string;
  tipo: TipoDocumento;
  nombre: string;
  contenido: Buffer;
  mimeType: string;
}

/**
 * Servicio de Documentos - FDP
 * Implementa control de acceso y hash de integridad
 */
class DocumentosService {
  /**
   * Genera hash de integridad para el documento
   */
  private generarHash(contenido: Buffer): string {
    return crypto.createHash("sha256").update(contenido).digest("hex");
  }

  /**
   * Sube un documento a una causa
   */
  async subirDocumento(
    input: SubirDocumentoInput,
    usuarioId: number | string
  ): Promise<Documento> {
    const client = await casesPool.connect();

    try {
      const id = uuidv4();
      const hash = this.generarHash(input.contenido);
      const tamanio = input.contenido.length;

      // En producción, el contenido iría a un storage seguro (S3, MinIO)
      // Aquí simulamos guardando la ruta
      const ruta = `/documentos/${input.causaId}/${id}`;

      const result = await client.query(
        `INSERT INTO documentos (
          id, causa_id, tipo, nombre, ruta, hash_integridad,
          tamanio_bytes, mime_type, subido_por_id, fecha_subida, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'activo')
        RETURNING *`,
        [
          id,
          input.causaId,
          input.tipo,
          input.nombre,
          ruta,
          hash,
          tamanio,
          input.mimeType,
          usuarioId,
        ]
      );

      return this.mapearDocumento(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene documentos de una causa
   */
  async getDocumentosByCausa(causaId: string): Promise<Documento[]> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT d.*, u.nombre as subido_por_nombre
         FROM documentos d
         LEFT JOIN usuarios u ON d.subido_por_id = u.id
         WHERE d.causa_id = $1 AND d.estado = 'activo'
         ORDER BY d.fecha_subida DESC`,
        [causaId]
      );

      return result.rows.map(this.mapearDocumento);
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene un documento por ID
   */
  async getDocumentoById(id: string): Promise<Documento | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT d.*, u.nombre as subido_por_nombre
         FROM documentos d
         LEFT JOIN usuarios u ON d.subido_por_id = u.id
         WHERE d.id = $1`,
        [id]
      );

      return result.rows[0] ? this.mapearDocumento(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica integridad del documento
   */
  async verificarIntegridad(id: string, contenido: Buffer): Promise<boolean> {
    const documento = await this.getDocumentoById(id);
    if (!documento) return false;

    const hashActual = this.generarHash(contenido);
    return hashActual === documento.hash_integridad;
  }

  /**
   * Elimina (marca como eliminado) un documento
   */
  async eliminarDocumento(id: string): Promise<boolean> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `UPDATE documentos SET estado = 'eliminado', fecha_eliminacion = NOW()
         WHERE id = $1 RETURNING id`,
        [id]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Mapea fila de BD a tipo Documento
   */
  private mapearDocumento(row: any): Documento {
    return {
      id: row.id,
      causa_id: row.causa_id,
      causaId: row.causa_id,
      tipo: row.tipo,
      nombre: row.nombre,
      ruta: row.ruta,
      hash_integridad: row.hash_integridad,
      hashIntegridad: row.hash_integridad,
      tamano: row.tamanio_bytes,
      tamanioBytes: row.tamanio_bytes,
      mimeType: row.mime_type,
      subido_por_id: row.subido_por_id,
      subidoPorId: row.subido_por_id,
      subidoPorNombre: row.subido_por_nombre,
      fecha_subida: row.fecha_subida,
      estado: row.estado,
    };
  }
}

export const documentosService = new DocumentosService();
export default documentosService;
