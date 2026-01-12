// ============================================================================
// JUEZ SEGURO BACKEND - Conexiones a Base de Datos
// Pools separados para cada base de datos (Common Criteria)
// ============================================================================

import { Pool, PoolConfig } from "pg";
import { config } from "../config/index.js";
import { loggers } from "../services/logger.service.js";

const log = loggers.db;

// ============================================================================
// Pool de conexión - Base de Datos de Usuarios (FIA)
// ============================================================================
const usersPoolConfig: PoolConfig = {
  host: config.dbUsers.host,
  port: config.dbUsers.port,
  database: config.dbUsers.database,
  user: config.dbUsers.user,
  password: config.dbUsers.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const usersPool = new Pool(usersPoolConfig);

// ============================================================================
// Pool de conexión - Base de Datos de Casos (FDP)
// ============================================================================
const casesPoolConfig: PoolConfig = {
  host: config.dbCases.host,
  port: config.dbCases.port,
  database: config.dbCases.database,
  user: config.dbCases.user,
  password: config.dbCases.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const casesPool = new Pool(casesPoolConfig);

// ============================================================================
// Pool de conexión - Base de Datos de Logs (FAU)
// ============================================================================
const logsPoolConfig: PoolConfig = {
  host: config.dbLogs.host,
  port: config.dbLogs.port,
  database: config.dbLogs.database,
  user: config.dbLogs.user,
  password: config.dbLogs.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const logsPool = new Pool(logsPoolConfig);

// ============================================================================
// Funciones de utilidad
// ============================================================================

/**
 * Verifica la conexión a todas las bases de datos
 */
export async function testConnections(): Promise<{
  users: boolean;
  cases: boolean;
  logs: boolean;
}> {
  const results = { users: false, cases: false, logs: false };

  try {
    const usersClient = await usersPool.connect();
    await usersClient.query("SELECT 1");
    usersClient.release();
    results.users = true;
    log.info("Conexión a db_usuarios establecida");
  } catch (error) {
    log.error("Error conectando a db_usuarios:", error);
  }

  try {
    const casesClient = await casesPool.connect();
    await casesClient.query("SELECT 1");
    casesClient.release();
    results.cases = true;
    log.info("Conexión a db_casos establecida");
  } catch (error) {
    log.error("Error conectando a db_casos:", error);
  }

  try {
    const logsClient = await logsPool.connect();
    await logsClient.query("SELECT 1");
    logsClient.release();
    results.logs = true;
    log.info("Conexión a db_logs establecida");
  } catch (error) {
    log.error("Error conectando a db_logs:", error);
  }

  return results;
}

/**
 * Cierra todas las conexiones (para shutdown limpio)
 */
export async function closeConnections(): Promise<void> {
  await Promise.all([
    usersPool.end(),
    casesPool.end(),
    logsPool.end(),
  ]);
  log.info("Todas las conexiones de base de datos cerradas");
}

export default {
  users: usersPool,
  cases: casesPool,
  logs: logsPool,
  testConnections,
  closeConnections,
};
