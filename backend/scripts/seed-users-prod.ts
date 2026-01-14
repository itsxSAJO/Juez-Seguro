// ============================================================================
// JUEZ SEGURO - Script de Seed de Usuarios para PRODUCCIÓN
// ============================================================================
// Este script genera usuarios de producción con contraseñas interactivas.
// Las contraseñas se piden por consola y se hashean dinámicamente.
//
// SEGURIDAD:
// - Contraseñas ingresadas por terminal (no hardcodeadas)
// - Hashes generados en runtime con bcrypt
// - Validación de fortaleza de contraseñas
//
// Uso:
//   docker exec -it juez_seguro_backend_api sh
//   npx tsx scripts/seed-users-prod.ts
// ============================================================================

import bcrypt from "bcryptjs";
import * as readline from "readline";
import { configBase } from "../src/config/index.js";
import { usersPool } from "../src/db/connection.js";

// ============================================================================
// INTERFAZ PARA ENTRADA DE TERMINAL
// ============================================================================

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

// ============================================================================
// VALIDACIÓN DE CONTRASEÑAS
// ============================================================================

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 16) {
    errors.push("Debe tener al menos 16 caracteres");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Debe contener al menos una mayúscula");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Debe contener al menos una minúscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Debe contener al menos un número");
  }

  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;'`~]/.test(password)) {
    errors.push("Debe contener al menos un símbolo especial");
  }

  // Verificar patrones comunes débiles
  const weakPatterns = [
    /^(.)\1+$/,           // Todos caracteres iguales
    /^(012|123|234|345|456|567|678|789|890)+/i,  // Secuencias numéricas
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+/i,  // Secuencias alfabéticas
    /password|123456|qwerty|admin|secret/i,  // Palabras comunes
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      errors.push("Contiene patrones comunes débiles");
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// DEFINICIÓN DE USUARIOS DE PRODUCCIÓN
// ============================================================================

interface ProductionUser {
  identificacion: string;
  nombres_completos: string;
  correo_institucional: string;
  rol_id: number;
  unidad_judicial: string;
  materia: string;
  estado: string;
}

const PRODUCTION_USERS: ProductionUser[] = [
  {
    identificacion: "1700000001",
    nombres_completos: "Carlos Alberto Mendoza Rivera",
    correo_institucional: "admin.cj@judicatura.gob.ec",
    rol_id: 1,  // ADMIN_CJ
    unidad_judicial: "Consejo de la Judicatura",
    materia: "Administración",
    estado: "ACTIVA",
  },
  {
    identificacion: "1700000002",
    nombres_completos: "María Elena Gutiérrez Salas",
    correo_institucional: "juez.gutierrez@judicatura.gob.ec",
    rol_id: 2,  // JUEZ
    unidad_judicial: "Unidad Judicial Civil Quito Norte",
    materia: "Civil",
    estado: "ACTIVA",
  },
  {
    identificacion: "1700000003",
    nombres_completos: "Ana Lucía Paredes Villagómez",
    correo_institucional: "secretario.paredes@judicatura.gob.ec",
    rol_id: 3,  // SECRETARIO
    unidad_judicial: "Unidad Judicial Civil Quito Norte",
    materia: "Civil",
    estado: "ACTIVA",
  },
];

// ============================================================================
// FUNCIÓN PARA PEDIR CONTRASEÑA CON VALIDACIÓN
// ============================================================================

async function askForPassword(
  rl: readline.Interface,
  userEmail: string,
  roleName: string
): Promise<string> {
  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`👤 Usuario: ${userEmail}`);
  console.log(`🎭 Rol: ${roleName}`);
  console.log(`─────────────────────────────────────────────────────────`);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const password = await question(
      rl,
      "\n🔐 Ingrese contraseña (mín. 16 caracteres, mayúsculas, minúsculas, números, símbolos): "
    );

    const validation = validatePasswordStrength(password);

    if (validation.valid) {
      // Confirmar contraseña
      const confirmPassword = await question(rl, "🔐 Confirme la contraseña: ");

      if (password === confirmPassword) {
        console.log("✅ Contraseña válida y confirmada\n");
        return password;
      } else {
        console.log("❌ Las contraseñas no coinciden. Intente nuevamente.\n");
        attempts++;
      }
    } else {
      console.log("\n❌ Contraseña débil. Problemas:");
      validation.errors.forEach((error) => console.log(`   • ${error}`));
      console.log("");
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error(
        `Se alcanzó el máximo de intentos (${maxAttempts}) para ${userEmail}`
      );
    }
  }

  throw new Error("No se pudo establecer una contraseña válida");
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function seedProductionUsers(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  🚀 SEED DE USUARIOS DE PRODUCCIÓN                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Configurando usuarios iniciales del sistema...                  ║
║  Entorno: ${configBase.nodeEnv.toUpperCase().padEnd(56)}║
║  Rounds bcrypt: ${configBase.security.bcryptRounds.toString().padEnd(48)}║
╠══════════════════════════════════════════════════════════════════╣
║  REQUISITOS DE CONTRASEÑA:                                       ║
║  • Mínimo 16 caracteres                                          ║
║  • Al menos 1 mayúscula                                          ║
║  • Al menos 1 minúscula                                          ║
║  • Al menos 1 número                                             ║
║  • Al menos 1 símbolo especial                                   ║
║  • Sin patrones comunes débiles                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

  const rl = createReadlineInterface();
  const client = await usersPool.connect();

  try {
    // Mapear roles para nombres legibles
    const roleNames: { [key: number]: string } = {
      1: "Administrador CJ",
      2: "Juez",
      3: "Secretario Judicial",
    };

    const usersWithPasswords: Array<ProductionUser & { password: string }> = [];

    // Pedir contraseñas para cada usuario
    for (const user of PRODUCTION_USERS) {
      const roleName = roleNames[user.rol_id] || "Desconocido";
      const password = await askForPassword(rl, user.correo_institucional, roleName);
      usersWithPasswords.push({ ...user, password });
    }

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║  💾 GUARDANDO USUARIOS EN LA BASE DE DATOS...                   ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    await client.query("BEGIN");

    for (const user of usersWithPasswords) {
      // Generar hash bcrypt
      console.log(`🔐 Generando hash bcrypt para ${user.correo_institucional}...`);
      const passwordHash = await bcrypt.hash(user.password, configBase.security.bcryptRounds);

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
          estado = EXCLUDED.estado,
          intentos_fallidos = 0
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
      console.log(`✅ Usuario guardado: ${insertedUser.correo_institucional} (ID: ${insertedUser.funcionario_id})\n`);
    }

    await client.query("COMMIT");

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅ SEED DE PRODUCCIÓN COMPLETADO EXITOSAMENTE                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Usuarios creados/actualizados: ${usersWithPasswords.length.toString().padEnd(34)}║
║                                                                  ║
║  📧 USUARIOS CONFIGURADOS:                                       ║
║  ────────────────────────────────────────────────────────────────║
`);

    usersWithPasswords.forEach((user) => {
      const roleName = roleNames[user.rol_id];
      console.log(`║  • ${user.correo_institucional.padEnd(54)}║`);
      console.log(`║    Rol: ${roleName.padEnd(51)}║`);
    });

    console.log(`║                                                                  ║
║  ⚠️  IMPORTANTE:                                                 ║
║  • Guarde las contraseñas en un gestor seguro                   ║
║  • Entregue credenciales por canal seguro                       ║
║  • Los usuarios deben cambiar contraseña en primer acceso       ║
╚══════════════════════════════════════════════════════════════════╝
`);

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Error durante el seed de producción:", error);
    throw error;
  } finally {
    rl.close();
    client.release();
    await usersPool.end();
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

seedProductionUsers()
  .then(() => {
    console.log("\n✅ Proceso completado exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error fatal:", error);
    process.exit(1);
  });
