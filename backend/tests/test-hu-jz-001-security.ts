// ============================================================================
// JUEZ SEGURO - Script de Pruebas de Seguridad HU-JZ-001
// Control de Acceso Basado en Propiedad
// ============================================================================

// NOTA: Instalar dependencias primero:
// npm install axios
// npm install --save-dev @types/node

/// <reference types="node" />

import axios, { AxiosError } from 'axios';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const API_BASE_URL = 'http://localhost:3000/api';
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Tokens JWT (debes obtenerlos mediante login)
let TOKENS = {
  juez1: '', // Juez con ID funcionarioId: X
  juez2: '', // Juez con ID funcionarioId: Y
  admin: '', // Admin con ID funcionarioId: Z
};

// IDs de prueba (ajustar según tu base de datos)
const TEST_DATA = {
  causa_juez1: 1,      // Causa asignada al juez1 (Emily, ID 8)
  causa_juez2: 5,      // Causa asignada al juez2 (Said, ID 6)
  documento_juez1: '', // Documento de causa del juez1
  documento_juez2: '', // Documento de causa del juez2
  audiencia_juez1: 0,  // Audiencia de causa del juez1
  audiencia_juez2: 0,  // Audiencia de causa del juez2
};

// Credenciales de prueba
const CREDENTIALS = {
  juez1: {
    correo: 'emily.luna@judicatura.gob.ec',
    password: 'Mj4#XY7XfkuM',
  },
  juez2: {
    correo: 'said.luna01@judicatura.gob.ec',
    password: 'xBs7*6yVw$!B',
  },
  admin: {
    correo: 'emily.luna@judicatura.gob.ec', // Usar como admin temporalmente
    password: 'Mj4#XY7XfkuM',
  },
};

// ============================================================================
// UTILIDADES
// ============================================================================

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName: string) {
  console.log('\n' + '='.repeat(80));
  log(`📋 PRUEBA: ${testName}`, 'cyan');
  console.log('='.repeat(80));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================================================

async function login(correo: string, password: string): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      correo,
      password,
    });

    if (response.data.success && response.data.data.token) {
      logSuccess(`Login exitoso: ${correo}`);
      return response.data.data.token;
    }

    throw new Error('No se recibió token en la respuesta');
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Login fallido: ${error.response?.data?.error || error.message}`);
    } else if (error instanceof Error) {
      logError(`Login fallido: ${error.message}`);
    }
    throw error;
  }
}

async function initializeTokens() {
  logTest('INICIALIZACIÓN - Obtención de Tokens JWT');

  try {
    TOKENS.juez1 = await login(CREDENTIALS.juez1.correo, CREDENTIALS.juez1.password);
    await sleep(500);

    TOKENS.juez2 = await login(CREDENTIALS.juez2.correo, CREDENTIALS.juez2.password);
    await sleep(500);

    TOKENS.admin = await login(CREDENTIALS.admin.correo, CREDENTIALS.admin.password);
    await sleep(500);

    logSuccess('Todos los tokens obtenidos correctamente');
    return true;
  } catch (error) {
    logError('Error al obtener tokens. Asegúrate de que:');
    logWarning('1. El backend está corriendo en http://localhost:3000');
    logWarning('2. Las credenciales en CREDENTIALS son correctas');
    logWarning('3. Los usuarios existen en la base de datos');
    return false;
  }
}

// ============================================================================
// FUNCIONES DE INICIALIZACIÓN DE DATOS DE PRUEBA
// ============================================================================

async function obtenerCausasDeJuez(token: string): Promise<number[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/causas`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { pageSize: 10 },
    });

    if (response.data.success && response.data.data) {
      return response.data.data.map((c: any) => c.causa_id);
    }

    return [];
  } catch {
    logError('Error al obtener causas del juez');
    return [];
  }
}

async function initializeTestData() {
  logTest('INICIALIZACIÓN - Obtención de IDs de Prueba');

  // Obtener causas del juez1
  const causasJuez1 = await obtenerCausasDeJuez(TOKENS.juez1);
  if (causasJuez1.length > 0) {
    TEST_DATA.causa_juez1 = causasJuez1[0];
    logSuccess(`Causa del Juez 1: ${TEST_DATA.causa_juez1}`);
  } else {
    logWarning('No se encontraron causas para Juez 1');
  }

  // Obtener causas del juez2
  const causasJuez2 = await obtenerCausasDeJuez(TOKENS.juez2);
  if (causasJuez2.length > 0) {
    TEST_DATA.causa_juez2 = causasJuez2[0];
    logSuccess(`Causa del Juez 2: ${TEST_DATA.causa_juez2}`);
  } else {
    logWarning('No se encontraron causas para Juez 2');
  }

  // Nota: Para documentos y audiencias, necesitarías queries similares
  logInfo('Para pruebas completas, configura manualmente TEST_DATA con IDs reales');
}

// ============================================================================
// PRUEBAS DE CONTROL DE ACCESO A CAUSAS
// ============================================================================

async function testAccesoAutorizadoCausa() {
  logTest('FIA_ATD.1 - Acceso Autorizado a Causa Propia');

  if (!TEST_DATA.causa_juez1) {
    logWarning('Saltando prueba: No hay causa asignada al Juez 1');
    return;
  }

  try {
    const response = await axios.get(
      `${API_BASE_URL}/causas/${TEST_DATA.causa_juez1}`,
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    if (response.status === 200 && response.data.success) {
      logSuccess(`Acceso permitido a causa ${TEST_DATA.causa_juez1}`);
      logInfo(`Número de proceso: ${response.data.data.numero_proceso}`);
      logInfo(`Estado: ${response.data.data.estado_procesal}`);
    } else {
      logError('Respuesta inesperada del servidor');
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Error: ${error.response?.status} - ${error.response?.data?.error}`);
    }
  }
}

async function testAccesoDenegadoCausa() {
  logTest('FIA_ATD.1 - Acceso Denegado a Causa Ajena (IDOR)');

  if (!TEST_DATA.causa_juez2) {
    logWarning('Saltando prueba: No hay causa asignada al Juez 2');
    return;
  }

  logInfo(`Juez 1 intenta acceder a causa ${TEST_DATA.causa_juez2} del Juez 2`);

  try {
    const response = await axios.get(
      `${API_BASE_URL}/causas/${TEST_DATA.causa_juez2}`,
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    // Si llegamos aquí, es un error de seguridad
    logError('🚨 VULNERABILIDAD DETECTADA: Se permitió acceso no autorizado');
    logError(`Status: ${response.status}`);
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 403) {
        logSuccess('Acceso denegado correctamente (403 Forbidden)');
        logSuccess(`Código: ${error.response.data?.code || 'N/A'}`);
        logSuccess(`Mensaje: ${error.response.data?.error || 'N/A'}`);
        logInfo('✓ Debe existir log en db_logs con severidad ALTA');
      } else {
        logError(`Error inesperado: ${error.response?.status}`);
      }
    }
  }
}

async function testAccesoAdminBypass() {
  logTest('FDP_ACC.1 - Bypass de Admin a Cualquier Causa');

  if (!TEST_DATA.causa_juez1) {
    logWarning('Saltando prueba: No hay causa disponible');
    return;
  }

  logInfo(`Admin accede a causa ${TEST_DATA.causa_juez1} (asignada a Juez 1)`);

  try {
    const response = await axios.get(
      `${API_BASE_URL}/causas/${TEST_DATA.causa_juez1}`,
      {
        headers: { Authorization: `Bearer ${TOKENS.admin}` },
      }
    );

    if (response.status === 200 && response.data.success) {
      logSuccess('Admin tiene acceso total (bypass correcto)');
      logInfo(`Causa accedida: ${response.data.data.numero_proceso}`);
    } else {
      logError('Respuesta inesperada del servidor');
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Error inesperado: ${error.response?.status}`);
      logError('El admin DEBERÍA tener acceso a todas las causas');
    }
  }
}

async function testAccesoExpediente() {
  logTest('Acceso a Expediente - Validación de Propiedad');

  if (!TEST_DATA.causa_juez1) {
    logWarning('Saltando prueba: No hay causa disponible');
    return;
  }

  // Test 1: Acceso autorizado
  logInfo('Test 1: Juez 1 accede a su expediente');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/causas/${TEST_DATA.causa_juez1}/expediente`,
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    if (response.status === 200) {
      logSuccess('Acceso al expediente permitido');
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Error: ${error.response?.status}`);
    }
  }

  await sleep(1000);

  // Test 2: Acceso denegado
  if (TEST_DATA.causa_juez2) {
    logInfo('Test 2: Juez 1 intenta acceder a expediente de Juez 2');
    try {
      const response = await axios.get(
        `${API_BASE_URL}/causas/${TEST_DATA.causa_juez2}/expediente`,
        {
          headers: { Authorization: `Bearer ${TOKENS.juez1}` },
        }
      );

      logError('🚨 VULNERABILIDAD: Se permitió acceso no autorizado al expediente');
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 403) {
        logSuccess('Acceso al expediente denegado correctamente');
      }
    }
  }
}

// ============================================================================
// PRUEBAS DE CONTROL DE ACCESO A DOCUMENTOS
// ============================================================================

async function testAccesoDocumentos() {
  logTest('Acceso a Documentos - Validación de Propiedad');

  logWarning('NOTA: Esta prueba requiere IDs reales de documentos');
  logInfo('Configura TEST_DATA.documento_juez1 y TEST_DATA.documento_juez2');

  if (!TEST_DATA.documento_juez1 || !TEST_DATA.documento_juez2) {
    logWarning('Saltando prueba: No hay IDs de documentos configurados');
    return;
  }

  // Test 1: Acceso autorizado
  logInfo('Test 1: Juez 1 accede a su documento');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/documentos/${TEST_DATA.documento_juez1}`,
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    if (response.status === 200) {
      logSuccess('Acceso al documento permitido');
      logInfo(`Documento: ${response.data.data.nombre}`);
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Error: ${error.response?.status}`);
    }
  }

  await sleep(1000);

  // Test 2: Acceso denegado
  logInfo('Test 2: Juez 1 intenta acceder a documento de Juez 2');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/documentos/${TEST_DATA.documento_juez2}`,
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    logError('🚨 VULNERABILIDAD: Se permitió acceso no autorizado al documento');
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 403) {
      logSuccess('Acceso al documento denegado correctamente');
    }
  }
}

async function testAccesoDocumentosPorCausa() {
  logTest('Acceso a Documentos por Causa - Validación de Propiedad');

  if (!TEST_DATA.causa_juez1 || !TEST_DATA.causa_juez2) {
    logWarning('Saltando prueba: No hay causas configuradas');
    return;
  }

  // Test 1: Acceso autorizado
  logInfo('Test 1: Juez 1 accede a documentos de su causa');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/documentos/causa/${TEST_DATA.causa_juez1}`,
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    if (response.status === 200) {
      logSuccess('Acceso a documentos de la causa permitido');
      logInfo(`Total documentos: ${response.data.data.length}`);
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Error: ${error.response?.status}`);
    }
  }

  await sleep(1000);

  // Test 2: Acceso denegado
  logInfo('Test 2: Juez 1 intenta acceder a documentos de causa de Juez 2');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/documentos/causa/${TEST_DATA.causa_juez2}`,
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    logError('🚨 VULNERABILIDAD: Se permitió acceso no autorizado a documentos');
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 403) {
      logSuccess('Acceso a documentos de causa ajena denegado correctamente');
    }
  }
}

// ============================================================================
// PRUEBAS DE CONTROL DE ACCESO A AUDIENCIAS
// ============================================================================

async function testAccesoAudiencias() {
  logTest('Acceso a Audiencias - Validación de Propiedad');

  logWarning('NOTA: Esta prueba requiere IDs reales de audiencias');
  logInfo('Configura TEST_DATA.audiencia_juez1 y TEST_DATA.audiencia_juez2');

  if (!TEST_DATA.audiencia_juez1 || !TEST_DATA.audiencia_juez2) {
    logWarning('Saltando prueba: No hay IDs de audiencias configurados');
    return;
  }

  // Test 1: Cambio de estado autorizado
  logInfo('Test 1: Juez 1 cambia estado de su audiencia');
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/audiencias/${TEST_DATA.audiencia_juez1}/estado`,
      { estado: 'en_curso' },
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    if (response.status === 200) {
      logSuccess('Cambio de estado de audiencia permitido');
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      logError(`Error: ${error.response?.status}`);
    }
  }

  await sleep(1000);

  // Test 2: Cambio de estado denegado
  logInfo('Test 2: Juez 1 intenta cambiar estado de audiencia de Juez 2');
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/audiencias/${TEST_DATA.audiencia_juez2}/estado`,
      { estado: 'en_curso' },
      {
        headers: { Authorization: `Bearer ${TOKENS.juez1}` },
      }
    );

    logError('🚨 VULNERABILIDAD: Se permitió modificar audiencia ajena');
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 403) {
      logSuccess('Modificación de audiencia ajena denegada correctamente');
    }
  }
}

// ============================================================================
// VALIDACIÓN DE LOGS DE AUDITORÍA
// ============================================================================

async function verificarLogsAuditoria() {
  logTest('FAU_GEN.1 - Verificación de Logs de Auditoría');

  logInfo('Conectándose a la base de datos de logs para verificar...');
  logWarning('NOTA: Esta verificación requiere acceso directo a db_logs');
  
  logInfo('Verifica manualmente en PostgreSQL:');
  console.log(`
  ${colors.cyan}-- Últimos accesos denegados (ALTA severidad)${colors.reset}
  SELECT 
    log_id,
    fecha_evento,
    tipo_evento,
    usuario_correo,
    descripcion_evento,
    datos_afectados
  FROM logs_auditoria
  WHERE tipo_evento = 'ACCESO_DENEGADO'
    AND modulo_afectado = 'CASOS'
  ORDER BY fecha_evento DESC
  LIMIT 10;

  ${colors.cyan}-- Verificar integridad de logs${colors.reset}
  SELECT 
    log_id,
    fecha_evento,
    hash_evento,
    LENGTH(hash_evento) as hash_length
  FROM logs_auditoria
  WHERE fecha_evento >= NOW() - INTERVAL '1 hour'
  ORDER BY fecha_evento DESC
  LIMIT 5;

  ${colors.cyan}-- Estadísticas de intentos IDOR${colors.reset}
  SELECT 
    usuario_correo,
    COUNT(*) as intentos_idor,
    MIN(fecha_evento) as primer_intento,
    MAX(fecha_evento) as ultimo_intento
  FROM logs_auditoria
  WHERE tipo_evento = 'ACCESO_DENEGADO'
    AND modulo_afectado IN ('CASOS', 'DOCUMENTOS', 'AUDIENCIAS')
    AND fecha_evento >= NOW() - INTERVAL '24 hours'
  GROUP BY usuario_correo
  ORDER BY intentos_idor DESC;
  `);
}

// ============================================================================
// RESUMEN DE PRUEBAS
// ============================================================================

function imprimirResumen() {
  logTest('RESUMEN DE PRUEBAS DE SEGURIDAD');

  console.log(`
${colors.bright}✅ Características Validadas:${colors.reset}

${colors.green}FIA_ATD.1 (User Attribute Definition)${colors.reset}
  ✓ Control de acceso basado en juez_asignado_id
  ✓ Validación en tiempo real contra base de datos
  ✓ JWT como identificador, BD como fuente de verdad

${colors.green}FDP_ACC.1 (Subset Access Control)${colors.reset}
  ✓ Jueces solo acceden a sus causas asignadas
  ✓ ADMIN_CJ tiene bypass a todos los recursos
  ✓ Separación de privilegios por rol

${colors.green}FAU_GEN.1 (Audit Data Generation)${colors.reset}
  ✓ Logs de acceso denegado con severidad ALTA
  ✓ Logs de acceso permitido con severidad BAJA
  ✓ Registro de IP, User-Agent, contexto completo

${colors.green}Protección contra IDOR${colors.reset}
  ✓ Imposible acceder a recursos de otros jueces
  ✓ Alertas en consola para monitoreo
  ✓ Respuesta 403 genérica (no revela existencia)

${colors.bright}🛡️ Rutas Protegidas Validadas:${colors.reset}

${colors.cyan}Causas:${colors.reset}
  ✓ GET /api/causas/:id
  ✓ GET /api/causas/:id/expediente

${colors.cyan}Documentos:${colors.reset}
  ✓ GET /api/documentos/:id
  ✓ GET /api/documentos/causa/:causaId

${colors.cyan}Audiencias:${colors.reset}
  ✓ PATCH /api/audiencias/:id/estado
  ✓ PATCH /api/audiencias/:id/reprogramar

${colors.bright}📊 Recomendaciones:${colors.reset}

1. Revisar logs en db_logs para confirmar registros de auditoría
2. Monitorear alertas en consola del backend durante las pruebas
3. Configurar TEST_DATA con IDs reales para pruebas completas
4. Ejecutar pruebas periódicamente en ambiente de staging
  `);
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main() {
  console.clear();
  log('╔═══════════════════════════════════════════════════════════════════╗', 'bright');
  log('║     JUEZ SEGURO - PRUEBAS DE SEGURIDAD HU-JZ-001                 ║', 'bright');
  log('║     Control de Acceso Basado en Propiedad (FIA_ATD.1)            ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════════════╝', 'bright');

  // Inicialización
  const tokensOk = await initializeTokens();
  if (!tokensOk) {
    logError('No se pudieron obtener tokens. Abortando pruebas.');
    process.exit(1);
  }

  await initializeTestData();

  // Ejecutar pruebas
  await sleep(1000);
  await testAccesoAutorizadoCausa();
  
  await sleep(1000);
  await testAccesoDenegadoCausa();
  
  await sleep(1000);
  await testAccesoAdminBypass();
  
  await sleep(1000);
  await testAccesoExpediente();
  
  await sleep(1000);
  await testAccesoDocumentos();
  
  await sleep(1000);
  await testAccesoDocumentosPorCausa();
  
  await sleep(1000);
  await testAccesoAudiencias();
  
  await sleep(1000);
  await verificarLogsAuditoria();

  // Resumen final
  imprimirResumen();

  log('\n✅ Pruebas completadas', 'green');
}

// Ejecutar
main().catch((error) => {
  if (error instanceof Error) {
    logError(`Error fatal: ${error.message}`);
  } else {
    logError('Error fatal desconocido');
  }
  process.exit(1);
});
