-- ============================================================================
-- JUEZ SEGURO - Pseudónimos de Prueba (Desarrollo)
-- ============================================================================
-- ADVERTENCIA: Este archivo es SOLO para desarrollo y testing.
-- NO usar en producción. Los pseudónimos deben generarse con HMAC-SHA256.
-- ============================================================================

-- Pseudónimo para la jueza de prueba (funcionario_id = 2 en db_usuarios)
INSERT INTO mapa_pseudonimos (juez_id_real, pseudonimo_publico)
VALUES (2, 'JUEZ-A7F3E1B2')
ON CONFLICT (juez_id_real) DO NOTHING;

-- Verificación
DO $$
DECLARE
    pseudo_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pseudo_count FROM mapa_pseudonimos;
    RAISE NOTICE 'Pseudónimos de prueba insertados. Total: %', pseudo_count;
END $$;
