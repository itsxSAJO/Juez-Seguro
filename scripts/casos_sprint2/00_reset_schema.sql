-- ============================================================================
-- JUEZ SEGURO - Sprint 2: Limpieza del esquema (SOLO DESARROLLO)
-- ============================================================================
-- ADVERTENCIA: Este script elimina TODAS las tablas y datos
-- NO EJECUTAR EN PRODUCCIÓN
-- ============================================================================

-- Eliminar triggers
DROP TRIGGER IF EXISTS trg_documento_versionado ON documentos;

-- Eliminar funciones
DROP FUNCTION IF EXISTS fn_registrar_version_documento();
DROP FUNCTION IF EXISTS fn_verificar_integridad_documento(VARCHAR, CHAR);

-- Eliminar tablas en orden inverso de dependencias
DROP TABLE IF EXISTS documentos_accesos CASCADE;
DROP TABLE IF EXISTS documentos_versiones CASCADE;
DROP TABLE IF EXISTS audiencias_asistentes CASCADE;
DROP TABLE IF EXISTS audiencias CASCADE;
DROP TABLE IF EXISTS documentos CASCADE;
DROP TABLE IF EXISTS expedientes CASCADE;
DROP TABLE IF EXISTS causas CASCADE;
DROP TABLE IF EXISTS mapa_pseudonimos CASCADE;

-- Verificación
DO $$
BEGIN
    RAISE NOTICE '=== ESQUEMA LIMPIADO ===';
    RAISE NOTICE 'Base de datos lista para recreación';
END $$;
