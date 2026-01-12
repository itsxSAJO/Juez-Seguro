-- ============================================================================
-- JUEZ SEGURO - Reset Schema db_secrets
-- Base de Datos de Secretos Criptográficos (FCS - Cryptographic Support)
-- ============================================================================
-- ⚠️  ADVERTENCIA: Este script ELIMINA todos los datos de secretos
--     Solo usar en desarrollo o reinstalación completa
-- ============================================================================

-- Eliminar tablas en orden correcto (por dependencias)
DROP TABLE IF EXISTS historial_rotaciones CASCADE;
DROP TABLE IF EXISTS secretos_sistema CASCADE;

-- Eliminar tipos enumerados si existen
DROP TYPE IF EXISTS tipo_secreto CASCADE;

-- Limpiar secuencias huérfanas
DROP SEQUENCE IF EXISTS secretos_sistema_secreto_id_seq CASCADE;
DROP SEQUENCE IF EXISTS historial_rotaciones_rotacion_id_seq CASCADE;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Schema db_secrets reseteado correctamente';
END $$;
