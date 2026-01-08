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
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
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
// CONFIGURACIÓN
// ============================================================================

const DECISIONES_STORAGE_PATH = process.env.DECISIONES_FIRMADAS_PATH || "./storage/decisiones_firmadas";

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
      console.error("[DECISIONES] Error al crear directorio de almacenamiento:", error);
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

      console.log(`[DECISIONES] Decisión ${decision.decisionId} creada por juez ${usuario.funcionarioId}`);
      return decision;

    } finally {
      client.release();
    }
  }

  /**
   * Obtiene una decisión por ID
   */
  async getDecisionById(
    decisionId: number,
    usuario: ContextoUsuario
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

      return decision;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene lista de decisiones con filtros
   */
  async getDecisiones(
    filtros: FiltrosDecisiones,
    usuario: ContextoUsuario
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

      // Crear contenido del PDF (simulado - en producción usar librería PDF)
      const pdfContent = this.generarPdfSimulado(contenidoFinal, metadatosFirma);
      await fs.writeFile(rutaAbsoluta, pdfContent);

      // 8. Calcular hash final del PDF
      const hashFinal = firmaService.calcularHash(pdfContent);

      // 9. Actualizar decisión a estado FIRMADA (INMUTABLE desde aquí)
      const updateResult = await client.query(
        `UPDATE decisiones_judiciales SET
          estado = 'FIRMADA',
          fecha_firma = NOW(),
          ruta_pdf_firmado = $2,
          hash_integridad_pdf = $3,
          certificado_firmante = $4,
          numero_serie_certificado = $5,
          algoritmo_firma = $6,
          firma_base64 = $7
         WHERE decision_id = $1
         RETURNING *`,
        [
          decisionId,
          rutaRelativa,
          hashFinal,
          metadatosFirma.certificadoFirmante,
          metadatosFirma.numeroSerieCertificado,
          metadatosFirma.algoritmoFirma,
          metadatosFirma.firmaBase64,
        ]
      );

      const decisionFirmada = this.mapearDecision(updateResult.rows[0]);

      // 10. Auditoría detallada
      await auditService.log({
        tipoEvento: "DECISION_FIRMADA",
        usuarioId: usuario.funcionarioId,
        usuarioCorreo: usuario.correo,
        moduloAfectado: "CASOS",
        descripcion: `[CRITICO] Decisión judicial firmada electrónicamente`,
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
        },
        ipOrigen,
        userAgent,
      });

      console.log(`[DECISIONES] ✅ Decisión ${decisionId} FIRMADA por ${metadatosFirma.certificadoFirmante}`);

      return decisionFirmada;

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
   * Genera un PDF simulado (en producción usar librería como pdf-lib o puppeteer)
   */
  private generarPdfSimulado(contenido: string, firma: MetadatosFirma): Buffer {
    // Crear un buffer que simula un PDF con el contenido y metadatos de firma
    const pdfData = {
      version: "1.0",
      tipo: "DecisionJudicialFirmada",
      contenido,
      firma: {
        algoritmo: firma.algoritmoFirma,
        certificado: firma.certificadoFirmante,
        serial: firma.numeroSerieCertificado,
        fecha: firma.fechaFirma.toISOString(),
        hash: firma.hashDocumento,
        firmaBase64: firma.firmaBase64,
      },
      generado: new Date().toISOString(),
    };

    // En producción, aquí se generaría un PDF real con la firma embebida
    // Por ahora, devolvemos un JSON que simula el contenido del PDF
    return Buffer.from(JSON.stringify(pdfData, null, 2), "utf-8");
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
      const result = await client.query(
        `SELECT * FROM historial_decisiones 
         WHERE decision_id = $1 
         ORDER BY fecha_modificacion DESC`,
        [decisionId]
      );

      return result.rows.map(row => ({
        historialId: row.historial_id,
        decisionId: row.decision_id,
        versionAnterior: row.version_anterior,
        contenidoAnterior: row.contenido_anterior,
        estadoAnterior: row.estado_anterior,
        modificadoPorId: row.modificado_por_id,
        fechaModificacion: row.fecha_modificacion,
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
