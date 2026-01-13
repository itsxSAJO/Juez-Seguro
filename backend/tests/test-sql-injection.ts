/**
 * Test de Protección contra SQL Injection y Validación de Entrada
 * 
 * Este script prueba:
 * 1. Middleware de sanitización bloquea SQL Injection
 * 2. Validadores Zod imponen límites de longitud
 * 3. Filtrado de caracteres peligrosos
 */

// Importar validadores
import { z } from "zod";

// ============================================================================
// PARTE 1: Tests de SQL Injection (middleware de sanitización)
// ============================================================================

// Patrones actualizados - más específicos para minimizar falsos positivos
const SQL_INJECTION_PATTERNS = [
  // Comentarios SQL dentro de contexto sospechoso
  /'\s*--/g,                          // '-- (comentario después de comilla)
  /\/\*.*\*\//g,                      // /* cualquier cosa */ (comentario de bloque)
  
  // UNION SELECT es casi siempre malicioso
  /\bUNION\s+ALL\s+SELECT\b/gi,
  /\bUNION\s+SELECT\b/gi,
  
  // Comandos DDL/DML con contexto sospechoso
  /'\s*;\s*DROP\b/gi,                 // '; DROP (intento de encadenar DROP)
  /'\s*;\s*DELETE\b/gi,               // '; DELETE
  /'\s*;\s*UPDATE\b/gi,               // '; UPDATE
  /'\s*;\s*INSERT\b/gi,               // '; INSERT
  /'\s*;\s*ALTER\b/gi,                // '; ALTER
  /'\s*;\s*TRUNCATE\b/gi,             // '; TRUNCATE
  
  // Bypass de autenticación - estos son casi siempre ataques
  /'\s*OR\s+'?1'?\s*=\s*'?1/gi,       // ' OR '1'='1
  /'\s*OR\s+''='/gi,                  // ' OR ''='
  /'\s*OR\s+TRUE\b/gi,                // ' OR TRUE
  /"\s*OR\s+"?1"?\s*=\s*"?1/gi,       // " OR "1"="1
  /'\s*AND\s+'?1'?\s*=\s*'?1/gi,      // ' AND '1'='1
  /'\s*;\s*--/gi,                     // '; --
  
  // Funciones peligrosas de time-based injection
  /\bSLEEP\s*\(\s*\d+\s*\)/gi,        // SLEEP(5)
  /\bBENCHMARK\s*\(/gi,               // BENCHMARK(
  /\bWAITFOR\s+DELAY\b/gi,            // WAITFOR DELAY
  /\bPG_SLEEP\s*\(/gi,                // pg_sleep(
  
  // Funciones de lectura de archivos
  /\bLOAD_FILE\s*\(/gi,
  /\bINTO\s+(OUT|DUMP)FILE\b/gi,
  
  // Ejecución de procedimientos
  /\bEXEC\s+(sp_|xp_)/gi,             // EXEC sp_ o xp_ (procedimientos SQL Server)
  
  // Información del sistema - contexto de extracción
  /'\s*;\s*SELECT\s+.*@@\w+/gi,       // '; SELECT @@version
  /'\s*;\s*SELECT\s+.*CURRENT_USER/gi,
];

function containsSQLInjection(value: string): boolean {
  if (typeof value !== "string") return false;
  
  const normalizedValue = value
    .replace(/\s+/g, " ")
    .replace(/\\+/g, "")
    .toLowerCase();

  return SQL_INJECTION_PATTERNS.some((pattern) => {
    const testPattern = new RegExp(pattern.source, "gi");
    return testPattern.test(normalizedValue);
  });
}

// Casos de prueba
const testCases = [
  // Casos maliciosos que DEBEN ser detectados
  { input: "admin' OR '1'='1", shouldBlock: true, description: "Bypass de autenticación básico" },
  { input: "admin'--", shouldBlock: true, description: "Comentario SQL con --" },
  { input: "admin'/*comment*/", shouldBlock: true, description: "Comentario SQL con /* */" },
  { input: "admin'; DROP TABLE users;", shouldBlock: true, description: "SQL Injection con DROP TABLE" },
  { input: "1 UNION SELECT * FROM users", shouldBlock: true, description: "UNION SELECT" },
  { input: "' OR ''='", shouldBlock: true, description: "Bypass alternativo" },
  { input: "admin' AND 1=1--", shouldBlock: true, description: "AND 1=1" },
  { input: "'; DELETE FROM users", shouldBlock: true, description: "DELETE statement" },
  { input: "test'; EXEC sp_executesql", shouldBlock: true, description: "EXEC procedure" },
  { input: "1' WAITFOR DELAY '0:0:5'", shouldBlock: true, description: "Time-based blind SQLi" },
  { input: "' OR SLEEP(5)", shouldBlock: true, description: "SLEEP injection" },
  { input: "'; pg_sleep(5);", shouldBlock: true, description: "PostgreSQL sleep" },
  { input: "\" OR \"1\"=\"1", shouldBlock: true, description: "Bypass con comillas dobles" },
  
  // Casos legítimos que NO deben ser bloqueados
  { input: "usuario@email.com", shouldBlock: false, description: "Email normal" },
  { input: "Juan Carlos Pérez", shouldBlock: false, description: "Nombre con tildes" },
  { input: "O'Connor", shouldBlock: false, description: "Nombre con apóstrofe" },
  { input: "McDonald's", shouldBlock: false, description: "Nombre de empresa con apóstrofe" },
  { input: "SELECT * FROM menu", shouldBlock: false, description: "Palabra 'SELECT' en texto normal" },
  { input: "Calle Union 123", shouldBlock: false, description: "Palabra 'UNION' en dirección" },
  { input: "Caso #12345", shouldBlock: false, description: "Número de caso con #" },
  { input: "El documento - primera versión", shouldBlock: false, description: "Guión normal en texto" },
  { input: "contraseña123", shouldBlock: false, description: "Contraseña normal" },
  { input: "https://example.com/path?param=value", shouldBlock: false, description: "URL normal" },
  { input: "DROP off your documents at reception", shouldBlock: false, description: "Palabra DROP en contexto normal" },
  { input: "Please delete the old version", shouldBlock: false, description: "Palabra delete en contexto normal" },
];

console.log("=".repeat(70));
console.log("TEST DE PROTECCIÓN CONTRA SQL INJECTION");
console.log("=".repeat(70));
console.log("");

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const detected = containsSQLInjection(testCase.input);
  const success = detected === testCase.shouldBlock;
  
  if (success) {
    passed++;
    console.log(`✅ PASS: ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.shouldBlock ? "BLOCKED" : "ALLOWED"}, Got: ${detected ? "BLOCKED" : "ALLOWED"}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.shouldBlock ? "BLOCKED" : "ALLOWED"}, Got: ${detected ? "BLOCKED" : "ALLOWED"}`);
  }
  console.log("");
}

console.log("=".repeat(70));
console.log(`RESULTADOS SQL INJECTION: ${passed} passed, ${failed} failed`);
console.log("=".repeat(70));

// ============================================================================
// PARTE 2: Tests de Límites de Longitud y Caracteres
// ============================================================================

console.log("");
console.log("=".repeat(70));
console.log("TEST DE LÍMITES DE LONGITUD Y CARACTERES");
console.log("=".repeat(70));
console.log("");

// Simular los validadores
const PATRON_NOMBRE = /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s'\-]+$/;
const PATRON_TEXTO_GENERAL = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚüÜ\s.,;:\-¿?¡!()'"°/#@&]+$/;

const nombreSchema = z
  .string()
  .min(2, "Mínimo 2 caracteres")
  .max(100, "Máximo 100 caracteres")
  .regex(PATRON_NOMBRE, "Solo se permiten letras, espacios y guiones");

const descripcionSchema = z
  .string()
  .min(5, "Mínimo 5 caracteres")
  .max(2000, "Máximo 2000 caracteres")
  .regex(PATRON_TEXTO_GENERAL, "Caracteres no permitidos detectados");

interface LimitTest {
  schema: z.ZodSchema<any>;
  input: string;
  shouldPass: boolean;
  description: string;
}

const limitTests: LimitTest[] = [
  // Tests de longitud
  { schema: nombreSchema, input: "A", shouldPass: false, description: "Nombre muy corto (1 char)" },
  { schema: nombreSchema, input: "AB", shouldPass: true, description: "Nombre mínimo válido (2 chars)" },
  { schema: nombreSchema, input: "María José", shouldPass: true, description: "Nombre normal con tilde" },
  { schema: nombreSchema, input: "O'Brien", shouldPass: true, description: "Nombre con apóstrofe" },
  { schema: nombreSchema, input: "Jean-Pierre", shouldPass: true, description: "Nombre con guión" },
  { schema: nombreSchema, input: "A".repeat(100), shouldPass: true, description: "Nombre en límite máximo (100 chars)" },
  { schema: nombreSchema, input: "A".repeat(101), shouldPass: false, description: "Nombre excede límite (101 chars)" },
  { schema: nombreSchema, input: "A".repeat(10000), shouldPass: false, description: "Nombre flood attack (10000 chars)" },
  
  // Tests de caracteres inválidos en nombres
  { schema: nombreSchema, input: "Usuario123", shouldPass: false, description: "Nombre con números (inválido)" },
  { schema: nombreSchema, input: "Usuario<script>", shouldPass: false, description: "Nombre con script tag (inválido)" },
  { schema: nombreSchema, input: "Usuario;DROP", shouldPass: false, description: "Nombre con punto y coma (inválido)" },
  
  // Tests de descripción
  { schema: descripcionSchema, input: "Hola", shouldPass: false, description: "Descripción muy corta (4 chars)" },
  { schema: descripcionSchema, input: "Hola mundo", shouldPass: true, description: "Descripción mínima válida" },
  { schema: descripcionSchema, input: "Esta es una descripción normal con números 123 y puntuación.", shouldPass: true, description: "Descripción normal" },
  { schema: descripcionSchema, input: "A".repeat(2000), shouldPass: true, description: "Descripción en límite máximo (2000 chars)" },
  { schema: descripcionSchema, input: "A".repeat(2001), shouldPass: false, description: "Descripción excede límite (2001 chars)" },
  { schema: descripcionSchema, input: "A".repeat(100000), shouldPass: false, description: "Descripción flood attack (100000 chars - texto en griego)" },
  
  // Tests de caracteres especiales peligrosos
  { schema: descripcionSchema, input: "Texto con <script>alert(1)</script>", shouldPass: false, description: "Descripción con XSS" },
  { schema: descripcionSchema, input: "Texto con ${eval('code')}", shouldPass: false, description: "Descripción con template literal" },
];

let passedLimit = 0;
let failedLimit = 0;

for (const test of limitTests) {
  const result = test.schema.safeParse(test.input);
  const success = result.success === test.shouldPass;
  
  if (success) {
    passedLimit++;
    console.log(`✅ PASS: ${test.description}`);
    if (!result.success) {
      console.log(`   Error: ${result.error.errors[0].message}`);
    }
  } else {
    failedLimit++;
    console.log(`❌ FAIL: ${test.description}`);
    console.log(`   Input length: ${test.input.length}`);
    console.log(`   Expected: ${test.shouldPass ? "PASS" : "FAIL"}, Got: ${result.success ? "PASS" : "FAIL"}`);
    if (!result.success) {
      console.log(`   Error: ${result.error.errors[0].message}`);
    }
  }
  console.log("");
}

console.log("=".repeat(70));
console.log(`RESULTADOS LÍMITES: ${passedLimit} passed, ${failedLimit} failed`);
console.log("=".repeat(70));

// ============================================================================
// RESUMEN FINAL
// ============================================================================

console.log("");
console.log("=".repeat(70));
console.log("RESUMEN FINAL");
console.log("=".repeat(70));
console.log(`SQL Injection: ${passed}/${passed + failed} tests pasaron`);
console.log(`Límites/Caracteres: ${passedLimit}/${passedLimit + failedLimit} tests pasaron`);
console.log(`TOTAL: ${passed + passedLimit}/${passed + failed + passedLimit + failedLimit} tests pasaron`);
console.log("=".repeat(70));

if (failed > 0 || failedLimit > 0) {
  process.exit(1);
}
