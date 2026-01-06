// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Documentos (FDP)
// Protección de datos con control de acceso
// HU-SJ-002: Incorporación de Documentos con Integridad
// ============================================================================

import { casesPool, usersPool } from "../db/connection.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { auditService } from "./audit.service.js";
import type { Documento, TipoDocumento } from "../types/index.js";

// ============================================================================
// CONSTANTES DE SEGURIDAD
// ============================================================================

// Magic Numbers para validación de tipo de archivo
const PDF_MAGIC_NUMBERS = [
  Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF (PDF 1.0 - 1.7)
];

// Directorio de almacenamiento seguro
const SECURE_DOCS_DIR = process.env.SECURE_DOCS_PATH || "./secure_docs_storage";

// Extensiones permitidas (whitelist)
const ALLOWED_EXTENSIONS = [".pdf"];

// Tamaño máximo de archivo (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ============================================================================
// INTERFACES
// ============================================================================

interface SubirDocumentoInput {
  causaId: string;
  tipo: TipoDocumento;
  nombreOriginal: string; // Nombre original del usuario (solo para referencia)
  contenido: Buffer;
  usuarioId: number;
  usuarioCorreo: string;
  ipOrigen: string;
  userAgent: string;
}

interface ValidacionArchivoResult {
  valido: boolean;
  error?: string;
  codigo?: "EXTENSION_INVALIDA" | "MAGIC_NUMBER_INVALIDO" | "ARCHIVO_VACIO" | "TAMANO_EXCEDIDO";
}

/**
 * Servicio de Documentos - FDP
 * Implementa control de acceso y hash de integridad
 * HU-SJ-002: Validación de archivos, almacenamiento seguro y auditoría
 */
class DocumentosService {
  // ==========================================================================
  // MÉTODOS DE VALIDACIÓN (HU-SJ-002)
  // ==========================================================================

  /**
   * Valida la extensión del archivo (whitelist)
   * @param nombreArchivo - Nombre del archivo con extensión
   * @returns true si la extensión está permitida
   */
  private validarExtension(nombreArchivo: string): boolean {
    const extension = path.extname(nombreArchivo).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(extension);
  }

  /**
   * Verifica los Magic Numbers (cabecera) del archivo
   * Detecta archivos ejecutables renombrados como PDF
   * @param contenido - Buffer del archivo
   * @returns true si es un PDF válido
   */
  private verificarMagicNumbers(contenido: Buffer): boolean {
    if (contenido.length < 4) return false;

    // Verificar si el archivo comienza con %PDF
    for (const magicNumber of PDF_MAGIC_NUMBERS) {
      if (contenido.subarray(0, magicNumber.length).equals(magicNumber)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Valida el archivo completo antes de subirlo
   * @param nombreOriginal - Nombre del archivo proporcionado por el usuario
   * @param contenido - Buffer del archivo
   * @returns Resultado de la validación
   */
  private validarArchivo(nombreOriginal: string, contenido: Buffer): ValidacionArchivoResult {
    // 1. Validar que no esté vacío
    if (!contenido || contenido.length === 0) {
      return {
        valido: false,
        error: "El archivo está vacío",
        codigo: "ARCHIVO_VACIO",
      };
    }

    // 2. Validar tamaño máximo
    if (contenido.length > MAX_FILE_SIZE) {
      return {
        valido: false,
        error: `El archivo excede el tamaño máximo permitido (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        codigo: "TAMANO_EXCEDIDO",
      };
    }

    // 3. Validar extensión (whitelist)
    if (!this.validarExtension(nombreOriginal)) {
      return {
        valido: false,
        error: "Solo se permiten archivos PDF (.pdf)",
        codigo: "EXTENSION_INVALIDA",
      };
    }

    // 4. Verificar Magic Numbers (cabecera del archivo)
    if (!this.verificarMagicNumbers(contenido)) {
      return {
        valido: false,
        error: "El archivo no es un PDF válido (magic numbers no coinciden)",
        codigo: "MAGIC_NUMBER_INVALIDO",
      };
    }

    return { valido: true };
  }

  /**
   * Genera hash SHA-256 de integridad para el documento
   * @param contenido - Buffer del archivo
   * @returns Hash en formato hexadecimal
   */
  private generarHash(contenido: Buffer): string {
    return crypto.createHash("sha256").update(contenido).digest("hex");
  }

  /**
   * Genera un nombre de archivo seguro usando GUID
   * Evita colisiones y ejecución directa de scripts
   * @returns Nombre de archivo seguro con extensión .pdf
   */
  private generarNombreSeguro(): string {
    return `${uuidv4()}.pdf`;
  }

  /**
   * Inicializa el directorio de almacenamiento seguro
   */
  private async inicializarAlmacenamiento(): Promise<void> {
    try {
      await fs.mkdir(SECURE_DOCS_DIR, { recursive: true });
    } catch (error) {
      console.error("Error al crear directorio de almacenamiento:", error);
      throw new Error("No se pudo inicializar el almacenamiento de documentos");
    }
  }

  // ==========================================================================
  // MÉTODOS DE NEGOCIO
  // ==========================================================================

  /**
   * Sube un documento a una causa con validaciones de seguridad
   * HU-SJ-002: Validación previa, cálculo de hash, almacenamiento seguro y auditoría
   * @param input - Datos del documento
   * @returns Documento creado
   */
  async subirDocumento(input: SubirDocumentoInput): Promise<Documento> {
    // -----------------------------------------------------------------------
    // PASO 1: VALIDACIÓN PREVIA (Whitelist + Magic Numbers)
    // -----------------------------------------------------------------------
    const validacion = this.validarArchivo(input.nombreOriginal, input.contenido);

    if (!validacion.valido) {
      // Auditar intento de subida de archivo inválido
      await auditService.log({
        tipoEvento: "ARCHIVO_RECHAZADO",
        usuarioId: input.usuarioId,
        usuarioCorreo: input.usuarioCorreo,
        moduloAfectado: "DOCUMENTOS",
        descripcion: `[MEDIA] Intento de subir archivo inválido: ${validacion.error}`,
        datosAfectados: {
          nombreOriginal: input.nombreOriginal,
          causaId: input.causaId,
          tipo: input.tipo,
          tamanoBytes: input.contenido.length,
          codigoError: validacion.codigo,
        },
        ipOrigen: input.ipOrigen,
        userAgent: input.userAgent,
      });

      throw new Error(validacion.error);
    }

    // -----------------------------------------------------------------------
    // PASO 2: CÁLCULO DE HASH (Integridad)
    // -----------------------------------------------------------------------
    const hashIntegridad = this.generarHash(input.contenido);
    const tamanioBytes = input.contenido.length;

    // -----------------------------------------------------------------------
    // PASO 3: ALMACENAMIENTO SEGURO (GUID + Filesystem)
    // -----------------------------------------------------------------------
    await this.inicializarAlmacenamiento();

    const documentoId = uuidv4();
    const nombreSeguro = this.generarNombreSeguro();
    const rutaRelativa = path.join(input.causaId, nombreSeguro);
    const rutaAbsoluta = path.join(SECURE_DOCS_DIR, input.causaId, nombreSeguro);

    // Crear subdirectorio para la causa si no existe
    await fs.mkdir(path.dirname(rutaAbsoluta), { recursive: true });

    // Escribir archivo en el filesystem
    await fs.writeFile(rutaAbsoluta, input.contenido);

    // -----------------------------------------------------------------------
    // PASO 4: PERSISTENCIA DE METADATOS (db_casos)
    // -----------------------------------------------------------------------
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `INSERT INTO documentos (
          id, causa_id, tipo, nombre, ruta, hash_integridad,
          tamanio_bytes, mime_type, subido_por_id, fecha_subida, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'activo')
        RETURNING *`,
        [
          documentoId,
          input.causaId,
          input.tipo,
          input.nombreOriginal, // Guardar nombre original para referencia
          rutaRelativa, // Ruta relativa al directorio seguro
          hashIntegridad,
          tamanioBytes,
          "application/pdf",
          input.usuarioId,
        ]
      );

      const documento = this.mapearDocumento(result.rows[0]);

      // -------------------------------------------------------------------
      // PASO 5: AUDITORÍA (db_logs)
      // -------------------------------------------------------------------
      await auditService.log({
        tipoEvento: "DOCUMENTO_SUBIDO",
        usuarioId: input.usuarioId,
        usuarioCorreo: input.usuarioCorreo,
        moduloAfectado: "DOCUMENTOS",
        descripcion: `[BAJA] Documento subido exitosamente`,
        datosAfectados: {
          documentoId,
          causaId: input.causaId,
          tipo: input.tipo,
          nombreOriginal: input.nombreOriginal,
          nombreSeguro,
          hashIntegridad,
          tamanioBytes,
          rutaAlmacenamiento: rutaRelativa,
        },
        ipOrigen: input.ipOrigen,
        userAgent: input.userAgent,
      });

      return documento;
    } catch (error) {
      // Si falla la inserción en BD, eliminar archivo del filesystem
      try {
        await fs.unlink(rutaAbsoluta);
      } catch (unlinkError) {
        console.error("Error al eliminar archivo tras fallo en BD:", unlinkError);
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene documentos de una causa con el nombre del secretario que los subió
   */
  async getDocumentosByCausa(causaId: string): Promise<Documento[]> {
    const casesClient = await casesPool.connect();
    const usersClient = await usersPool.connect();

    try {
      // 1. Obtener documentos de la causa
      const docsResult = await casesClient.query(
        `SELECT *
         FROM documentos
         WHERE causa_id = $1 AND estado = 'activo'
         ORDER BY fecha_subida DESC`,
        [causaId]
      );

      // 2. Obtener IDs únicos de funcionarios
      const funcionarioIds = [...new Set(docsResult.rows.map(d => d.subido_por_id).filter(Boolean))];

      // 3. Obtener nombres de funcionarios desde db_usuarios
      // Generamos pseudónimo como "SECRETARIO-XXXX" para proteger identidad
      let funcionariosMap: Record<number, string> = {};
      if (funcionarioIds.length > 0) {
        const funcionariosResult = await usersClient.query(
          `SELECT funcionario_id, nombres_completos FROM funcionarios WHERE funcionario_id = ANY($1)`,
          [funcionarioIds]
        );
        funcionariosMap = funcionariosResult.rows.reduce((acc, f) => {
          // Generar pseudónimo para proteger identidad del secretario
          acc[f.funcionario_id] = `SECRETARIO-${String(f.funcionario_id).padStart(4, '0')}`;
          return acc;
        }, {} as Record<number, string>);
      }

      // 4. Mapear documentos con pseudónimos de secretarios
      return docsResult.rows.map(row => {
        const pseudonimo = funcionariosMap[row.subido_por_id] || `SECRETARIO-${String(row.subido_por_id).padStart(4, '0')}`;
        return {
          ...this.mapearDocumento(row),
          subidoPor: pseudonimo,
          subidoPorNombre: pseudonimo,
        };
      });
    } finally {
      casesClient.release();
      usersClient.release();
    }
  }

  /**
   * Obtiene un documento por ID con pseudónimo del secretario
   */
  async getDocumentoById(id: string): Promise<Documento | null> {
    const casesClient = await casesPool.connect();

    try {
      const result = await casesClient.query(
        `SELECT *
         FROM documentos
         WHERE id = $1`,
        [id]
      );

      if (!result.rows[0]) return null;

      const doc = result.rows[0];
      // Generar pseudónimo para proteger identidad del secretario
      const pseudonimo = `SECRETARIO-${String(doc.subido_por_id).padStart(4, '0')}`;

      return {
        ...this.mapearDocumento(doc),
        subidoPor: pseudonimo,
        subidoPorNombre: pseudonimo,
      };
    } finally {
      casesClient.release();
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
   * Verifica si una causa pertenece a la unidad judicial y materia del secretario
   * @param causaId - ID de la causa
   * @param unidadJudicial - Unidad judicial del secretario
   * @param materia - Materia del secretario
   * @returns Datos de la causa si tiene acceso, null si no
   */
  async verificarAccesoCausa(
    causaId: string,
    unidadJudicial: string,
    materia: string
  ): Promise<{ causa_id: string; unidad_judicial: string; materia: string } | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        `SELECT causa_id, unidad_judicial, materia
         FROM causas
         WHERE causa_id = $1
           AND LOWER(TRIM(unidad_judicial)) = LOWER(TRIM($2))
           AND LOWER(TRIM(materia)) = LOWER(TRIM($3))`,
        [causaId, unidadJudicial, materia]
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
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
   * Obtiene el contenido binario del documento para descarga
   * HU-SJ-002: Lectura segura desde almacenamiento GUID
   * @param id - ID del documento (UUID)
   * @returns Contenido del archivo y metadatos, o null si no existe
   */
  async obtenerContenido(id: string): Promise<{
    contenido: Buffer;
    nombre: string;
    mimeType: string;
  } | null> {
    const documento = await this.getDocumentoById(id);
    if (!documento || !documento.ruta) return null;

    const rutaAbsoluta = path.join(SECURE_DOCS_DIR, documento.ruta);

    try {
      const contenido = await fs.readFile(rutaAbsoluta);
      return {
        contenido,
        nombre: documento.nombre,
        mimeType: documento.mimeType || "application/pdf",
      };
    } catch (error) {
      console.error(`Error al leer archivo ${rutaAbsoluta}:`, error);
      return null;
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
      subidoPor: row.subido_por_nombre || `SECRETARIO-${String(row.subido_por_id).padStart(4, '0')}`,
      subidoPorNombre: row.subido_por_nombre || `SECRETARIO-${String(row.subido_por_id).padStart(4, '0')}`,
      fecha_subida: row.fecha_subida,
      fechaSubida: row.fecha_subida,
      estado: row.estado,
    };
  }
}

export const documentosService = new DocumentosService();
export default documentosService;
