/**
 * Script de migración: Agregar columnas de partes procesales
 * Ejecuta el script SQL 05_add_partes_procesales.sql
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
loadEnv();

// Configuración de la base de datos de casos
const casesPool = new Pool({
  host: process.env.DB_CASES_HOST || 'localhost',
  port: parseInt(process.env.DB_CASES_PORT || '5433'),
  database: process.env.DB_CASES_NAME || 'db_casos',
  user: process.env.DB_CASES_USER || 'admin_cases',
  password: process.env.DB_CASES_PASSWORD || '',
});

async function runMigration() {
  const client = await casesPool.connect();
  
  try {
    console.log('🔄 Ejecutando migración: Agregar columnas de partes procesales...');
    
    // Leer el archivo SQL
    const sqlPath = join(__dirname, '..', '..', 'scripts', 'casos', '05_add_partes_procesales.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    // Ejecutar el SQL
    await client.query(sql);
    
    console.log('✅ Migración completada exitosamente!');
    console.log('✅ Columnas agregadas: actor_nombre, actor_identificacion, demandado_nombre, demandado_identificacion');
    
    // Verificar las columnas
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'causas'
        AND column_name IN ('actor_nombre', 'actor_identificacion', 'demandado_nombre', 'demandado_identificacion')
      ORDER BY column_name;
    `);
    
    console.log('\n📋 Columnas verificadas:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error ejecutando la migración:', error);
    throw error;
  } finally {
    client.release();
    await casesPool.end();
  }
}

// Ejecutar la migración
runMigration()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
