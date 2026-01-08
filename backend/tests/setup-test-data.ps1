# ============================================================================
# JUEZ SEGURO - Script para configurar datos de prueba HU-JZ-001
# ============================================================================

Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  CONFIGURACIÓN DE DATOS DE PRUEBA - HU-JZ-001                    ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Configuración de conexión
$PGHOST = "localhost"
$PGPORT = "5432"
$PGUSER = "admin_usuarios"
$PGPASSWORD = "secure_admin_pass"

Write-Host "📋 PASO 1: Obtener IDs de funcionarios jueces" -ForegroundColor Yellow
Write-Host ""

# Query para obtener jueces activos
$query_jueces = @"
SELECT 
  funcionario_id,
  nombres || ' ' || apellidos as nombre_completo,
  correo_institucional,
  materia,
  unidad_judicial
FROM funcionarios
WHERE rol = 'JUEZ'
  AND estado = 'ACTIVO'
ORDER BY funcionario_id
LIMIT 10;
"@

Write-Host "Ejecutando query en db_usuarios..." -ForegroundColor Gray
Write-Host "psql -h $PGHOST -p $PGPORT -U $PGUSER -d db_usuarios -c `"$query_jueces`"" -ForegroundColor DarkGray
Write-Host ""
Write-Host "⚠️  INSTRUCCIÓN:" -ForegroundColor Yellow
Write-Host "1. Ejecuta el comando de arriba manualmente" -ForegroundColor White
Write-Host "2. Copia los funcionario_id de DOS jueces diferentes" -ForegroundColor White
Write-Host "3. Anótalos aquí:" -ForegroundColor White
Write-Host ""

# Solicitar IDs al usuario
$JUEZ1_ID = Read-Host "   Ingresa funcionario_id del JUEZ 1"
$JUEZ2_ID = Read-Host "   Ingresa funcionario_id del JUEZ 2"

if ([string]::IsNullOrWhiteSpace($JUEZ1_ID) -or [string]::IsNullOrWhiteSpace($JUEZ2_ID)) {
    Write-Host ""
    Write-Host "❌ Error: Debes ingresar ambos IDs" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ IDs configurados:" -ForegroundColor Green
Write-Host "   Juez 1: $JUEZ1_ID" -ForegroundColor White
Write-Host "   Juez 2: $JUEZ2_ID" -ForegroundColor White
Write-Host ""

Write-Host "📋 PASO 2: Crear causas de prueba en db_casos" -ForegroundColor Yellow
Write-Host ""

# Crear script SQL dinámico
$sql_crear_causas = @"
DO `$`$
DECLARE
  v_causa1_id INTEGER;
  v_causa2_id INTEGER;
  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_codigo_unidad VARCHAR := '17355';
BEGIN
  -- Crear causa para Juez 1
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
    $JUEZ1_ID,
    'JUEZ-' || LPAD('$JUEZ1_ID', 4, '0'),
    'UNIDAD JUDICIAL CIVIL - QUITO',
    'Causa de prueba - Control de Acceso JUEZ 1'
  )
  RETURNING causa_id INTO v_causa1_id;
  
  -- Crear causa para Juez 2
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
    $JUEZ2_ID,
    'JUEZ-' || LPAD('$JUEZ2_ID', 4, '0'),
    'UNIDAD JUDICIAL PENAL - QUITO',
    'Causa de prueba - Control de Acceso JUEZ 2'
  )
  RETURNING causa_id INTO v_causa2_id;
  
  -- Partes procesales causa 1
  INSERT INTO partes_procesales (causa_id, tipo_parte, nombres_completos, numero_identificacion, pseudonimo)
  VALUES 
  (v_causa1_id, 'ACTOR', 'Juan Test Pérez', '1712345678', 'ACTOR-' || v_causa1_id || '-001'),
  (v_causa1_id, 'DEMANDADO', 'María Test López', '1723456789', 'DEMANDADO-' || v_causa1_id || '-001');
  
  -- Partes procesales causa 2
  INSERT INTO partes_procesales (causa_id, tipo_parte, nombres_completos, numero_identificacion, pseudonimo)
  VALUES 
  (v_causa2_id, 'ACTOR', 'Carlos Test Ramírez', '1734567890', 'ACTOR-' || v_causa2_id || '-001'),
  (v_causa2_id, 'DEMANDADO', 'Ana Test Martínez', '1745678901', 'DEMANDADO-' || v_causa2_id || '-001');
  
  -- Expedientes
  INSERT INTO expedientes (causa_id, descripcion)
  VALUES 
  (v_causa1_id, 'Expediente de prueba - Juez 1'),
  (v_causa2_id, 'Expediente de prueba - Juez 2');
  
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'CAUSAS DE PRUEBA CREADAS';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'Causa Juez 1 (ID=%): Asignada a funcionario %', v_causa1_id, $JUEZ1_ID;
  RAISE NOTICE 'Causa Juez 2 (ID=%): Asignada a funcionario %', v_causa2_id, $JUEZ2_ID;
  RAISE NOTICE '';
  RAISE NOTICE 'ACTUALIZA EN test-hu-jz-001-security.ts:';
  RAISE NOTICE 'TEST_DATA.causa_juez1 = %;', v_causa1_id;
  RAISE NOTICE 'TEST_DATA.causa_juez2 = %;', v_causa2_id;
END `$`$;

-- Verificar causas creadas
SELECT 
  causa_id,
  numero_proceso,
  juez_asignado_id,
  materia,
  estado_procesal
FROM causas
WHERE descripcion_pseudonimizada LIKE '%Control de Acceso%'
ORDER BY causa_id DESC;
"@

# Guardar SQL en archivo temporal
$tempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
$sql_crear_causas | Out-File -FilePath $tempSqlFile -Encoding UTF8

Write-Host "Ejecutando creación de causas..." -ForegroundColor Gray
Write-Host ""

# Ejecutar SQL
$env:PGPASSWORD = "secure_casos_pass"
psql -h $PGHOST -p $PGPORT -U admin_casos -d db_casos -f $tempSqlFile

# Limpiar archivo temporal
Remove-Item $tempSqlFile

Write-Host ""
Write-Host "✅ Script completado" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PASO 3: Actualizar script de pruebas" -ForegroundColor Yellow
Write-Host "Copia los IDs de las causas creadas (mostrados arriba) y actualiza:" -ForegroundColor White
Write-Host "   TEST_DATA.causa_juez1 = <ID_CAUSA_1>" -ForegroundColor White
Write-Host "   TEST_DATA.causa_juez2 = <ID_CAUSA_2>" -ForegroundColor White
Write-Host ""
