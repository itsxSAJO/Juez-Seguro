// ============================================================================
// JUEZ SEGURO BACKEND - Servicio de Causas (FDP)
// Protección de datos con pseudonimización
// Tablas: causas, mapa_pseudonimos, expedientes
// HU-SJ-001: Registro de nuevas causas con validación de scope
// ============================================================================

import { casesPool, usersPool } from "../db/connection.js";
import crypto from "crypto";
import { auditService } from "./audit.service.js";
import { loggers } from "./logger.service.js";
import { notificacionesService } from "./notificaciones.service.js";
import type { Causa, CausaPublica, ActuacionPublica, EstadoProcesal, Expediente, MapaPseudonimo, TokenPayload } from "../types/index.js";

const log = loggers.causas;

// ============================================================================
// INTERFACES
// ============================================================================

interface CrearCausaInput {
  materia: string;
  tipoProceso: string;
  unidadJudicial: string;
  descripcion?: string;
  // Partes procesales (información pública)
  actorNombre?: string;
  actorIdentificacion?: string;
  demandadoNombre?: string;
  demandadoIdentificacion?: string;
}

interface ValidacionScopeResult {
  valido: boolean;
  error?: string;
  codigo?: "MATERIA_NO_COINCIDE" | "UNIDAD_NO_COINCIDE" | "SCOPE_INVALIDO";
}

interface JuezDisponible {
  funcionario_id: number;
  nombres_completos: string;
  unidad_judicial: string;
  materia: string;
  pseudonimo?: string;
}

interface FiltrosCausas {
  estadoProcesal?: EstadoProcesal;
  materia?: string;
  unidadJudicial?: string;
  juezAsignadoId?: number;
  busqueda?: string;
  tipoBusqueda?: "actor" | "demandado" | "proceso" | "general";
  page?: number;
  pageSize?: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================
const ROL_JUEZ_ID = 2; // Según el esquema: ADMIN_CJ=1, JUEZ=2, SECRETARIO=3

/**
 * Servicio de Causas - FDP (Functional Data Protection)
 * Implementa FDP_IFF (Flujo de información anonimizado)
 * HU-SJ-001: Registro de causas con validación de scope (FIA_ATD)
 */
class CausasService {
  // ============================================================================
  // VALIDACIÓN DE SCOPE (FIA_ATD) - HU-SJ-001
  // ============================================================================

  /**
   * Valida que el secretario tenga permisos para crear la causa
   * Compara Token.UnidadJudicial/Materia con Formulario.UnidadJudicial/Materia
   * 
   * @param secretario - Datos del token del secretario
   * @param input - Datos de la causa a crear
   * @returns Resultado de la validación
   */
  validarScope(secretario: TokenPayload, input: CrearCausaInput): ValidacionScopeResult {
    // Normalizar strings para comparación (ignorar mayúsculas/minúsculas y espacios)
    const normalizarString = (str: string): string => 
      str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const secretarioMateria = normalizarString(secretario.materia);
    const causaMateria = normalizarString(input.materia);
    const secretarioUnidad = normalizarString(secretario.unidadJudicial);
    const causaUnidad = normalizarString(input.unidadJudicial);

    // Validar materia
    if (secretarioMateria !== causaMateria) {
      return {
        valido: false,
        error: `No tiene permisos para crear causas de materia "${input.materia}". Su materia asignada es "${secretario.materia}".`,
        codigo: "MATERIA_NO_COINCIDE",
      };
    }

    // Validar unidad judicial
    if (secretarioUnidad !== causaUnidad) {
      return {
        valido: false,
        error: `No tiene permisos para crear causas en la unidad "${input.unidadJudicial}". Su unidad asignada es "${secretario.unidadJudicial}".`,
        codigo: "UNIDAD_NO_COINCIDE",
      };
    }

    return { valido: true };
  }

  // ============================================================================
  // ASIGNACIÓN DE JUEZ (SORTEO) - HU-SJ-001
  // ============================================================================

  /**
   * Obtiene jueces disponibles para asignación según unidad judicial y materia
   * Solo considera jueces con estado ACTIVA
   */
  async getJuecesDisponibles(unidadJudicial: string, materia: string): Promise<JuezDisponible[]> {
    const client = await usersPool.connect();

    try {
      // Buscar jueces activos en la misma unidad y materia
      const result = await client.query(
        `SELECT f.funcionario_id, f.nombres_completos, f.unidad_judicial, f.materia
         FROM funcionarios f
         JOIN roles r ON f.rol_id = r.rol_id
         WHERE r.rol_id = $1
           AND f.estado = 'ACTIVA'
           AND LOWER(TRIM(f.materia)) = LOWER(TRIM($2))
           AND LOWER(TRIM(f.unidad_judicial)) = LOWER(TRIM($3))
         ORDER BY f.funcionario_id`,
        [ROL_JUEZ_ID, materia, unidadJudicial]
      );

      return result.rows as JuezDisponible[];
    } finally {
      client.release();
    }
  }

  /**
   * Selecciona un juez al azar de los disponibles (sorteo)
   * Implementa asignación equitativa considerando carga de trabajo
   */
  async seleccionarJuez(unidadJudicial: string, materia: string): Promise<JuezDisponible | null> {
    const juecesDisponibles = await this.getJuecesDisponibles(unidadJudicial, materia);

    if (juecesDisponibles.length === 0) {
      return null;
    }

    // Obtener carga de trabajo de cada juez (cantidad de causas activas)
    const casesClient = await casesPool.connect();
    
    try {
      const juecesConCarga = await Promise.all(
        juecesDisponibles.map(async (juez) => {
          const cargaResult = await casesClient.query(
            `SELECT COUNT(*) as carga 
             FROM causas 
             WHERE juez_asignado_id = $1 
               AND estado_procesal NOT IN ('RESUELTA', 'ARCHIVADA')`,
            [juez.funcionario_id]
          );
          return {
            ...juez,
            carga: parseInt(cargaResult.rows[0].carga, 10),
          };
        })
      );

      // Ordenar por menor carga y seleccionar uno de los que tienen menor carga
      juecesConCarga.sort((a, b) => a.carga - b.carga);
      const menorCarga = juecesConCarga[0].carga;
      const juecesConMenorCarga = juecesConCarga.filter(j => j.carga === menorCarga);

      // Sorteo aleatorio entre los de menor carga
      const indiceAleatorio = Math.floor(Math.random() * juecesConMenorCarga.length);
      return juecesConMenorCarga[indiceAleatorio];
    } finally {
      casesClient.release();
    }
  }

  // ============================================================================
  // GENERACIÓN DE NÚMERO DE PROCESO
  // ============================================================================

  /**
   * Genera un número de proceso único
   * Formato: PROVINCIA-JUZGADO-AÑO-SECUENCIAL (ej: 17-281-2026-00001)
   */
  async generarNumeroProceso(unidadJudicial: string): Promise<string> {
    const client = await casesPool.connect();

    try {
      const year = new Date().getFullYear();
      
      // Obtener el último número secuencial del año
      const ultimoResult = await client.query(
        `SELECT numero_proceso FROM causas 
         WHERE numero_proceso LIKE $1
         ORDER BY fecha_creacion DESC LIMIT 1`,
        [`%-${year}-%`]
      );

      let secuencial = 1;
      if (ultimoResult.rows.length > 0) {
        const partes = ultimoResult.rows[0].numero_proceso.split("-");
        if (partes.length >= 4) {
          secuencial = parseInt(partes[3], 10) + 1;
        }
      }

      // Generar código de provincia (basado en unidad judicial)
      const provincia = "17"; // Por defecto Pichincha, se puede mejorar
      const juzgado = Math.floor(100 + Math.random() * 899);
      
      return `${provincia}${juzgado}-${year}-${String(secuencial).padStart(5, "0")}`;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // PSEUDÓNIMOS (FDP_IFF)
  // ============================================================================

  /**
   * Genera un pseudónimo único para un juez (FDP_IFF)
   */
  private generarPseudonimo(juezId: number): string {
    const hash = crypto.createHash("sha256")
      .update(juezId.toString() + process.env.PSEUDONYM_SALT || "salt")
      .digest("hex");
    return `N5-${hash.substring(0, 3).toUpperCase()}`;
  }

  /**
   * Obtiene o crea pseudónimo para un juez
   */
  async obtenerPseudonimo(juezIdReal: number): Promise<string> {
    const client = await casesPool.connect();

    try {
      // Buscar pseudónimo existente
      const existe = await client.query(
        "SELECT pseudonimo_publico FROM mapa_pseudonimos WHERE juez_id_real = $1",
        [juezIdReal]
      );

      if (existe.rows.length > 0) {
        return existe.rows[0].pseudonimo_publico;
      }

      // Generar nuevo pseudónimo
      const pseudonimo = this.generarPseudonimo(juezIdReal);

      await client.query(
        `INSERT INTO mapa_pseudonimos (juez_id_real, pseudonimo_publico)
         VALUES ($1, $2)
         ON CONFLICT (juez_id_real) DO NOTHING`,
        [juezIdReal, pseudonimo]
      );

      return pseudonimo;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // CREACIÓN DE CAUSA - HU-SJ-001
  // ============================================================================

  /**
   * Crea una nueva causa con asignación automática de juez
   * Implementa HU-SJ-001 con validación de scope (FIA_ATD)
   * 
   * @param input - Datos de la causa
   * @param secretario - Token del secretario creador (para validación de scope)
   * @param ip - IP de origen
   * @param userAgent - User agent
   */
  async crearCausaConValidacion(
    input: CrearCausaInput,
    secretario: TokenPayload,
    ip: string,
    userAgent: string
  ): Promise<{ causa: Causa; juezAsignado: string }> {
    // 1. Validar scope (FIA_ATD)
    const validacionScope = this.validarScope(secretario, input);
    if (!validacionScope.valido) {
      // Registrar intento de acceso denegado
      await auditService.log({
        tipoEvento: "ACCESO_DENEGADO",
        usuarioId: secretario.funcionarioId,
        usuarioCorreo: secretario.correo,
        moduloAfectado: "CASOS",
        descripcion: `Intento de crear causa fuera de scope: ${validacionScope.error}`,
        datosAfectados: { 
          inputMateria: input.materia, 
          inputUnidad: input.unidadJudicial,
          secretarioMateria: secretario.materia,
          secretarioUnidad: secretario.unidadJudicial,
          codigo: validacionScope.codigo
        },
        ipOrigen: ip,
        userAgent,
      });
      
      const error = new Error(validacionScope.error!) as any;
      error.code = validacionScope.codigo;
      error.status = 403;
      throw error;
    }

    // 2. Seleccionar juez por sorteo (considerando carga de trabajo)
    const juezSeleccionado = await this.seleccionarJuez(input.unidadJudicial, input.materia);
    
    if (!juezSeleccionado) {
      const error = new Error(`No hay jueces disponibles para la materia "${input.materia}" en la unidad "${input.unidadJudicial}".`) as any;
      error.code = "NO_JUECES_DISPONIBLES";
      error.status = 400;
      throw error;
    }

    // 3. Generar número de proceso único
    const numeroProceso = await this.generarNumeroProceso(input.unidadJudicial);

    // 4. Obtener o crear pseudónimo del juez seleccionado
    const juezPseudonimo = await this.obtenerPseudonimo(juezSeleccionado.funcionario_id);

    // 5. Crear la causa
    const client = await casesPool.connect();

    try {
      await client.query("BEGIN");

      // Insertar causa
      const resultCausa = await client.query(
        `INSERT INTO causas (
          numero_proceso, materia, tipo_proceso, unidad_judicial,
          juez_asignado_id, juez_pseudonimo, secretario_creador_id, estado_procesal,
          actor_nombre, demandado_nombre, descripcion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INICIADA', $8, $9, $10)
        RETURNING *`,
        [
          numeroProceso,
          input.materia,
          input.tipoProceso,
          input.unidadJudicial,
          juezSeleccionado.funcionario_id,
          juezPseudonimo,
          secretario.funcionarioId,
          input.actorNombre || null,
          input.demandadoNombre || null,
          input.descripcion || null,
        ]
      );

      const causa = resultCausa.rows[0] as Causa;

      // 6. Crear expediente electrónico asociado automáticamente
      await client.query(
        `INSERT INTO expedientes (causa_id, observaciones)
         VALUES ($1, $2)`,
        [causa.causa_id, `Expediente creado automáticamente. ${input.descripcion || ""}`]
      );

      await client.query("COMMIT");

      // 7. Registrar en auditoría
      await auditService.log({
        tipoEvento: "CREACION_CAUSA",
        usuarioId: secretario.funcionarioId,
        usuarioCorreo: secretario.correo,
        moduloAfectado: "CASOS",
        descripcion: `Causa ${numeroProceso} creada con asignación automática de juez`,
        datosAfectados: { 
          causaId: causa.causa_id, 
          numeroProceso,
          materia: input.materia,
          unidadJudicial: input.unidadJudicial,
          juezAsignadoId: juezSeleccionado.funcionario_id,
          juezPseudonimo,
          metodoAsignacion: "sorteo_equitativo"
        },
        ipOrigen: ip,
        userAgent,
      });

      // 8. Notificar al juez asignado sobre la nueva causa
      try {
        await notificacionesService.notificarCausaAsignada(
          juezSeleccionado.funcionario_id,
          causa.causa_id,
          numeroProceso,
          input.materia,
          secretario.funcionarioId,
          ip
        );
      } catch (notifError) {
        // No fallar la creación de causa si la notificación falla
        log.error("Error al crear notificación de causa asignada:", notifError);
      }

      return {
        causa,
        juezAsignado: juezPseudonimo, // Solo devolvemos pseudónimo, nunca datos reales
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Crea una nueva causa (método legacy - mantener por compatibilidad)
   * @deprecated Usar crearCausaConValidacion para HU-SJ-001
   */
  async crearCausa(
    input: CrearCausaInput & { numeroProceso: string },
    juezAsignadoId: number,
    secretarioCreadorId: number,
    ip: string,
    userAgent: string
  ): Promise<Causa> {
    const client = await casesPool.connect();

    try {
      // Verificar que no existe el número de proceso
      const existe = await client.query(
        "SELECT causa_id FROM causas WHERE numero_proceso = $1",
        [input.numeroProceso]
      );

      if (existe.rows.length > 0) {
        throw new Error("Ya existe una causa con ese número de proceso");
      }

      // Obtener pseudónimo del juez
      const juezPseudonimo = await this.obtenerPseudonimo(juezAsignadoId);

      const result = await client.query(
        `INSERT INTO causas (
          numero_proceso, materia, tipo_proceso, unidad_judicial,
          juez_asignado_id, juez_pseudonimo, secretario_creador_id, estado_procesal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INICIADA')
        RETURNING *`,
        [
          input.numeroProceso,
          input.materia,
          input.tipoProceso,
          input.unidadJudicial,
          juezAsignadoId,
          juezPseudonimo,
          secretarioCreadorId,
        ]
      );

      const causa = result.rows[0] as Causa;

      // Crear expediente electrónico asociado
      await client.query(
        `INSERT INTO expedientes (causa_id, observaciones)
         VALUES ($1, 'Expediente creado automáticamente')`,
        [causa.causa_id]
      );

      await auditService.log({
        tipoEvento: "CREACION_CAUSA",
        usuarioId: secretarioCreadorId,
        moduloAfectado: "CASOS",
        descripcion: `Causa creada: ${input.numeroProceso}`,
        datosAfectados: { causaId: causa.causa_id, numeroProceso: input.numeroProceso },
        ipOrigen: ip,
        userAgent,
      });

      return causa;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene causas con filtros (vista interna - incluye IDs reales)
   */
  async getCausas(filtros: FiltrosCausas): Promise<{ causas: Causa[]; total: number }> {
    const client = await casesPool.connect();

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filtros.estadoProcesal) {
        conditions.push(`estado_procesal = $${paramIndex}`);
        params.push(filtros.estadoProcesal);
        paramIndex++;
      }

      if (filtros.materia) {
        conditions.push(`materia = $${paramIndex}`);
        params.push(filtros.materia);
        paramIndex++;
      }

      if (filtros.unidadJudicial) {
        conditions.push(`unidad_judicial = $${paramIndex}`);
        params.push(filtros.unidadJudicial);
        paramIndex++;
      }

      if (filtros.juezAsignadoId) {
        conditions.push(`juez_asignado_id = $${paramIndex}`);
        params.push(filtros.juezAsignadoId);
        paramIndex++;
      }

      if (filtros.busqueda) {
        // Buscar según el tipo especificado
        if (filtros.tipoBusqueda === "actor") {
          conditions.push(`actor_nombre ILIKE $${paramIndex}`);
          params.push(`%${filtros.busqueda}%`);
        } else if (filtros.tipoBusqueda === "demandado") {
          conditions.push(`demandado_nombre ILIKE $${paramIndex}`);
          params.push(`%${filtros.busqueda}%`);
        } else {
          // Por defecto buscar en número de proceso, materia, actor y demandado
          conditions.push(`(
            numero_proceso ILIKE $${paramIndex} OR 
            materia ILIKE $${paramIndex} OR
            actor_nombre ILIKE $${paramIndex} OR
            demandado_nombre ILIKE $${paramIndex}
          )`);
          params.push(`%${filtros.busqueda}%`);
        }
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Contar total
      const countResult = await client.query(
        `SELECT COUNT(*) FROM causas ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Paginación
      const page = filtros.page || 1;
      const pageSize = filtros.pageSize || 20;
      const offset = (page - 1) * pageSize;

      params.push(pageSize, offset);

      const result = await client.query(
        `SELECT * FROM causas ${whereClause}
         ORDER BY fecha_creacion DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        causas: result.rows as Causa[],
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene causas públicas (vista ciudadana - solo pseudónimos, sin IDs reales)
   */
  async getCausasPublicas(filtros: FiltrosCausas): Promise<{ causas: CausaPublica[]; total: number }> {
    const { causas, total } = await this.getCausas(filtros);

    return {
      causas: causas.map(this.toPublic),
      total,
    };
  }

  /**
   * Obtiene una causa por ID (vista interna)
   */
  async getCausaById(id: number): Promise<Causa | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM causas WHERE causa_id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as Causa;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene una causa por número de proceso (vista pública)
   */
  async getCausaByNumeroProceso(numeroProceso: string): Promise<CausaPublica | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM causas WHERE numero_proceso = $1",
        [numeroProceso]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toPublic(result.rows[0] as Causa);
    } finally {
      client.release();
    }
  }

  /**
   * Cambia el estado procesal de una causa
   */
  async cambiarEstadoProcesal(
    causaId: number,
    nuevoEstado: EstadoProcesal,
    usuarioId: number,
    ip: string,
    userAgent: string
  ): Promise<Causa | null> {
    const client = await casesPool.connect();

    try {
      const actual = await client.query(
        "SELECT * FROM causas WHERE causa_id = $1",
        [causaId]
      );

      if (actual.rows.length === 0) {
        return null;
      }

      const estadoAnterior = actual.rows[0].estado_procesal;

      const result = await client.query(
        `UPDATE causas SET estado_procesal = $1 WHERE causa_id = $2 RETURNING *`,
        [nuevoEstado, causaId]
      );

      await auditService.log({
        tipoEvento: "CAMBIO_ESTADO",
        usuarioId,
        moduloAfectado: "CASOS",
        descripcion: `Estado de causa ${actual.rows[0].numero_proceso} cambiado de ${estadoAnterior} a ${nuevoEstado}`,
        datosAfectados: { causaId, estadoAnterior, estadoNuevo: nuevoEstado },
        ipOrigen: ip,
        userAgent,
      });

      return result.rows[0] as Causa;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el expediente de una causa
   */
  async getExpediente(causaId: number): Promise<Expediente | null> {
    const client = await casesPool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM expedientes WHERE causa_id = $1",
        [causaId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as Expediente;
    } finally {
      client.release();
    }
  }

  /**
   * Convierte causa a formato público (sin IDs reales de funcionarios)
   * Nota: Actor y demandado son información pública, solo funcionarios usan pseudónimos
   */
  private toPublic(c: Causa): CausaPublica {
    return {
      causaId: c.causa_id,
      numeroProceso: c.numero_proceso,
      materia: c.materia,
      tipoProceso: c.tipo_proceso,
      unidadJudicial: c.unidad_judicial,
      juezPseudonimo: c.juez_pseudonimo, // Funcionario: pseudónimo
      estadoProcesal: c.estado_procesal,
      fechaCreacion: c.fecha_creacion,
      descripcion: c.descripcion,
      // Partes procesales: información pública (nombres reales)
      actorNombre: c.actor_nombre,
      actorIdentificacion: c.actor_identificacion,
      demandadoNombre: c.demandado_nombre,
      demandadoIdentificacion: c.demandado_identificacion,
      // Funcionario que registró: pseudónimo
      secretarioPseudonimo: c.secretario_pseudonimo,
    };
  }

  /**
   * Obtiene actuaciones públicas de una causa (sin datos sensibles)
   * Usa la tabla documentos como registro de actuaciones procesales
   * Solo retorna información que la ley permite ver públicamente
   * Incluye indicador de si el documento tiene archivo descargable
   */
  async getActuacionesPublicas(causaId: number): Promise<ActuacionPublica[]> {
    const client = await casesPool.connect();

    try {
      // Consulta documentos como actuaciones, EXCLUYENDO datos sensibles de funcionarios
      // Incluye información sobre si tiene archivo para descarga pública
      const result = await client.query(
        `SELECT 
          d.id as actuacion_id,
          d.tipo as tipo_actuacion,
          d.fecha_subida as fecha_actuacion,
          d.nombre as descripcion,
          d.estado,
          d.ruta,
          d.mime_type,
          -- Solo consultar pseudónimo si hay referencia al funcionario
          COALESCE(
            (SELECT pseudonimo_publico FROM mapa_pseudonimos WHERE juez_id_real = d.subido_por_id),
            'Sistema'
          ) as funcionario_pseudonimo
        FROM documentos d
        WHERE d.causa_id = $1
        AND d.estado != 'eliminado'
        ORDER BY d.fecha_subida DESC`,
        [causaId]
      );

      return result.rows.map((row) => ({
        actuacionId: row.actuacion_id,
        tipoActuacion: row.tipo_actuacion || "Documento",
        fechaActuacion: row.fecha_actuacion,
        descripcion: row.descripcion || "Sin descripción",
        estado: row.estado || "activo",
        funcionarioPseudonimo: row.funcionario_pseudonimo || "Sistema",
        // Indicar si tiene archivo descargable (ruta no nula y es PDF público)
        tieneArchivo: !!row.ruta,
        mimeType: row.mime_type || "application/pdf",
      }));
    } finally {
      client.release();
    }
  }
}

export const causasService = new CausasService();
