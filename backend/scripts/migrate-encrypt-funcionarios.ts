// ============================================================================
// Script de Migración: Encriptar datos existentes de funcionarios
// Ejecutar una sola vez para encriptar datos legacy
// ============================================================================

import { config } from "dotenv";
config(); // Cargar variables de entorno

import { Pool } from "pg";
import crypto from "crypto";

// Configuración de encriptación (debe coincidir con encryption.service.ts)
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ENCRYPTED_PREFIX = "ENC:";

// Derivar clave de encriptación
const KEY_BASE = process.env.DATA_ENCRYPTION_KEY || 
                 process.env.DOCS_ENCRYPTION_KEY || 
                 "desarrollo-temporal-key-no-usar-en-produccion";

const encryptionKey = crypto.pbkdf2Sync(
  KEY_BASE,
  "juez-seguro-db-encryption-salt-v1",
  100000,
  KEY_LENGTH,
  "sha256"
);

// Pool de conexión - valores hardcodeados para la migración
const pool = new Pool({
  host: "localhost",
  port: 5435,
  database: "db_usuarios",
  user: "admin_users",
  password: "JuezSeguroUsers2024Dev",
});

/**
 * Encripta un texto
 */
function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  
  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Verifica si un texto ya está encriptado
 */
function isEncrypted(text: string | null): boolean {
  return text?.startsWith(ENCRYPTED_PREFIX) ?? false;
}

async function migrarDatos() {
  const client = await pool.connect();
  
  try {
    console.log("🔐 Iniciando migración de encriptación de datos...\n");
    
    // Obtener todos los funcionarios
    const result = await client.query(
      "SELECT funcionario_id, identificacion, nombres_completos FROM funcionarios"
    );
    
    console.log(`📊 Total de funcionarios: ${result.rows.length}`);
    
    let encriptados = 0;
    let yaEncriptados = 0;
    let errores = 0;
    
    for (const row of result.rows) {
      const { funcionario_id, identificacion, nombres_completos } = row;
      
      // Verificar si ya están encriptados
      const idEncriptado = isEncrypted(identificacion);
      const nombreEncriptado = isEncrypted(nombres_completos);
      
      if (idEncriptado && nombreEncriptado) {
        yaEncriptados++;
        console.log(`  ⏭️  Funcionario #${funcionario_id}: Ya encriptado`);
        continue;
      }
      
      try {
        const nuevoId = idEncriptado ? identificacion : encrypt(identificacion);
        const nuevoNombre = nombreEncriptado ? nombres_completos : encrypt(nombres_completos);
        
        await client.query(
          `UPDATE funcionarios 
           SET identificacion = $1, nombres_completos = $2
           WHERE funcionario_id = $3`,
          [nuevoId, nuevoNombre, funcionario_id]
        );
        
        encriptados++;
        console.log(`  ✅ Funcionario #${funcionario_id}: Encriptado exitosamente`);
      } catch (error) {
        errores++;
        console.error(`  ❌ Funcionario #${funcionario_id}: Error - ${error}`);
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("📈 RESUMEN DE MIGRACIÓN:");
    console.log("=".repeat(50));
    console.log(`  ✅ Encriptados: ${encriptados}`);
    console.log(`  ⏭️  Ya encriptados: ${yaEncriptados}`);
    console.log(`  ❌ Errores: ${errores}`);
    console.log(`  📊 Total procesados: ${result.rows.length}`);
    console.log("=".repeat(50));
    
    if (errores === 0) {
      console.log("\n🎉 Migración completada exitosamente!");
    } else {
      console.log("\n⚠️ Migración completada con errores. Revisar logs.");
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
migrarDatos().catch(console.error);
