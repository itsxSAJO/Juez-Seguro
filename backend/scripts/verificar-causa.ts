/**
 * Script para verificar los datos de una causa específica
 */

import { Pool } from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv();

const casesPool = new Pool({
  host: process.env.DB_CASES_HOST || 'localhost',
  port: parseInt(process.env.DB_CASES_PORT || '5433'),
  database: process.env.DB_CASES_NAME || 'db_casos',
  user: process.env.DB_CASES_USER || 'admin_cases',
  password: process.env.DB_CASES_PASSWORD || '',
});

async function verificarCausa() {
  const client = await casesPool.connect();
  
  try {
    console.log('🔍 Verificando datos de causas...\n');
    
    // Buscar la última causa creada
    const result = await client.query(`
      SELECT 
        causa_id, 
        numero_proceso, 
        materia, 
        actor_nombre, 
        actor_identificacion,
        demandado_nombre, 
        demandado_identificacion,
        descripcion,
        fecha_creacion
      FROM causas 
      ORDER BY fecha_creacion DESC 
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No se encontraron causas en la base de datos');
      return;
    }
    
    console.log(`✅ Últimas ${result.rows.length} causas creadas:\n`);
    
    result.rows.forEach((causa, index) => {
      console.log(`\n${index + 1}. Causa #${causa.causa_id} - ${causa.numero_proceso}`);
      console.log(`   Materia: ${causa.materia}`);
      console.log(`   Actor: ${causa.actor_nombre || '❌ NULL'} (ID: ${causa.actor_identificacion || 'N/A'})`);
      console.log(`   Demandado: ${causa.demandado_nombre || '❌ NULL'} (ID: ${causa.demandado_identificacion || 'N/A'})`);
      console.log(`   Descripción: ${causa.descripcion ? causa.descripcion.substring(0, 50) + '...' : 'N/A'}`);
      console.log(`   Fecha: ${causa.fecha_creacion}`);
    });
    
    // Verificar si existen las columnas
    console.log('\n\n📊 Verificando estructura de la tabla causas...\n');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'causas'
      ORDER BY column_name;
    `);
    
    const relevantColumns = columns.rows.filter(col => 
      col.column_name.includes('actor') || 
      col.column_name.includes('demandado')
    );
    
    console.log('Columnas relacionadas con partes procesales:');
    relevantColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await casesPool.end();
  }
}

verificarCausa()
  .then(() => {
    console.log('\n\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n\n💥 Error fatal:', error);
    process.exit(1);
  });
