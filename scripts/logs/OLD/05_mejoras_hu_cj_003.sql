-- ============================================================================
-- JUEZ SEGURO - Mejoras de Auditoría para HU-CJ-003
-- Sprint 4: Revisión de registros de actividad
-- ============================================================================
-- Cambios:
-- 1. Agregar hash_anterior para encadenamiento de integridad
-- 2. Agregar causa_referencia para filtrado optimizado
-- 3. Crear índices optimizados
-- 4. Crear vista segura de solo lectura
-- ============================================================================

-- ============================================================================
-- PASO 1: Agregar columnas faltantes
-- ============================================================================

-- Columna para encadenamiento de hashes (integridad de cadena)
ALTER TABLE logs_auditoria 
ADD COLUMN IF NOT EXISTS hash_anterior CHAR(64);

-- Columna para referencia directa a causa (optimiza filtros)
ALTER TABLE logs_auditoria 
ADD COLUMN IF NOT EXISTS causa_referencia VARCHAR(50);

-- Comentarios descriptivos
COMMENT ON COLUMN logs_auditoria.hash_anterior IS 'Hash SHA-256 del evento anterior para verificar integridad de cadena';
COMMENT ON COLUMN logs_auditoria.causa_referencia IS 'Número de proceso/causa relacionada para filtrado directo';

-- ============================================================================
-- PASO 2: Crear índices optimizados para HU-CJ-003
-- ============================================================================

-- Índice para filtro por fecha (consultas de rango)
CREATE INDEX IF NOT EXISTS idx_audit_fecha_evento 
ON logs_auditoria(fecha_evento DESC);

-- Índice para filtro por usuario
CREATE INDEX IF NOT EXISTS idx_audit_usuario_id 
ON logs_auditoria(usuario_id);

-- Índice para filtro por correo de usuario
CREATE INDEX IF NOT EXISTS idx_audit_usuario_correo 
ON logs_auditoria(usuario_correo);

-- Índice para filtro por causa
CREATE INDEX IF NOT EXISTS idx_audit_causa_ref 
ON logs_auditoria(causa_referencia) 
WHERE causa_referencia IS NOT NULL;

-- Índice para filtro por tipo de evento
CREATE INDEX IF NOT EXISTS idx_audit_tipo_evento 
ON logs_auditoria(tipo_evento);

-- Índice para filtro por módulo
CREATE INDEX IF NOT EXISTS idx_audit_modulo 
ON logs_auditoria(modulo_afectado);

-- Índice compuesto para consultas frecuentes (fecha + usuario)
CREATE INDEX IF NOT EXISTS idx_audit_fecha_usuario 
ON logs_auditoria(fecha_evento DESC, usuario_id);

-- Índice para verificación de integridad de cadena
CREATE INDEX IF NOT EXISTS idx_audit_hash_cadena 
ON logs_auditoria(log_id, hash_evento, hash_anterior);

-- ============================================================================
-- PASO 3: Crear vista segura de solo lectura
-- ============================================================================

-- Vista para consultas del Consejo de la Judicatura
-- Previene modificaciones accidentales y expone solo campos necesarios
CREATE OR REPLACE VIEW vista_auditoria_segura AS
SELECT 
    log_id,
    fecha_evento,
    usuario_id,
    usuario_correo,
    rol_usuario,
    tipo_evento,
    modulo_afectado,
    descripcion_evento,
    causa_referencia,
    ip_origen,
    -- No exponemos datos_afectados completos en la vista básica
    CASE 
        WHEN datos_afectados IS NOT NULL THEN true 
        ELSE false 
    END AS tiene_detalles
FROM logs_auditoria
ORDER BY fecha_evento DESC;

COMMENT ON VIEW vista_auditoria_segura IS 'Vista de solo lectura para auditoría del CJ - HU-CJ-003';

-- ============================================================================
-- PASO 4: Función para verificar integridad de cadena
-- ============================================================================

CREATE OR REPLACE FUNCTION verificar_integridad_auditoria(
    p_desde TIMESTAMPTZ DEFAULT NULL,
    p_hasta TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    total_registros BIGINT,
    registros_validos BIGINT,
    registros_rotos BIGINT,
    primer_error_id BIGINT,
    integridad_ok BOOLEAN
) AS $$
DECLARE
    v_hash_esperado CHAR(64);
    v_registro RECORD;
    v_total BIGINT := 0;
    v_validos BIGINT := 0;
    v_rotos BIGINT := 0;
    v_primer_error BIGINT := NULL;
BEGIN
    FOR v_registro IN 
        SELECT log_id, hash_evento, hash_anterior
        FROM logs_auditoria
        WHERE (p_desde IS NULL OR fecha_evento >= p_desde)
          AND (p_hasta IS NULL OR fecha_evento <= p_hasta)
        ORDER BY log_id ASC
    LOOP
        v_total := v_total + 1;
        
        -- Para el primer registro, hash_anterior puede ser NULL
        IF v_registro.hash_anterior IS NULL AND v_total = 1 THEN
            v_validos := v_validos + 1;
        -- Verificar que el hash_anterior coincida con el hash del registro anterior
        ELSIF v_registro.hash_anterior = v_hash_esperado OR v_registro.hash_anterior IS NULL THEN
            v_validos := v_validos + 1;
        ELSE
            v_rotos := v_rotos + 1;
            IF v_primer_error IS NULL THEN
                v_primer_error := v_registro.log_id;
            END IF;
        END IF;
        
        -- Guardar hash actual para comparar con el siguiente
        v_hash_esperado := v_registro.hash_evento;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_total,
        v_validos,
        v_rotos,
        v_primer_error,
        (v_rotos = 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verificar_integridad_auditoria IS 'Verifica la integridad de la cadena de hashes de auditoría';

-- ============================================================================
-- PASO 5: Actualizar registros existentes con causa_referencia
-- ============================================================================

-- Extraer causa_referencia de datos_afectados para registros existentes
UPDATE logs_auditoria
SET causa_referencia = datos_afectados->>'causaId'
WHERE causa_referencia IS NULL 
  AND datos_afectados->>'causaId' IS NOT NULL;

UPDATE logs_auditoria
SET causa_referencia = datos_afectados->>'numeroProceso'
WHERE causa_referencia IS NULL 
  AND datos_afectados->>'numeroProceso' IS NOT NULL;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 'Mejoras HU-CJ-003 aplicadas correctamente' AS resultado;

-- Mostrar estructura actualizada
\d logs_auditoria

-- Mostrar índices creados
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'logs_auditoria';

