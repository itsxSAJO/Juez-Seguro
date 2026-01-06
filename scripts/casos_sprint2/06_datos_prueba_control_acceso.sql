-- ============================================================================
-- JUEZ SEGURO - Datos de Prueba para HU-JZ-001 Control de Acceso
-- Script para crear causas con diferentes jueces asignados
-- ============================================================================

\c db_casos;

-- ============================================================================
-- 1. OBTENER IDS DE FUNCIONARIOS
-- ============================================================================

-- Verificar funcionarios existentes en db_usuarios
-- (Debes ejecutar esto en db_usuarios primero)
/*
\c db_usuarios;

SELECT 
  funcionario_id,
  nombres || ' ' || apellidos as nombre_completo,
  correo_institucional,
  rol,
  materia,
  unidad_judicial
FROM funcionarios
WHERE rol = 'JUEZ'
  AND estado = 'ACTIVO'
ORDER BY funcionario_id
LIMIT 10;
*/

-- ============================================================================
-- 2. ACTUALIZAR CAUSAS EXISTENTES (Si ya existen)
-- ============================================================================

-- OPCIÓN A: Actualizar causa existente para que tenga juez diferente
-- Cambiar el juez_asignado_id de la causa ID=8 si existe

/*
-- Primero verificar qué causas existen
SELECT causa_id, numero_proceso, juez_asignado_id, juez_pseudonimo, estado_procesal
FROM causas
ORDER BY causa_id DESC
LIMIT 5;

-- Si existe una causa con ID=8, podemos dividirla:
-- Crear una copia de la causa pero con diferente juez
-- (Esto es solo para pruebas, NO hacer en producción)
*/

-- ============================================================================
-- 3. INSERTAR CAUSAS DE PRUEBA CON DIFERENTES JUECES
-- ============================================================================

-- IMPORTANTE: Reemplazar <JUEZ1_ID> y <JUEZ2_ID> con IDs reales de tu base de datos
-- Ejemplo: Si tienes funcionarios con ID 23 y 27, usa esos valores

DO $$
DECLARE
  v_juez1_id INTEGER;
  v_juez2_id INTEGER;
  v_causa1_id INTEGER;
  v_causa2_id INTEGER;
  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_codigo_unidad VARCHAR := '17355'; -- Pichincha - Quito
BEGIN
  -- PASO 1: Obtener IDs de dos jueces diferentes
  -- Intentar obtener funcionarios de db_usuarios
  
  -- Crear conexión a db_usuarios (via dblink o consulta manual previa)
  -- Por ahora, asumimos que los IDs se pasarán manualmente
  
  -- CONFIGURAR AQUÍ LOS IDS DE LOS JUECES (obtenidos de db_usuarios)
  -- Damaris Suquillo: ID 7
  -- Said Luna: ID 6
  v_juez1_id := 7;  -- ← Damaris Suquillo
  v_juez2_id := 6;  -- ← Said Luna
  
  RAISE NOTICE 'Juez 1 ID: %', v_juez1_id;
  RAISE NOTICE 'Juez 2 ID: %', v_juez2_id;
  
  -- PASO 2: Crear causa para Juez 1
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
    'CIVIL',
    'ORDINARIO',
    'EN_TRAMITE',
    CURRENT_DATE,
    v_juez1_id,
    'JUEZ-' || LPAD(v_juez1_id::TEXT, 4, '0'),
    'UNIDAD JUDICIAL CIVIL - QUITO',
    'Causa de prueba asignada al Juez 1'
  )
  RETURNING causa_id INTO v_causa1_id;
  
  RAISE NOTICE 'Causa 1 creada: ID=%', v_causa1_id;
  
  -- PASO 3: Crear causa para Juez 2
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
    v_juez2_id,
    'JUEZ-' || LPAD(v_juez2_id::TEXT, 4, '0'),
    'UNIDAD JUDICIAL PENAL - QUITO',
    'Causa de prueba asignada al Juez 2'
  )
  RETURNING causa_id INTO v_causa2_id;
  
  RAISE NOTICE 'Causa 2 creada: ID=%', v_causa2_id;
  
  -- PASO 4: Crear partes procesales para ambas causas
  
  -- Partes de causa 1
  INSERT INTO partes_procesales (
    causa_id,
    tipo_parte,
    nombres_completos,
    numero_identificacion,
    correo_electronico,
    telefono,
    es_persona_juridica,
    pseudonimo
  ) VALUES 
  (v_causa1_id, 'ACTOR', 'Juan Pérez García', '1712345678', 'juan.perez@email.com', '0987654321', false, 'ACTOR-' || v_causa1_id || '-001'),
  (v_causa1_id, 'DEMANDADO', 'María López Silva', '1723456789', 'maria.lopez@email.com', '0976543210', false, 'DEMANDADO-' || v_causa1_id || '-001');
  
  -- Partes de causa 2
  INSERT INTO partes_procesales (
    causa_id,
    tipo_parte,
    nombres_completos,
    numero_identificacion,
    correo_electronico,
    telefono,
    es_persona_juridica,
    pseudonimo
  ) VALUES 
  (v_causa2_id, 'ACTOR', 'Carlos Ramírez Torres', '1734567890', 'carlos.ramirez@email.com', '0965432109', false, 'ACTOR-' || v_causa2_id || '-001'),
  (v_causa2_id, 'DEMANDADO', 'Ana Martínez Ruiz', '1745678901', 'ana.martinez@email.com', '0954321098', false, 'DEMANDADO-' || v_causa2_id || '-001');
  
  -- PASO 5: Crear expedientes para ambas causas
  INSERT INTO expedientes (causa_id, descripcion)
  VALUES 
  (v_causa1_id, 'Expediente de causa de prueba - Juez 1'),
  (v_causa2_id, 'Expediente de causa de prueba - Juez 2');
  
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'CAUSAS DE PRUEBA CREADAS EXITOSAMENTE';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'Causa Juez 1: ID=%, Juez=%', v_causa1_id, v_juez1_id;
  RAISE NOTICE 'Causa Juez 2: ID=%, Juez=%', v_causa2_id, v_juez2_id;
  RAISE NOTICE '';
  RAISE NOTICE 'ACTUALIZA EN EL SCRIPT DE PRUEBAS:';
  RAISE NOTICE 'TEST_DATA.causa_juez1 = %', v_causa1_id;
  RAISE NOTICE 'TEST_DATA.causa_juez2 = %', v_causa2_id;
  RAISE NOTICE '===================================================';
  
END $$;

-- ============================================================================
-- 4. VERIFICACIÓN DE DATOS CREADOS
-- ============================================================================

-- Ver causas con sus jueces asignados
SELECT 
  c.causa_id,
  c.numero_proceso,
  c.juez_asignado_id,
  c.juez_pseudonimo,
  c.materia,
  c.estado_procesal,
  c.unidad_judicial
FROM causas c
ORDER BY c.causa_id DESC
LIMIT 5;

-- Ver partes procesales
SELECT 
  pp.parte_id,
  pp.causa_id,
  pp.tipo_parte,
  pp.nombres_completos,
  pp.pseudonimo
FROM partes_procesales pp
WHERE pp.causa_id IN (SELECT causa_id FROM causas ORDER BY causa_id DESC LIMIT 2)
ORDER BY pp.causa_id, pp.tipo_parte;

-- ============================================================================
-- 5. SCRIPT ALTERNATIVO: Obtener IDs de funcionarios de db_usuarios
-- ============================================================================

/*
-- EJECUTAR ESTE QUERY EN db_usuarios PRIMERO:

\c db_usuarios;

SELECT 
  f.funcionario_id,
  f.nombres || ' ' || f.apellidos as nombre_completo,
  f.correo_institucional,
  f.rol,
  f.materia,
  f.unidad_judicial,
  f.estado
FROM funcionarios f
WHERE f.rol = 'JUEZ'
  AND f.estado = 'ACTIVO'
ORDER BY f.funcionario_id
LIMIT 10;

-- Copia los IDs de dos jueces diferentes y reemplázalos en este script
-- en las líneas:
-- v_juez1_id := 23;  -- ← AQUÍ
-- v_juez2_id := 27;  -- ← AQUÍ

-- Luego ejecuta este script en db_casos
*/

-- ============================================================================
-- 6. LIMPIEZA (Opcional - Solo para desarrollo)
-- ============================================================================

/*
-- Para eliminar las causas de prueba creadas:

DELETE FROM partes_procesales 
WHERE causa_id IN (
  SELECT causa_id FROM causas 
  WHERE descripcion_pseudonimizada LIKE '%Causa de prueba%'
);

DELETE FROM expedientes 
WHERE causa_id IN (
  SELECT causa_id FROM causas 
  WHERE descripcion_pseudonimizada LIKE '%Causa de prueba%'
);

DELETE FROM causas 
WHERE descripcion_pseudonimizada LIKE '%Causa de prueba%';
*/
