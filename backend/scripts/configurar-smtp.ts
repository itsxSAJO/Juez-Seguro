// ============================================================================
// JUEZ SEGURO - Script de Configuración SMTP (Gmail)
// ============================================================================
// Este script configura las credenciales SMTP en db_secrets.
//
// Uso:
//   cd backend
//   npx tsx scripts/configurar-smtp.ts
// ============================================================================

import crypto from "crypto";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import readline from "readline";

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ============================================================================
// CONSTANTES DE SEGURIDAD
// ============================================================================
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = "sha256";
const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PBKDF2_SALT = "JuezSeguro_FCS_2026_Salt";

// ============================================================================
// FUNCIONES
// ============================================================================

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno requerida: ${name}`);
  }
  return value;
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

async function upsertSecret(
  pool: Pool,
  nombre: string,
  tipo: string,
  descripcion: string,
  valorCifrado: Buffer,
  iv: Buffer,
  authTag: Buffer
): Promise<void> {
  const existe = await pool.query(
    "SELECT secreto_id FROM secretos_sistema WHERE nombre = $1",
    [nombre]
  );

  if (existe.rows.length > 0) {
    await pool.query(
      `UPDATE secretos_sistema 
       SET valor_cifrado = $1, iv = $2, auth_tag = $3, 
           version = version + 1, fecha_rotacion = CURRENT_TIMESTAMP,
           modificado_por = $4
       WHERE nombre = $5`,
      [valorCifrado, iv, authTag, "configurar-smtp", nombre]
    );
    console.log(`  ✓ ${nombre} actualizado`);
  } else {
    await pool.query(
      `INSERT INTO secretos_sistema 
        (nombre, tipo, descripcion, valor_cifrado, iv, auth_tag, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [nombre, tipo, descripcion, valorCifrado, iv, authTag, "configurar-smtp"]
    );
    console.log(`  ✓ ${nombre} creado`);
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
async function configurarSMTP() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          JUEZ SEGURO - Configuración SMTP (Gmail)                ║
╠══════════════════════════════════════════════════════════════════╣
║  Este script configura las credenciales de correo Gmail          ║
║  para el envío de notificaciones del sistema.                    ║
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

    // Configuración de conexión
    const dbConfig = {
      host: process.env.DB_SECRETS_HOST || "localhost",
      port: parseInt(process.env.DB_SECRETS_PORT || "5436"),
      database: process.env.DB_SECRETS_NAME || "db_secrets",
      user: process.env.DB_SECRETS_USER || "admin_secrets",
      password: dbPassword,
    };

    console.log(`📊 Conectando a: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    // Conectar a la BD
    const pool = new Pool(dbConfig);

    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("✓ Conexión a db_secrets establecida\n");
    } catch (error) {
      console.error("✗ Error conectando a db_secrets:", error);
      console.log("\n⚠️  Asegúrate de que el contenedor db_secrets esté corriendo:");
      console.log("   docker-compose up -d db_secrets");
      throw error;
    }

    // Solicitar credenciales
    console.log("📧 CONFIGURACIÓN DE GMAIL");
    console.log("=" .repeat(50));
    console.log("\n⚠️  IMPORTANTE: Gmail requiere una 'Contraseña de aplicación'.");
    console.log("   La contraseña normal de Gmail NO funcionará.\n");
    console.log("   Para obtener una App Password:");
    console.log("   1. Ve a https://myaccount.google.com/apppasswords");
    console.log("   2. Activa verificación en 2 pasos si no está activa");
    console.log("   3. Selecciona 'Correo' y 'Ordenador Windows'");
    console.log("   4. Copia la contraseña de 16 caracteres\n");

    // Usuario SMTP
    const smtpUser = await pregunta(
      rl, 
      "📧 Correo Gmail [consejo.judicatura20@gmail.com]: "
    );
    const emailFinal = smtpUser.trim() || "consejo.judicatura20@gmail.com";

    // Contraseña SMTP
    const smtpPassword = await pregunta(
      rl,
      "🔑 App Password de Gmail (16 caracteres sin espacios): "
    );

    if (!smtpPassword || smtpPassword.trim() === "") {
      console.log("\n❌ No se proporcionó contraseña. Abortando.");
      await pool.end();
      rl.close();
      return;
    }

    // Limpiar espacios
    const passwordLimpio = smtpPassword.replace(/\s/g, "");
    
    if (passwordLimpio.length !== 16) {
      console.log(`\n⚠️  Advertencia: La contraseña tiene ${passwordLimpio.length} caracteres.`);
      console.log("   Las App Passwords de Gmail normalmente tienen 16 caracteres.");
      const continuar = await pregunta(rl, "   ¿Continuar de todos modos? (s/N): ");
      if (continuar.toLowerCase() !== "s") {
        console.log("Abortado.");
        await pool.end();
        rl.close();
        return;
      }
    }

    // Derivar clave
    console.log("\n🔐 Derivando clave AES-256...");
    const derivedKey = deriveKey(masterKeyPassword);

    // Encriptar y guardar SMTP_USER
    console.log("\n💾 Guardando credenciales encriptadas...");
    const encUser = encrypt(emailFinal, derivedKey);
    await upsertSecret(
      pool,
      "SMTP_USER",
      "SMTP",
      "Correo electrónico Gmail para envío de notificaciones",
      encUser.ciphertext,
      encUser.iv,
      encUser.authTag
    );

    // Encriptar y guardar SMTP_PASSWORD
    const encPass = encrypt(passwordLimpio, derivedKey);
    await upsertSecret(
      pool,
      "SMTP_PASSWORD",
      "SMTP",
      "App Password de Gmail (requiere 2FA habilitado)",
      encPass.ciphertext,
      encPass.iv,
      encPass.authTag
    );

    await pool.end();
    rl.close();

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              ✅ SMTP CONFIGURADO CORRECTAMENTE                   ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Usuario SMTP: ${emailFinal.padEnd(45)}║
║                                                                  ║
║  Los correos se enviarán desde esta cuenta.                      ║
║                                                                  ║
║  En MODO EDUCATIVO (EMAIL_MODO_EDUCATIVO=true):                  ║
║  • Jueces → juez.jz15@gmail.com                                  ║
║  • Secretarias → secretaria.juez20@gmail.com                     ║
║                                                                  ║
║  Reinicia el backend para aplicar los cambios.                   ║
╚══════════════════════════════════════════════════════════════════╝
    `);

  } catch (error) {
    console.error("Error:", error);
    rl.close();
    process.exit(1);
  }
}

// Ejecutar
configurarSMTP().catch(console.error);
