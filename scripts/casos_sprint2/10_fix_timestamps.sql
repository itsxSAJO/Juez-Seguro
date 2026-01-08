-- ============================================================================
-- FIX: Corregir inconsistencia de tipos de timestamp en audiencias
-- Problema: fecha_creacion es timestamp WITHOUT time zone, pero
--           fecha_modificacion en historial es timestamp WITH time zone
-- Esto causa que las fechas se interpreten de manera diferente en el frontend
-- ============================================================================

-- 1. Cambiar fecha_creacion a timestamptz con AT TIME ZONE 'UTC'
ALTER TABLE audiencias 
ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ 
USING fecha_creacion AT TIME ZONE 'UTC';

-- 2. Cambiar fecha_actualizacion también para consistencia
ALTER TABLE audiencias 
ALTER COLUMN fecha_actualizacion TYPE TIMESTAMPTZ 
USING fecha_actualizacion AT TIME ZONE 'UTC';

-- 3. Verificar los cambios
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audiencias' 
AND column_name LIKE 'fecha%';

-- 4. Ver las fechas corregidas
SELECT audiencia_id, fecha_creacion, fecha_actualizacion 
FROM audiencias 
ORDER BY audiencia_id DESC 
LIMIT 5;
