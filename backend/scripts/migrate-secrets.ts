// ============================================================================
// JUEZ SEGURO - Script de Migración de Secretos a db_secrets
// ============================================================================
// Este script crea los secretos iniciales en la base de datos db_secrets.
// Los secretos se encriptan con AES-256-GCM usando la MASTER_KEY_PASSWORD.
//
// Uso:
//   cd backend
//   npx tsx scripts/migrate-secrets.ts
//
// O agregarlo a package.json:
//   "db:migrate-secrets": "tsx scripts/migrate-secrets.ts"
// ============================================================================

import crypto from "crypto";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import readline from "readline";

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ============================================================================
// CONSTANTES DE SEGURIDAD (mismas que SecretsManager)
// ============================================================================
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = "sha256";
const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PBKDF2_SALT = "JuezSeguro_FCS_2026_Salt";

// ============================================================================
// TIPOS
// ============================================================================
type TipoSecreto = "JWT" | "HMAC" | "AES" | "PKI" | "API" | "SMTP" | "OTRO";

interface SecretoInicial {
  nombre: string;
  tipo: TipoSecreto;
  descripcion: string;
  valorDefault?: string;
  generarAutomatico?: boolean;
  longitudGenerada?: number;
}

// ============================================================================
// SECRETOS A CREAR
// ============================================================================
const SECRETOS_INICIALES: SecretoInicial[] = [
  {
    nombre: "JWT_SECRET",
    tipo: "JWT",
    descripcion: "Secreto para firmar y verificar tokens JWT de autenticación",
    generarAutomatico: true,
    longitudGenerada: 64,
  },
  {
    nombre: "HMAC_SALT",
    tipo: "HMAC",
    descripcion: "Salt para generar pseudónimos de jueces con HMAC-SHA256",
    generarAutomatico: true,
    longitudGenerada: 32,
  },
  {
    nombre: "PFX_PASSWORD",
    tipo: "PKI",
    descripcion: "Contraseña para archivos de certificados PKI (.pfx/.p12)",
    valorDefault: "Seguridad2026!", // Solo para desarrollo
  },
  {
    nombre: "DOCS_ENCRYPTION_KEY",
    tipo: "AES",
    descripcion: "Clave AES-256 para encriptar documentos sensibles",
    generarAutomatico: true,
    longitudGenerada: 32,
  },
  {
    nombre: "SMTP_USER",
    tipo: "SMTP",
    descripcion: "Correo electrónico Gmail para envío de notificaciones",
    valorDefault: "consejo.judicatura20@gmail.com",
  },
  {
    nombre: "SMTP_PASSWORD",
    tipo: "SMTP",
    descripcion: "App Password de Gmail (requiere 2FA habilitado)",
    // App Password generada desde https://myaccount.google.com/apppasswords
    valorDefault: "eguyspukmrmgyqgi",
  },
];

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno requerida: ${name}`);
  }
  return value;
}

function generateSecureRandom(length: number): string {
  return crypto.randomBytes(length).toString("hex");
}

function deriveKey(masterPassword: string): Buffer {
  return crypto.pbkdf2Sync(
    masterPassword,
    PBKDF2_SALT,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

function encrypt(plaintext: string, key: Buffer): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: encrypted, iv, authTag };
}

async function pregunta(rl: readline.Interface, texto: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(texto, resolve);
  });
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
async function migrateSecrets() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          JUEZ SEGURO - Migración de Secretos a db_secrets        ║
╠══════════════════════════════════════════════════════════════════╣
║  Este script creará los secretos iniciales encriptados           ║
║  en la base de datos db_secrets.                                 ║
╚══════════════════════════════════════════════════════════════════╝
  `);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Verificar variables de entorno
    const masterKeyPassword = getRequiredEnv("MASTER_KEY_PASSWORD");
    const dbPassword = getRequiredEnv("DB_SECRETS_PASSWORD");

    console.log("✓ Variables de entorno verificadas");

    // Configuración de conexión
    const dbConfig = {
      host: process.env.DB_SECRETS_HOST || "localhost",
      port: parseInt(process.env.DB_SECRETS_PORT || "5436"),
      database: process.env.DB_SECRETS_NAME || "db_secrets",
      user: process.env.DB_SECRETS_USER || "admin_secrets",
      password: dbPassword,
    };

    console.log(`\n📊 Conectando a: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    // Conectar a la BD
    const pool = new Pool(dbConfig);
    
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("✓ Conexión a db_secrets establecida");
    } catch (error) {
      console.error("✗ Error conectando a db_secrets:", error);
      console.log("\n⚠️  Asegúrate de que el contenedor db_secrets esté corriendo:");
      console.log("   docker-compose up -d db_secrets");
      throw error;
    }

    // Verificar si ya existen secretos
    const existingResult = await pool.query(
      "SELECT nombre FROM secretos_sistema WHERE activo = TRUE"
    );
    const existingSecrets = new Set(existingResult.rows.map(r => r.nombre));

    if (existingSecrets.size > 0) {
      console.log(`\n⚠️  Ya existen ${existingSecrets.size} secretos en la BD:`);
      existingSecrets.forEach(s => console.log(`   - ${s}`));
      
      const respuesta = await pregunta(rl, "\n¿Deseas sobrescribirlos? (s/N): ");
      if (respuesta.toLowerCase() !== "s") {
        console.log("Operación cancelada.");
        await pool.end();
        rl.close();
        return;
      }
    }

    // Derivar clave de encriptación
    console.log("\n🔐 Derivando clave AES-256 con PBKDF2...");
    const derivedKey = deriveKey(masterKeyPassword);
    console.log("✓ Clave derivada correctamente");

    // Crear secretos
    console.log("\n📝 Creando secretos...\n");

    for (const secreto of SECRETOS_INICIALES) {
      let valor: string;

      if (secreto.generarAutomatico) {
        valor = generateSecureRandom(secreto.longitudGenerada || 32);
        console.log(`  🔑 ${secreto.nombre}: Generado automáticamente (${secreto.longitudGenerada} bytes)`);
      } else if (secreto.valorDefault) {
        valor = secreto.valorDefault;
        if (secreto.tipo === "SMTP") {
          console.log(`  📧 ${secreto.nombre}: Usando credencial Gmail configurada`);
        } else {
          console.log(`  🔑 ${secreto.nombre}: Usando valor por defecto`);
        }
      } else {
        valor = await pregunta(rl, `  Ingresa valor para ${secreto.nombre}: `);
      }

      // Encriptar
      const { ciphertext, iv, authTag } = encrypt(valor, derivedKey);

      // Guardar o actualizar en BD
      if (existingSecrets.has(secreto.nombre)) {
        // Actualizar
        await pool.query(
          `UPDATE secretos_sistema 
           SET valor_cifrado = $1, iv = $2, auth_tag = $3, 
               version = version + 1, fecha_rotacion = CURRENT_TIMESTAMP,
               modificado_por = $4
           WHERE nombre = $5`,
          [ciphertext, iv, authTag, "migrate-secrets", secreto.nombre]
        );
        console.log(`     ✓ Actualizado en BD (nueva versión)`);
      } else {
        // Insertar
        await pool.query(
          `INSERT INTO secretos_sistema 
            (nombre, tipo, descripcion, valor_cifrado, iv, auth_tag, creado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [secreto.nombre, secreto.tipo, secreto.descripcion, ciphertext, iv, authTag, "migrate-secrets"]
        );
        console.log(`     ✓ Creado en BD`);
      }
    }

    // Verificar
    const finalResult = await pool.query(
      "SELECT nombre, tipo, version, fecha_creacion FROM secretos_sistema WHERE activo = TRUE ORDER BY secreto_id"
    );

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ✅ MIGRACIÓN COMPLETADA                       ║
╠══════════════════════════════════════════════════════════════════╣`);
    
    for (const row of finalResult.rows) {
      console.log(`║  ${row.nombre.padEnd(25)} │ ${row.tipo.padEnd(6)} │ v${row.version}`.padEnd(67) + "║");
    }
    
    console.log(`╠══════════════════════════════════════════════════════════════════╣
║  Total: ${finalResult.rows.length} secretos encriptados en db_secrets              ║
║                                                                  ║
║  Los secretos están encriptados con AES-256-GCM.                 ║
║  La clave se deriva de MASTER_KEY_PASSWORD con PBKDF2.           ║
╚══════════════════════════════════════════════════════════════════╝
    `);

    await pool.end();
    rl.close();

  } catch (error) {
    console.error("\n❌ Error durante la migración:", error);
    rl.close();
    process.exit(1);
  }
}

// Ejecutar
migrateSecrets();
