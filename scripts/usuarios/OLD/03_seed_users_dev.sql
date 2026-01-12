-- ============================================================================
-- JUEZ SEGURO - Usuarios de Prueba (Desarrollo)
-- ============================================================================
-- ⚠️  DEPRECADO: Este archivo ha sido reemplazado por un script TypeScript
--     que genera los hashes dinámicamente para evitar CWE-798.
--
--     Usar en su lugar:
--       cd backend
--       npm run db:seed-users-dev
--
--     O directamente:
--       npx tsx backend/scripts/seed-users-dev.ts
--
--     El nuevo script:
--     - Valida que NODE_ENV=development
--     - Lee contraseñas desde variables de entorno
--     - Genera hashes bcrypt en runtime
--     - Nunca expone hashes en código fuente
-- ============================================================================
-- ADVERTENCIA: Este archivo es SOLO para desarrollo y testing.
-- NO usar en producción.
-- ============================================================================
-- Contraseñas según Common Criteria:
-- - Mínimo 16 caracteres
-- - Mayúsculas, minúsculas, números y símbolos especiales
-- - Sin palabras completas de diccionario
-- ============================================================================

-- ============================================================================
-- USUARIOS DE PRUEBA (Referencia - usar script TypeScript)
-- ============================================================================
-- | Rol        | Usuario                              | Password Env Var       |
-- |------------|--------------------------------------|------------------------|
-- | ADMIN_CJ   | admin.cj@judicatura.gob.ec           | DEV_ADMIN_PASSWORD     |
-- | JUEZ       | juez.gutierrez@judicatura.gob.ec     | DEV_JUEZ_PASSWORD      |
-- | SECRETARIO | secretario.paredes@judicatura.gob.ec | DEV_SECRETARIO_PASSWORD|
-- ============================================================================

-- Este archivo se mantiene como documentación.
-- Los hashes han sido eliminados por seguridad (CWE-798).

DO $$
BEGIN
    RAISE NOTICE '⚠️ Este script SQL está deprecado.';
    RAISE NOTICE 'Usar: npm run db:seed-users-dev (desde backend/)';
    RAISE EXCEPTION 'Script deprecado - usar TypeScript version';
END $$;
