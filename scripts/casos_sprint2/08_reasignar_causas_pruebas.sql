-- ============================================================================
-- Reasignar causas entre Said (ID 6) y Emily Luna (ID 8)
-- ============================================================================

\c db_casos;

-- Asignar las causas 1, 2, 3, 4 a Emily Luna (ID 8)
UPDATE causas
SET 
  juez_asignado_id = 8,
  juez_pseudonimo = 'JUEZ-0008'
WHERE causa_id IN (1, 2, 3, 4);

-- Dejar las causas 5, 6, 7, 8 a Said (ID 6)
UPDATE causas
SET 
  juez_asignado_id = 6,
  juez_pseudonimo = 'JUEZ-0006'
WHERE causa_id IN (5, 6, 7, 8);

-- Verificar la distribución
SELECT 
  juez_asignado_id,
  COUNT(*) as total_causas,
  STRING_AGG(causa_id::TEXT, ', ') as ids_causas
FROM causas
GROUP BY juez_asignado_id
ORDER BY juez_asignado_id;

-- Ver detalle de causas por juez
SELECT 
  causa_id,
  numero_proceso,
  juez_asignado_id,
  CASE 
    WHEN juez_asignado_id = 6 THEN 'Said Luna'
    WHEN juez_asignado_id = 7 THEN 'Damaris Suquillo'
    ELSE 'Otro'
  END as juez_nombre,
  materia,
  estado_procesal
FROM causas
WHERE juez_asignado_id IN (6, 7)
ORDER BY juez_asignado_id, causa_id;

-- Mostrar IDs para actualizar en el script de pruebas
DO $$
BEGIN
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'CAUSAS REASIGNADAS CORRECTAMENTE';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'Damaris (Juez ID 7): Causas 1, 2, 3, 4';
  RAISE NOTICE 'Said (Juez ID 6): Causas 5, 6, 7, 8';
  RAISE NOTICE '';
  RAISE NOTICE 'ACTUALIZA EN test-hu-jz-001-security.ts:';
  RAISE NOTICE 'const TEST_DATA = {';
  RAISE NOTICE '  causa_juez1: 1,  // Damaris';
  RAISE NOTICE '  causa_juez2: 5,  // Said';
  RAISE NOTICE '  ...';
  RAISE NOTICE '};';
  RAISE NOTICE '===================================================';
END $$;
