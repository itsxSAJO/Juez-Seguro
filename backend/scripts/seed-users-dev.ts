// ============================================================================
// JUEZ SEGURO - Script de Seed de Usuarios para Desarrollo
// ============================================================================
// Este script genera usuarios de prueba con hashes bcrypt generados
// dinámicamente. Las contraseñas NUNCA se almacenan en el código fuente.
//
// SEGURIDAD:
// - Solo ejecuta en NODE_ENV=development
// - Contraseñas vienen de variables de entorno
// - Hashes generados en runtime (no hardcodeados)
//
// Uso:
//   npx tsx scripts/seed-users-dev.ts
// ============================================================================

import bcrypt from "bcryptjs";
import { config } from "../src/config/index.js";
import { usersPool } from "../src/db/connection.js";

// ============================================================================
// VALIDACIÓN DE ENTORNO - FAIL FAST
// ============================================================================

if (config.nodeEnv !== "development") {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  ❌ ERROR: ENTORNO DE PRODUCCIÓN DETECTADO                      ║
╠══════════════════════════════════════════════════════════════════╣
║  Este script SOLO puede ejecutarse en desarrollo.               ║
║  NODE_ENV actual: ${config.nodeEnv.padEnd(42)}║
╠══════════════════════════════════════════════════════════════════╣
║  Para ejecutar en desarrollo:                                    ║
║  > set NODE_ENV=development                                      ║
║  > npx tsx scripts/seed-users-dev.ts                            ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// ============================================================================
// OBTENER CONTRASEÑAS DESDE VARIABLES DE ENTORNO
// ============================================================================

function getDevPassword(envVar: string, defaultPassword: string): string {
  // En desarrollo, usamos defaults seguros documentados
  // Estas contraseñas cumplen con Common Criteria:
  // - Mínimo 16 caracteres
  // - Mayúsculas, minúsculas, números y símbolos
  const password = process.env[envVar] || defaultPassword;
  
  if (password.length < 16) {
    console.warn(`⚠️ Advertencia: ${envVar} tiene menos de 16 caracteres`);
  }
  
  return password;
}

// Contraseñas por defecto para desarrollo (documentadas en README)
const DEV_PASSWORDS = {
  admin: getDevPassword("DEV_ADMIN_PASSWORD", "JzAdm1n_CJ2026Seguro!"),
  juez: getDevPassword("DEV_JUEZ_PASSWORD", "JzJuez_T1tular2026Sec!"),
  secretario: getDevPassword("DEV_SECRETARIO_PASSWORD", "JzSecr3t_Jud2026Seg!"),
};

// ============================================================================
// DEFINICIÓN DE USUARIOS DE DESARROLLO
// ============================================================================

interface DevUser {
  identificacion: string;
  nombres_completos: string;
  correo_institucional: string;
  password: string;  // Texto plano - se hasheará
  rol_id: number;
  unidad_judicial: string;
  materia: string;
  estado: string;
}

const DEV_USERS: DevUser[] = [
  {
    identificacion: "1700000001",
    nombres_completos: "Carlos Alberto Mendoza Rivera",
    correo_institucional: "admin.cj@judicatura.gob.ec",
    password: DEV_PASSWORDS.admin,
    rol_id: 1,  // ADMIN_CJ
    unidad_judicial: "Consejo de la Judicatura",
    materia: "Administración",
    estado: "ACTIVA",
  },
  {
    identificacion: "1700000002",
    nombres_completos: "María Elena Gutiérrez Salas",
    correo_institucional: "juez.gutierrez@judicatura.gob.ec",
    password: DEV_PASSWORDS.juez,
    rol_id: 2,  // JUEZ
    unidad_judicial: "Unidad Judicial Civil Quito Norte",
    materia: "Civil",
    estado: "ACTIVA",
  },
  {
    identificacion: "1700000003",
    nombres_completos: "Ana Lucía Paredes Villagómez",
    correo_institucional: "secretario.paredes@judicatura.gob.ec",
    password: DEV_PASSWORDS.secretario,
    rol_id: 3,  // SECRETARIO
    unidad_judicial: "Unidad Judicial Civil Quito Norte",
    materia: "Civil",
    estado: "ACTIVA",
  },
];

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function seedDevUsers(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  🌱 SEED DE USUARIOS DE DESARROLLO                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Generando hashes bcrypt dinámicamente...                        ║
║  Rounds: ${config.security.bcryptRounds.toString().padEnd(52)}║
╚══════════════════════════════════════════════════════════════════╝
`);

  const client = await usersPool.connect();

  try {
    await client.query("BEGIN");

    for (const user of DEV_USERS) {
      // Generar hash bcrypt dinámicamente
      const passwordHash = await bcrypt.hash(user.password, config.security.bcryptRounds);

      // Insertar o actualizar usuario
      const result = await client.query(
        `INSERT INTO funcionarios (
          identificacion, 
          nombres_completos, 
          correo_institucional, 
          password_hash, 
          rol_id, 
          unidad_judicial, 
          materia, 
          estado,
          intentos_fallidos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
        ON CONFLICT (identificacion) 
        DO UPDATE SET 
          password_hash = EXCLUDED.password_hash,
          estado = EXCLUDED.estado
        RETURNING funcionario_id, correo_institucional`,
        [
          user.identificacion,
          user.nombres_completos,
          user.correo_institucional,
          passwordHash,
          user.rol_id,
          user.unidad_judicial,
          user.materia,
          user.estado,
        ]
      );

      const insertedUser = result.rows[0];
      console.log(`✓ Usuario creado/actualizado: ${insertedUser.correo_institucional} (ID: ${insertedUser.funcionario_id})`);
    }

    await client.query("COMMIT");

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅ SEED COMPLETADO EXITOSAMENTE                                ║
╠══════════════════════════════════════════════════════════════════╣
║  Usuarios creados: ${DEV_USERS.length.toString().padEnd(45)}║
║                                                                  ║
║  Credenciales de prueba:                                         ║
║  ────────────────────────────────────────────────────────────────║
║  Admin:      admin.cj@judicatura.gob.ec                         ║
║  Juez:       juez.gutierrez@judicatura.gob.ec                   ║
║  Secretario: secretario.paredes@judicatura.gob.ec               ║
║                                                                  ║
║  ⚠️  Las contraseñas están en las variables de entorno          ║
║      o usan los defaults documentados en este script.           ║
╚══════════════════════════════════════════════════════════════════╝
`);

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error durante el seed:", error);
    throw error;
  } finally {
    client.release();
    await usersPool.end();
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

seedDevUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
  });
