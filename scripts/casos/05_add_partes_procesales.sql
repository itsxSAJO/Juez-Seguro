-- ============================================================================
-- JUEZ SEGURO - Migración: Agregar columnas de partes procesales
-- Propósito: Agregar campos para almacenar nombres de actores/demandados
-- Fecha: 2026-01-05
-- ============================================================================

-- Agregar columnas para las partes procesales (información pública)
-- Nota: Estos son nombres reales ya que son información pública del proceso
-- A diferencia de los funcionarios judiciales que sí deben ser pseudonimizados

ALTER TABLE causas 
ADD COLUMN IF NOT EXISTS actor_nombre VARCHAR(255),
ADD COLUMN IF NOT EXISTS actor_identificacion VARCHAR(20),
ADD COLUMN IF NOT EXISTS demandado_nombre VARCHAR(255),
ADD COLUMN IF NOT EXISTS demandado_identificacion VARCHAR(20);

-- Crear índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_causas_actor_nombre ON causas(actor_nombre);
CREATE INDEX IF NOT EXISTS idx_causas_demandado_nombre ON causas(demandado_nombre);

-- Comentarios para documentación
COMMENT ON COLUMN causas.actor_nombre IS 'Nombre completo del actor/demandante (información pública)';
COMMENT ON COLUMN causas.actor_identificacion IS 'Identificación del actor/demandante (información pública)';
COMMENT ON COLUMN causas.demandado_nombre IS 'Nombre completo del demandado/procesado (información pública)';
COMMENT ON COLUMN causas.demandado_identificacion IS 'Identificación del demandado/procesado (información pública)';

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'causas'
  AND column_name IN ('actor_nombre', 'actor_identificacion', 'demandado_nombre', 'demandado_identificacion')
ORDER BY column_name;
