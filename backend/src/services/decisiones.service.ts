// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Decisiones Judiciales (Sprint 3)
// HU-JZ-003: Elaboración y firma de autos, providencias y sentencias
// ============================================================================
// Implementa:
// - Flujo de estados: BORRADOR → LISTA_PARA_FIRMA → FIRMADA
// - Control de acceso basado en atributos (FIA_ATD.1, FIA_USB.1)
// - Inmutabilidad post-firma (WORM)
// - Pseudonimización de jueces (FDP)
// ============================================================================

import { casesPool } from "../db/connection.js";
import { auditService } from "./audit.service.js";
import { firmaService } from "./firma.service.js";
import { pseudonimosService } from "./pseudonimos.service.js";
import { loggers } from "./logger.service.js";
import crypto from "crypto";

const log = loggers.documentos;
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  DecisionJudicial,
  DecisionJudicialPublica,
  CrearDecisionInput,
  ActualizarDecisionInput,
  TipoDecision,
  EstadoDecision,
  HistorialDecision,
  MetadatosFirma,
} from "../types/index.js";

// ============================================================================
// CONFIGURACIÓN - Almacenamiento unificado con documentos del expediente
// ============================================================================

const DECISIONES_STORAGE_PATH = process.env.SECURE_DOCS_PATH || "./secure_docs_storage";

// ============================================================================
// INTERFACES INTERNAS
// ============================================================================

interface FiltrosDecisiones {
  causaId?: number;
  juezAutorId?: number;
  tipoDecision?: TipoDecision;
  estado?: EstadoDecision;
  page?: number;
  pageSize?: number;
}

interface ContextoUsuario {
  funcionarioId: number;
  correo: string;
  rol: string;
  unidadJudicial: string;
  materia: string;
}

// ============================================================================
// SERVICIO DE DECISIONES JUDICIALES
// ============================================================================

class DecisionesService {
  /**
   * Inicializa el directorio de almacenamiento para PDFs firmados
   */
  private async inicializarAlmacenamiento(): Promise<void> {
    try {
      await fs.mkdir(DECISIONES_STORAGE_PATH, { recursive: true });
    } catch (error) {
      log.error("Error al crear directorio de almacenamiento:", error);
    }
  }

  /**
   * Mapea un registro de BD a la interfaz DecisionJudicial
   */
  private mapearDecision(row: any): DecisionJudicial {
    return {
      decisionId: row.decision_id,
      causaId: row.causa_id,
      numeroProceso: row.numero_proceso,
      juezAutorId: row.juez_autor_id,
      juezPseudonimo: row.juez_pseudonimo,
      tipoDecision: row.tipo_decision,
      titulo: row.titulo,
      contenidoBorrador: row.contenido_borrador,
      estado: row.estado,
      version: row.version,
      fechaFirma: row.fecha_firma,
      rutaPdfFirmado: row.ruta_pdf_firmado,
      hashIntegridadPdf: row.hash_integridad_pdf,
      certificadoFirmante: row.certificado_firmante,
      numeroSerieCertificado: row.numero_serie_certificado,
      algoritmoFirma: row.algoritmo_firma,
      firmaBase64: row.firma_base64,
      documentoId: row.documento_id,
      fechaCreacion: row.fecha_creacion,
      fechaActualizacion: row.fecha_actualizacion,
      ipCreacion: row.ip_creacion,
    };
  }

  /**
   * Mapea a vista pública (sin datos sensibles)
   */
  private mapearDecisionPublica(row: any): DecisionJudicialPublica {
    return {
      decisionId: row.decision_id,
      causaId: row.causa_id,
      numeroProceso: row.numero_proceso,
      tipoDecision: row.tipo_decision,
      titulo: row.titulo,
      estado: row.estado,
      juezPseudonimo: row.juez_pseudonimo,
      fechaCreacion: row.fecha_creacion,
      fechaFirma: row.fecha_firma,
      version: row.version,
    };
  }

  // ==========================================================================
  // VALIDACIONES DE SEGURIDAD (FIA_ATD.1, FIA_USB.1)
  // ==========================================================================

  /**
   * Verifica que el juez tenga autorización sobre una causa
   * Implementa FIA_ATD.1: Validación de atributos del usuario
   */
  private async verificarAutorizacionCausa(
    causaId: number,
    juezId: number
  ): Promise<{ autorizado: boolean; causa?: any; error?: string }> {
    const client = await casesPool.connect();
    try {
      const result = await client.query(
        `SELECT causa_id, numero_proceso, juez_asignado_id, juez_pseudonimo,
                unidad_judicial, materia, estado_procesal
         FROM causas WHERE causa_id = $1`,
        [causaId]
      );

      if (result.rows.length === 0) {
        return { autorizado: false, error: "Causa no encontrada" };
      }

      const causa = result.rows[0];

      // Verificar que el juez sea el asignado a la causa
      if (causa.juez_asignado_id !== juezId) {
        return { 
          autorizado: false, 
          error: "No tiene autorización para crear decisiones en esta causa",
          causa,
        };
      }

      return { autorizado: true, causa };
    } finally {
      client.release();
    }
  }

  /**
   * Verifica que una decisión pueda ser modificada
   * Las decisiones FIRMADAS son inmutables
   */
  private async verificarDecisionEditable(
    decisionId: number,
    juezId: number
  ): Promise<{ editable: boolean; decision?: DecisionJudicial; error?: string }> {
    const client = await casesPool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM decisiones_judiciales WHERE decision_id = $1`,
        [decisionId]
      );

      if (result.rows.length === 0) {
        return { editable: false, error: "Decisión no encontrada" };
      }

      const decision = this.mapearDecision(result.rows[0]);

      // Verificar que el juez sea el autor
      if (decision.juezAutorId !== juezId) {
        return { 
          editable: false, 
          error: "No tiene autorización para modificar esta decisión" 
        };
      }

      // Verificar estado
      if (decision.estado === "FIRMADA") {
        return { 
          editable: false, 
          error: "No se puede modificar una decisión firmada. Las decisiones firmadas son inmutables." 
        };
      }

      if (decision.estado === "ANULADA") {
        return { 
          editable: false, 
          error: "No se puede modificar una decisión anulada" 
        };
      }

      return { editable: true, decision };
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // OPERACIONES CRUD
  // ==========================================================================

  /**
   * Crea una nueva decisión judicial en estado BORRADOR
   * Solo el juez asignado a la causa puede crear decisiones
   */
  async crearDecision(
    input: CrearDecisionInput,
    usuario: ContextoUsuario,
    ipOrigen: string,
    userAgent: string
  ): Promise<DecisionJudicial> {
    // 1. Validar autorización sobre la causa
    const { autorizado, causa, error } = await this.verificarAutorizacionCausa(
      input.causaId,
      usuario.funcionarioId
    );

    if (!autorizado) {
      // Registrar intento no autorizado
      await auditService.log({
        tipoEvento: "ACCESO_DENEGADO",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `[ALTA] Intento de crear decisión en causa no autorizada`,
        datosAfectados: {
          causaId: input.causaId,
          juezIntentando: usuario.funcionarioId,
          juezAsignado: causa?.juez_asignado_id,
        },
        ipOrigen,
        userAgent,
      });
      throw new Error(error);
    }

    // 2. Obtener pseudónimo del juez
    const juezPseudonimo = causa.juez_pseudonimo;

    // 3. Crear la decisión en BD
    const client = await casesPool.connect();
    try {
      const result = await client.query(
        `INSERT INTO decisiones_judiciales (
          causa_id, juez_autor_id, juez_pseudonimo,
          tipo_decision, titulo, contenido_borrador,
          estado, version, ip_creacion, fecha_creacion
        ) VALUES ($1, $2, $3, $4, $5, $6, 'BORRADOR', 1, $7, NOW())
        RETURNING *`,
        [
          input.causaId,
          usuario.funcionarioId,
          juezPseudonimo,
          input.tipoDecision,
          input.titulo,
          input.contenidoBorrador || "",
          ipOrigen,
        ]
      );

      const decision = this.mapearDecision(result.rows[0]);

      // 4. Registrar en auditoría
      await auditService.log({
        tipoEvento: "CREACION_DECISION",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `[INFO] Decisión judicial creada: ${input.tipoDecision}`,
        datosAfectados: {
          decisionId: decision.decisionId,
          causaId: input.causaId,
          numeroProceso: causa.numero_proceso,
          tipoDecision: input.tipoDecision,
          titulo: input.titulo,
        },
        ipOrigen,
        userAgent,
      });

      loggers.system.info(`Decisión creada`, { decisionId: decision.decisionId, juezId: usuario.funcionarioId });
      return decision;

    } finally {
      client.release();
    }
  }

  /**
   * Obtiene una decisión por ID
   * Registra auditoría de visualización
   */
  async getDecisionById(
    decisionId: number,
    usuario: ContextoUsuario,
    ipOrigen?: string
  ): Promise<DecisionJudicial | null> {
    const client = await casesPool.connect();
    try {
      const result = await client.query(
        `SELECT d.*, c.numero_proceso
         FROM decisiones_judiciales d
         JOIN causas c ON d.causa_id = c.causa_id
         WHERE d.decision_id = $1`,
        [decisionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const decision = this.mapearDecision(result.rows[0]);

      // Control de acceso: solo el juez autor o admins pueden ver el contenido completo
      if (usuario.rol === "JUEZ" && decision.juezAutorId !== usuario.funcionarioId) {
        // Retornar versión reducida sin contenido del borrador
        decision.contenidoBorrador = undefined;
      }

      // Auditoría de visualización (si se proporciona ipOrigen)
      if (ipOrigen) {
        await auditService.log({
          tipoEvento: "VISUALIZACION_DECISION",
          usuarioId: usuario.funcionarioId,
          usuarioCorreo: usuario.correo,
          moduloAfectado: "CASOS",
          descripcion: `Visualización de decisión ${decisionId}`,
          datosAfectados: {
            decisionId,
            causaId: decision.causaId,
            tipoDecision: decision.tipoDecision,
            estado: decision.estado,
          },
          ipOrigen,
          userAgent: "sistema",
        });
      }

      return decision;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene lista de decisiones con filtros
   * Registra auditoría de consulta
   */
  async getDecisiones(
    filtros: FiltrosDecisiones,
    usuario: ContextoUsuario,
    ipOrigen?: string
  ): Promise<{ decisiones: DecisionJudicialPublica[]; total: number }> {
    const client = await casesPool.connect();
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filtro por causa
      if (filtros.causaId) {
        conditions.push(`d.causa_id = $${paramIndex++}`);
        params.push(filtros.causaId);
      }

      // Filtro por juez autor (para jueces, solo sus decisiones)
      if (usuario.rol === "JUEZ") {
        conditions.push(`d.juez_autor_id = $${paramIndex++}`);
        params.push(usuario.funcionarioId);
      } else if (filtros.juezAutorId) {
        conditions.push(`d.juez_autor_id = $${paramIndex++}`);
        params.push(filtros.juezAutorId);
      }

      // Filtro por tipo
      if (filtros.tipoDecision) {
        conditions.push(`d.tipo_decision = $${paramIndex++}`);
        params.push(filtros.tipoDecision);
      }

      // Filtro por estado
      if (filtros.estado) {
        conditions.push(`d.estado = $${paramIndex++}`);
        params.push(filtros.estado);
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(" AND ")}` 
        : "";

      // Contar total
      const countResult = await client.query(
        `SELECT COUNT(*) FROM decisiones_judiciales d ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Paginación
      const page = filtros.page || 1;
      const pageSize = filtros.pageSize || 20;
      const offset = (page - 1) * pageSize;

      // Obtener decisiones
      const result = await client.query(
        `SELECT d.*, c.numero_proceso
         FROM decisiones_judiciales d
         JOIN causas c ON d.causa_id = c.causa_id
         ${whereClause}
         ORDER BY d.fecha_creacion DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, pageSize, offset]
      );

      const decisiones = result.rows.map(row => this.mapearDecisionPublica(row));

      // Auditoría de consulta (si se proporciona ipOrigen)
      if (ipOrigen) {
        await auditService.log({
          tipoEvento: "CONSULTA_DECISIONES",
          usuarioId: usuario.funcionarioId,
          usuarioCorreo: usuario.correo,
          moduloAfectado: "CASOS",
          descripcion: `Consulta de decisiones`,
          datosAfectados: {
            filtros,
            cantidadResultados: decisiones.length,
            totalResultados: total,
          },
          ipOrigen,
          userAgent: "sistema",
        });
      }

      return { decisiones, total };
    } finally {
      client.release();
    }
  }

  /**
   * Actualiza una decisión en estado BORRADOR
   */
  async actualizarDecision(
    decisionId: number,
    input: ActualizarDecisionInput,
    usuario: ContextoUsuario,
    ipOrigen: string,
    userAgent: string
  ): Promise<DecisionJudicial> {
    // 1. Verificar que sea editable
    const { editable, decision, error } = await this.verificarDecisionEditable(
      decisionId,
      usuario.funcionarioId
    );

    if (!editable) {
      await auditService.log({
        tipoEvento: "MODIFICACION_DENEGADA",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `[MEDIA] Intento de modificar decisión no editable`,
        datosAfectados: { decisionId, motivo: error },
        ipOrigen,
        userAgent,
      });
      throw new Error(error);
    }

    const client = await casesPool.connect();
    try {
      // 2. Guardar en historial antes de modificar
      await client.query(
        `INSERT INTO historial_decisiones (
          decision_id, version_anterior, contenido_anterior,
          estado_anterior, modificado_por_id, ip_origen
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          decisionId,
          decision!.version,
          decision!.contenidoBorrador,
          decision!.estado,
          usuario.funcionarioId,
          ipOrigen,
        ]
      );

      // 3. Actualizar decisión (el trigger incrementará la versión)
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.titulo !== undefined) {
        updates.push(`titulo = $${paramIndex++}`);
        params.push(input.titulo);
      }

      if (input.contenidoBorrador !== undefined) {
        updates.push(`contenido_borrador = $${paramIndex++}`);
        params.push(input.contenidoBorrador);
      }

      if (updates.length === 0) {
        return decision!;
      }

      params.push(decisionId);

      const result = await client.query(
        `UPDATE decisiones_judiciales 
         SET ${updates.join(", ")}
         WHERE decision_id = $${paramIndex}
         RETURNING *`,
        params
      );

      const decisionActualizada = this.mapearDecision(result.rows[0]);

      // 4. Auditoría
      await auditService.log({
        tipoEvento: "ACTUALIZACION_DECISION",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `[INFO] Decisión judicial actualizada`,
        datosAfectados: {
          decisionId,
          versionAnterior: decision!.version,
          versionNueva: decisionActualizada.version,
          cambios: Object.keys(input),
        },
        ipOrigen,
        userAgent,
      });

      return decisionActualizada;

    } finally {
      client.release();
    }
  }

  /**
   * Cambia estado de BORRADOR a LISTA_PARA_FIRMA
   * Pre-validación antes de firmar
   */
  async prepararParaFirma(
    decisionId: number,
    usuario: ContextoUsuario,
    ipOrigen: string,
    userAgent: string
  ): Promise<DecisionJudicial> {
    // 1. Verificar que sea editable
    const { editable, decision, error } = await this.verificarDecisionEditable(
      decisionId,
      usuario.funcionarioId
    );

    if (!editable) {
      throw new Error(error);
    }

    if (decision!.estado !== "BORRADOR") {
      throw new Error("Solo se pueden preparar para firma decisiones en estado BORRADOR");
    }

    // 2. Verificar que tenga contenido
    if (!decision!.contenidoBorrador || decision!.contenidoBorrador.trim().length < 50) {
      throw new Error("La decisión debe tener contenido suficiente antes de firmar");
    }

    // 3. Verificar que el juez tenga certificado válido
    const tieneCertificado = await firmaService.tieneCartificadoValido(usuario.funcionarioId);
    if (!tieneCertificado) {
      throw new Error("No se encontró un certificado digital válido para el firmante");
    }

    // 4. Cambiar estado
    const client = await casesPool.connect();
    try {
      const result = await client.query(
        `UPDATE decisiones_judiciales 
         SET estado = 'LISTA_PARA_FIRMA'
         WHERE decision_id = $1
         RETURNING *`,
        [decisionId]
      );

      const decisionPreparada = this.mapearDecision(result.rows[0]);

      await auditService.log({
        tipoEvento: "DECISION_LISTA_FIRMA",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `[INFO] Decisión preparada para firma`,
        datosAfectados: { decisionId, estado: "LISTA_PARA_FIRMA" },
        ipOrigen,
        userAgent,
      });

      return decisionPreparada;

    } finally {
      client.release();
    }
  }

  /**
   * FIRMA ELECTRÓNICA DE DECISIÓN JUDICIAL
   * Proceso completo: Generar PDF → Firmar → Almacenar → Marcar como FIRMADA
   */
  async firmarDecision(
    decisionId: number,
    usuario: ContextoUsuario,
    ipOrigen: string,
    userAgent: string
  ): Promise<DecisionJudicial> {
    // 1. Obtener la decisión y verificar estado
    const client = await casesPool.connect();
    try {
      // Iniciar transacción para atomicidad
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT d.*, c.numero_proceso, c.juez_pseudonimo as causa_juez_pseudonimo
         FROM decisiones_judiciales d
         JOIN causas c ON d.causa_id = c.causa_id
         WHERE d.decision_id = $1
         FOR UPDATE`, // Bloquear fila durante la transacción
        [decisionId]
      );

      if (result.rows.length === 0) {
        throw new Error("Decisión no encontrada");
      }

      const decision = this.mapearDecision(result.rows[0]);
      const numeroProceso = result.rows[0].numero_proceso;

      // 2. Verificar que el juez sea el autor
      if (decision.juezAutorId !== usuario.funcionarioId) {
        await auditService.log({
          tipoEvento: "FIRMA_DENEGADA",
          usuarioId: usuario.funcionarioId,
          usuarioCorreo: usuario.correo,
          moduloAfectado: "CASOS",
          descripcion: `[ALTA] Intento de firmar decisión de otro juez`,
          datosAfectados: { decisionId, juezAutor: decision.juezAutorId },
          ipOrigen,
          userAgent,
        });
        throw new Error("Solo el juez autor puede firmar esta decisión");
      }

      // 3. Verificar estado válido para firma
      if (decision.estado === "FIRMADA" as string) {
        throw new Error("Esta decisión ya está firmada y no puede modificarse");
      }

      if (decision.estado !== "LISTA_PARA_FIRMA" && decision.estado !== "BORRADOR") {
        throw new Error(`No se puede firmar una decisión en estado ${decision.estado}`);
      }

      // 4. Generar contenido final del documento (con pseudónimo del juez)
      const contenidoFinal = this.generarContenidoFinalDocumento(
        decision,
        numeroProceso,
        decision.juezPseudonimo
      );

      // 5. Calcular hash del contenido
      const hashPrevio = firmaService.calcularHash(contenidoFinal);

      // 6. FIRMAR DIGITALMENTE
      const metadatosFirma = await firmaService.firmarDocumento(
        usuario.funcionarioId,
        contenidoFinal,
        ipOrigen,
        userAgent
      );

      if (!metadatosFirma) {
        throw new Error("Error al firmar el documento. Verifique su certificado digital.");
      }

      // 7. Generar y almacenar PDF firmado
      await this.inicializarAlmacenamiento();
      const nombreArchivo = `${decision.tipoDecision}_${decisionId}_${Date.now()}.pdf`;
      const rutaRelativa = path.join(String(decision.causaId), nombreArchivo);
      const rutaAbsoluta = path.join(DECISIONES_STORAGE_PATH, rutaRelativa);

      // Crear directorio si no existe
      await fs.mkdir(path.dirname(rutaAbsoluta), { recursive: true });

      // Crear contenido del PDF real usando pdf-lib (usar pseudónimo, NO nombre real)
      const pdfContent = await this.generarPdfReal(contenidoFinal, metadatosFirma, decision.juezPseudonimo);
      await fs.writeFile(rutaAbsoluta, pdfContent);

      // 8. Calcular hash final del PDF
      const hashFinal = firmaService.calcularHash(pdfContent);

      // 8.1. INSERTAR DOCUMENTO PRIMERO (antes de marcar como FIRMADA)
      // Generar UUID para el documento
      const documentoUuid = `dec-${decisionId}-${Date.now()}`;
      
      const documentoResult = await client.query(
        `INSERT INTO documentos (
          id, causa_id, tipo, nombre, ruta, hash_integridad,
          tamanio_bytes, mime_type, subido_por_id, subido_por_pseudonimo, fecha_subida, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'application/pdf', $8, $9, NOW(), 'firmado')
        RETURNING id`,
        [
          documentoUuid,
          decision.causaId,
          decision.tipoDecision.toLowerCase(), // auto, sentencia, providencia
          `${decision.tipoDecision}_${decisionId}_${decision.titulo.substring(0, 50)}.pdf`,
          rutaRelativa,
          hashFinal,
          pdfContent.length,
          usuario.funcionarioId, // ID del juez que firma
          decision.juezPseudonimo, // Pseudónimo del juez que firma
        ]
      );

      const documentoId = documentoResult.rows[0].id;

      // 9. Actualizar decisión a estado FIRMADA con documento_id (INMUTABLE desde aquí)
      // IMPORTANTE: Incluir documento_id aquí porque el trigger bloquea UPDATEs posteriores
      
      const updateResult = await client.query(
        `UPDATE decisiones_judiciales SET
          estado = 'FIRMADA',
          fecha_firma = NOW(),
          ruta_pdf_firmado = $2,
          hash_integridad_pdf = $3,
          certificado_firmante = $4,
          numero_serie_certificado = $5,
          algoritmo_firma = $6,
          firma_base64 = $7,
          documento_id = $8
         WHERE decision_id = $1
         RETURNING *`,
        [
          decisionId,
          rutaRelativa,
          hashFinal,
          decision.juezPseudonimo, // Usar pseudónimo, NO el nombre real del certificado
          metadatosFirma.numeroSerieCertificado,
          metadatosFirma.algoritmoFirma,
          metadatosFirma.firmaBase64,
          documentoId,
        ]
      );

      const decisionFirmada = this.mapearDecision(updateResult.rows[0]);

      // Actualizar objeto con documento_id
      decisionFirmada.documentoId = documentoId;

      // 9.1. ACTUALIZAR ESTADO DE LA CAUSA si es una SENTENCIA
      if (decision.tipoDecision === 'SENTENCIA') {
        await client.query(
          `UPDATE causas SET estado_procesal = 'RESUELTA' WHERE causa_id = $1`,
          [decision.causaId]
        );

        loggers.system.info(`Causa actualizada a estado RESUELTA`, { causaId: decision.causaId });
      }

      // 9.2. CREAR EVENTO EN LÍNEA DE TIEMPO (si existe tabla de eventos)
      // Usar SAVEPOINT para que un error aquí NO aborte la transacción principal
      try {
        await client.query('SAVEPOINT eventos_savepoint');
        await client.query(
          `INSERT INTO eventos_causa (
            causa_id, tipo_evento, descripcion, 
            fecha_evento, creado_por_id, documento_id
          ) VALUES ($1, $2, $3, NOW(), $4, $5)`,
          [
            decision.causaId,
            `FIRMA_${decision.tipoDecision}`,
            `${decision.tipoDecision} firmado electrónicamente: ${decision.titulo}`,
            usuario.funcionarioId,
            documentoId,
          ]
        );
        await client.query('RELEASE SAVEPOINT eventos_savepoint');
      } catch (eventError) {
        // Revertir solo el savepoint, no la transacción completa
        await client.query('ROLLBACK TO SAVEPOINT eventos_savepoint');
        // Tabla eventos_causa no disponible, se omite el evento
      }

      // CONFIRMAR TRANSACCIÓN
      await client.query('COMMIT');
      
      loggers.system.info(`Decisión FIRMADA`, { 
        decisionId, 
        firmante: metadatosFirma.certificadoFirmante,
        documentoId 
      });

      // Actualizar objeto con documento_id
      decisionFirmada.documentoId = documentoId;

      // 10. Auditoría detallada (después del COMMIT, en db_logs separada)
      try {
        await auditService.log({
          tipoEvento: "DECISION_FIRMADA",
          usuarioId: usuario.funcionarioId,
          usuarioCorreo: usuario.correo,
          moduloAfectado: "CASOS",
          descripcion: `[CRITICO] Decisión judicial firmada electrónicamente y vinculada al expediente`,
          datosAfectados: {
            decisionId,
            causaId: decision.causaId,
            numeroProceso,
            tipoDecision: decision.tipoDecision,
            titulo: decision.titulo,
            hashDocumento: hashFinal,
            certificadoFirmante: metadatosFirma.certificadoFirmante,
            serialCertificado: metadatosFirma.numeroSerieCertificado,
            algoritmo: metadatosFirma.algoritmoFirma,
            rutaPdf: rutaRelativa,
            documentoId: documentoId,
            vinculadoExpediente: true,
            estadoCausaActualizado: decision.tipoDecision === 'SENTENCIA',
          },
          ipOrigen,
          userAgent,
        });
      } catch (auditError) {
        // Auditoría no debe fallar la transacción principal
        log.error(`⚠️ Error en auditoría (no afecta firma):`, auditError);
      }

      return decisionFirmada;

    } catch (error) {
      // Revertir cambios en caso de error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Ignorar error de rollback si ya se hizo commit
      }
      log.error(`❌ Error en firma, transacción revertida:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Genera el contenido final del documento con pseudónimo del juez
   * Este contenido es lo que se firmará digitalmente
   */
  private generarContenidoFinalDocumento(
    decision: DecisionJudicial,
    numeroProceso: string,
    juezPseudonimo: string
  ): string {
    const fechaActual = new Date().toLocaleDateString("es-EC", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `
================================================================================
                         REPÚBLICA DEL ECUADOR
                     CONSEJO DE LA JUDICATURA
================================================================================

PROCESO: ${numeroProceso}
TIPO DE DECISIÓN: ${decision.tipoDecision}

--------------------------------------------------------------------------------
${decision.titulo.toUpperCase()}
--------------------------------------------------------------------------------

Fecha: ${fechaActual}

${decision.contenidoBorrador}

--------------------------------------------------------------------------------
FIRMA DIGITAL
--------------------------------------------------------------------------------

Firmado electrónicamente por:
Código de Identificación: ${juezPseudonimo}

Este documento ha sido firmado digitalmente conforme a la Ley de Comercio 
Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador.
La firma electrónica tiene la misma validez jurídica que la firma manuscrita.

================================================================================
    `.trim();
  }

  /**
   * Genera un PDF real usando pdf-lib con el contenido de la decisión y metadatos de firma
   * @param pseudonimoFirmante - Pseudónimo del juez (NO el nombre real del certificado)
   */
  private async generarPdfReal(contenido: string, firma: MetadatosFirma, pseudonimoFirmante: string): Promise<Buffer> {
    // Crear nuevo documento PDF
    const pdfDoc = await PDFDocument.create();
    
    // Cargar fuentes
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Configuración de página
    const pageWidth = 612; // Letter size
    const pageHeight = 792;
    const margin = 50;
    const lineHeight = 14;
    const maxWidth = pageWidth - (margin * 2);
    
    // Dividir contenido en líneas
    const lines = contenido.split('\n');
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;
    
    for (const line of lines) {
      // Si no hay espacio, crear nueva página
      if (yPosition < margin + 100) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
      
      // Detectar si es título (líneas con ===)
      const isSeparator = line.includes('===') || line.includes('---');
      const font = isSeparator ? helvetica : (line.trim().toUpperCase() === line.trim() && line.trim().length > 3 ? helveticaBold : helvetica);
      const fontSize = isSeparator ? 8 : (line.trim().toUpperCase() === line.trim() && line.trim().length > 3 ? 12 : 10);
      
      if (isSeparator) {
        // Dibujar línea horizontal
        currentPage.drawLine({
          start: { x: margin, y: yPosition },
          end: { x: pageWidth - margin, y: yPosition },
          thickness: 0.5,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= lineHeight;
      } else {
        // Texto normal - dividir líneas largas
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const textWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (textWidth > maxWidth && currentLine) {
            currentPage.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
            yPosition -= lineHeight;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          currentPage.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
        }
      }
    }
    
    // Agregar información de firma al final
    yPosition -= lineHeight * 2;
    if (yPosition < margin + 100) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    }
    
    // Cuadro de firma electrónica
    currentPage.drawRectangle({
      x: margin,
      y: yPosition - 70,
      width: maxWidth,
      height: 70,
      borderColor: rgb(0.2, 0.5, 0.2),
      borderWidth: 1,
    });
    
    currentPage.drawText('FIRMADO ELECTRÓNICAMENTE', {
      x: margin + 10,
      y: yPosition - 20,
      size: 11,
      font: helveticaBold,
      color: rgb(0.2, 0.5, 0.2),
    });
    
    currentPage.drawText(`Por: ${pseudonimoFirmante}`, {
      x: margin + 10,
      y: yPosition - 38,
      size: 9,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    currentPage.drawText('Conforme a la Ley de Comercio Electrónico, Firmas y Mensajes de Datos del Ecuador.', {
      x: margin + 10,
      y: yPosition - 54,
      size: 8,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    // Agregar metadatos al PDF
    pdfDoc.setTitle('Decisión Judicial Firmada');
    pdfDoc.setSubject('Documento firmado electrónicamente');
    pdfDoc.setCreator('Sistema Juez Seguro');
    pdfDoc.setProducer('Consejo de la Judicatura - Ecuador');
    pdfDoc.setCreationDate(new Date());
    
    // Generar bytes del PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Verifica la integridad de una decisión firmada
   */
  async verificarIntegridad(
    decisionId: number
  ): Promise<{ integro: boolean; detalles: any }> {
    const client = await casesPool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM decisiones_judiciales WHERE decision_id = $1`,
        [decisionId]
      );

      if (result.rows.length === 0) {
        return { integro: false, detalles: { error: "Decisión no encontrada" } };
      }

      const decision = this.mapearDecision(result.rows[0]);

      if (decision.estado !== "FIRMADA") {
        return { 
          integro: false, 
          detalles: { error: "La decisión no está firmada" } 
        };
      }

      // Leer el PDF almacenado
      const rutaAbsoluta = path.join(DECISIONES_STORAGE_PATH, decision.rutaPdfFirmado!);
      
      try {
        const contenidoPdf = await fs.readFile(rutaAbsoluta);
        const hashActual = firmaService.calcularHash(contenidoPdf);

        const integro = hashActual === decision.hashIntegridadPdf;

        return {
          integro,
          detalles: {
            decisionId,
            hashAlmacenado: decision.hashIntegridadPdf,
            hashActual,
            fechaFirma: decision.fechaFirma,
            firmante: decision.certificadoFirmante,
            coincide: integro,
          },
        };
      } catch (error) {
        return {
          integro: false,
          detalles: { error: "No se pudo leer el documento firmado" },
        };
      }

    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el historial de versiones de una decisión
   */
  async getHistorial(decisionId: number): Promise<HistorialDecision[]> {
    const client = await casesPool.connect();
    try {
      // Obtener historial con pseudónimo del usuario que modificó
      const result = await client.query(
        `SELECT h.*, 
                COALESCE(mp.pseudonimo_publico, 'SISTEMA') as modificado_por_pseudonimo
         FROM historial_decisiones h
         LEFT JOIN mapa_pseudonimos mp ON h.modificado_por_id = mp.juez_id_real
         WHERE h.decision_id = $1 
         ORDER BY h.fecha_modificacion DESC`,
        [decisionId]
      );

      return result.rows.map((row) => ({
        historialId: row.historial_id,
        decisionId: row.decision_id,
        versionAnterior: row.version_anterior || 1,
        contenidoAnterior: row.contenido_anterior,
        estadoAnterior: row.estado_anterior || 'BORRADOR',
        modificadoPorId: row.modificado_por_id,
        fechaModificacion: row.fecha_modificacion ? new Date(row.fecha_modificacion) : new Date(),
        ipOrigen: row.ip_origen,
        motivoCambio: row.motivo_cambio,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Elimina una decisión (solo si está en BORRADOR)
   */
  async eliminarDecision(
    decisionId: number,
    usuario: ContextoUsuario,
    ipOrigen: string,
    userAgent: string
  ): Promise<void> {
    const { editable, decision, error } = await this.verificarDecisionEditable(
      decisionId,
      usuario.funcionarioId
    );

    if (!editable) {
      throw new Error(error);
    }

    if (decision!.estado !== "BORRADOR") {
      throw new Error("Solo se pueden eliminar decisiones en estado BORRADOR");
    }

    const client = await casesPool.connect();
    try {
      await client.query(
        `DELETE FROM decisiones_judiciales WHERE decision_id = $1`,
        [decisionId]
      );

      await auditService.log({
        tipoEvento: "ELIMINACION_DECISION",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `[INFO] Decisión en borrador eliminada`,
        datosAfectados: { decisionId, tipoDecision: decision!.tipoDecision },
        ipOrigen,
        userAgent,
      });
    } finally {
      client.release();
    }
  }
}

// Exportar instancia singleton
export const decisionesService = new DecisionesService();
