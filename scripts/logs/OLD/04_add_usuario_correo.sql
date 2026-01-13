-- ============================================================================
-- JUEZ SEGURO - Agregar campo usuario_correo a logs de auditoría
-- ============================================================================
-- Este campo permite identificar al usuario sin necesidad de JOIN
-- ============================================================================

-- Agregar columna para el correo del usuario
ALTER TABLE logs_auditoria 
ADD COLUMN IF NOT EXISTS usuario_correo VARCHAR(255);

-- Crear índice para búsquedas por correo
CREATE INDEX IF NOT EXISTS idx_logs_correo ON logs_auditoria(usuario_correo);

-- Verificación
SELECT 'Columna usuario_correo agregada correctamente' AS resultado;
\d logs_auditoria
