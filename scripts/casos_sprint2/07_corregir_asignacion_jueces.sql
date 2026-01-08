-- ============================================================================
-- DIAGNÓSTICO Y CORRECCIÓN: Causas sin Juez Asignado Correctamente
-- ============================================================================

\c db_casos;

-- ============================================================================
-- 1. DIAGNÓSTICO: Ver estado actual de causas
-- ============================================================================

-- Ver todas las causas y sus jueces asignados
SELECT 
  causa_id,
  numero_proceso,
  juez_asignado_id,
  juez_pseudonimo,
  materia,
  unidad_judicial,
  estado_procesal,
  fecha_creacion
FROM causas
ORDER BY fecha_creacion DESC
LIMIT 20;

-- Contar causas por juez
SELECT 
  juez_asignado_id,
  COUNT(*) as cantidad_causas,
  STRING_AGG(DISTINCT materia, ', ') as materias
FROM causas
GROUP BY juez_asignado_id
ORDER BY cantidad_causas DESC;

-- Causas sin juez asignado (NULL)
SELECT COUNT(*) as causas_sin_juez
FROM causas
WHERE juez_asignado_id IS NULL;

-- ============================================================================
-- 2. CORRECCIÓN: Asignar jueces correctamente a causas existentes
-- ============================================================================

-- OPCIÓN A: Asignar causas específicas a cada juez (RECOMENDADO)

-- Asignar las primeras 5 causas al Juez 7 (Damaris)
UPDATE causas
SET 
  juez_asignado_id = 7,
  juez_pseudonimo = 'JUEZ-0007'
WHERE causa_id IN (
  SELECT causa_id 
  FROM causas 
  WHERE materia IN ('CIVIL', 'LABORAL', 'FAMILIA')  -- Ajustar según corresponda
  ORDER BY fecha_creacion ASC
  LIMIT 5
);

-- Asignar otras 5 causas al Juez 6 (Said)
UPDATE causas
SET 
  juez_asignado_id = 6,
  juez_pseudonimo = 'JUEZ-0006'
WHERE causa_id IN (
  SELECT causa_id 
  FROM causas 
  WHERE juez_asignado_id != 7  -- Causas que no fueron asignadas al juez 7
    AND materia IN ('PENAL', 'TRANSITO', 'CONTENCIOSO')  -- Ajustar según corresponda
  ORDER BY fecha_creacion ASC
  LIMIT 5
);

-- ============================================================================
-- 3. CORRECCIÓN ALTERNATIVA: Distribución equitativa automática
-- ============================================================================

-- Crear función para distribuir causas equitativamente
CREATE OR REPLACE FUNCTION distribuir_causas_equitativamente()
RETURNS void AS $$
DECLARE
  v_causa RECORD;
  v_juez_id INTEGER;
  v_contador INTEGER := 0;
BEGIN
  -- Obtener todas las causas sin juez asignado o con asignación incorrecta
  FOR v_causa IN 
    SELECT causa_id 
    FROM causas 
    ORDER BY fecha_creacion ASC
  LOOP
    -- Alternar entre juez 6 y 7
    IF v_contador % 2 = 0 THEN
      v_juez_id := 7;  -- Damaris
    ELSE
      v_juez_id := 6;  -- Said
    END IF;
    
    UPDATE causas
    SET 
      juez_asignado_id = v_juez_id,
      juez_pseudonimo = 'JUEZ-' || LPAD(v_juez_id::TEXT, 4, '0')
    WHERE causa_id = v_causa.causa_id;
    
    v_contador := v_contador + 1;
  END LOOP;
  
  RAISE NOTICE 'Causas distribuidas: %', v_contador;
  RAISE NOTICE 'Juez 6 (Said): % causas', v_contador / 2;
  RAISE NOTICE 'Juez 7 (Damaris): % causas', v_contador / 2;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la distribución
-- SELECT distribuir_causas_equitativamente();

-- ============================================================================
-- 4. CORRECCIÓN ESPECÍFICA: Asignar causas a jueces según ID
-- ============================================================================

-- Asignar causa ID 8 al Juez 7 (Damaris)
UPDATE causas
SET 
  juez_asignado_id = 7,
  juez_pseudonimo = 'JUEZ-0007'
WHERE causa_id = 8;

-- Crear nueva causa para Juez 6 (Said)
DO $$
DECLARE
  v_causa_id INTEGER;
  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_codigo_unidad VARCHAR := '17355';
BEGIN
  INSERT INTO causas (
    numero_proceso,
    materia,
    tipo_proceso,
    estado_procesal,
    fecha_inicio,
    juez_asignado_id,
    juez_pseudonimo,
    unidad_judicial,
    descripcion_pseudonimizada
  ) VALUES (
    v_codigo_unidad || '-' || v_ano || '-' || LPAD(NEXTVAL('causas_secuencia')::TEXT, 5, '0'),
    'PENAL',
    'ORDINARIO',
    'EN_TRAMITE',
    CURRENT_DATE,
    6,  -- Said Luna
    'JUEZ-0006',
    'UNIDAD JUDICIAL PENAL - QUITO',
    'Causa de prueba asignada a Said Luna'
  )
  RETURNING causa_id INTO v_causa_id;
  
  -- Crear partes procesales
  INSERT INTO partes_procesales (
    causa_id,
    tipo_parte,
    nombres_completos,
    numero_identificacion,
    pseudonimo
  ) VALUES 
  (v_causa_id, 'ACTOR', 'Fiscal General del Estado', '1760001000001', 'FISCAL-' || v_causa_id || '-001'),
  (v_causa_id, 'DEMANDADO', 'Procesado Test Apellido', '1778889999', 'PROCESADO-' || v_causa_id || '-001');
  
  -- Crear expediente
  INSERT INTO expedientes (causa_id, descripcion)
  VALUES (v_causa_id, 'Expediente de causa de prueba - Said Luna');
  
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'NUEVA CAUSA CREADA PARA SAID LUNA';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'Causa ID: %', v_causa_id;
  RAISE NOTICE 'Juez asignado: 6 (Said Luna)';
  RAISE NOTICE '';
  RAISE NOTICE 'ACTUALIZA EN test-hu-jz-001-security.ts:';
  RAISE NOTICE 'TEST_DATA.causa_juez1 = 8;  // Damaris';
  RAISE NOTICE 'TEST_DATA.causa_juez2 = %;  // Said', v_causa_id;
  RAISE NOTICE '===================================================';
END $$;

-- ============================================================================
-- 5. VERIFICACIÓN FINAL
-- ============================================================================

-- Ver distribución de causas después de la corrección
SELECT 
  juez_asignado_id,
  COUNT(*) as total_causas,
  STRING_AGG(causa_id::TEXT, ', ') as ids_causas
FROM causas
WHERE juez_asignado_id IN (6, 7)
GROUP BY juez_asignado_id
ORDER BY juez_asignado_id;

-- Ver causas específicas de cada juez
SELECT 
  causa_id,
  numero_proceso,
  juez_asignado_id,
  materia,
  estado_procesal
FROM causas
WHERE juez_asignado_id IN (6, 7)
ORDER BY juez_asignado_id, causa_id;

-- Verificar que no haya causas sin juez
SELECT COUNT(*) as causas_sin_asignar
FROM causas
WHERE juez_asignado_id IS NULL;

-- ============================================================================
-- 6. LIMPIEZA (Opcional)
-- ============================================================================

-- Para eliminar causas de prueba creadas
/*
DELETE FROM partes_procesales 
WHERE causa_id IN (
  SELECT causa_id FROM causas 
  WHERE descripcion_pseudonimizada LIKE '%prueba%'
);

DELETE FROM expedientes 
WHERE causa_id IN (
  SELECT causa_id FROM causas 
  WHERE descripcion_pseudonimizada LIKE '%prueba%'
);

DELETE FROM causas 
WHERE descripcion_pseudonimizada LIKE '%prueba%';
*/
