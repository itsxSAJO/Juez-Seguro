-- ============================================================================
-- JUEZ SEGURO - Sprint 2: Actualización de Documentos con Integridad Reforzada
-- HU-SJ-002: Gestión de Documentos del Expediente
-- ============================================================================
-- Common Criteria: FDP_IFC.1 (Subset information flow control)
-- Propósito: Garantizar integridad, trazabilidad y no repudio de documentos
-- ============================================================================

-- ============================================================================
-- PASO 1: Mejorar tabla existente de documentos
-- ============================================================================

-- Renombrar campos para mayor claridad semántica
ALTER TABLE documentos 
    RENAME COLUMN hash_integridad TO hash_sha256;

ALTER TABLE documentos 
    RENAME COLUMN ruta TO ruta_almacenamiento;

ALTER TABLE documentos 
    RENAME COLUMN nombre TO nombre_archivo_original;

ALTER TABLE documentos
    RENAME COLUMN subido_por_id TO subido_por_secretario_id;

-- ============================================================================
-- PASO 2: Agregar columnas críticas de seguridad
-- ============================================================================

-- Campo para identificar quién presenta el documento (parte procesal o funcionario)
ALTER TABLE documentos 
    ADD COLUMN IF NOT EXISTS parte_presentante VARCHAR(200);

-- Cambiar tipo de documento a enum más específico
ALTER TABLE documentos 
    ADD CONSTRAINT chk_tipo_documento 
    CHECK (tipo IN ('ESCRITO', 'PROVIDENCIA', 'SENTENCIA', 'OTRO', 'demanda', 'providencia'));

-- Hacer obligatorios los campos críticos de integridad
ALTER TABLE documentos 
    ALTER COLUMN hash_sha256 SET NOT NULL;

ALTER TABLE documentos 
    ALTER COLUMN ruta_almacenamiento SET NOT NULL;

ALTER TABLE documentos 
    ALTER COLUMN tamanio_bytes SET NOT NULL;

ALTER TABLE documentos 
    ALTER COLUMN mime_type SET NOT NULL;

ALTER TABLE documentos 
    ALTER COLUMN subido_por_secretario_id SET NOT NULL;

-- Agregar whitelist de tipos MIME permitidos
ALTER TABLE documentos 
    ADD CONSTRAINT chk_mime_type 
    CHECK (mime_type IN ('application/pdf'));

-- ============================================================================
-- PASO 3: Tabla de versiones de documentos (histórico inmutable)
-- Para cumplir con no repudio y trazabilidad completa
-- ============================================================================

CREATE TABLE IF NOT EXISTS documentos_versiones (
    version_id SERIAL PRIMARY KEY,
    documento_id VARCHAR(50) NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    
    -- Snapshot del documento en este momento
    hash_sha256 CHAR(64) NOT NULL,
    ruta_almacenamiento VARCHAR(500) NOT NULL,
    tamanio_bytes BIGINT NOT NULL,
    
    -- Metadatos de la versión
    version_numero INTEGER NOT NULL,
    motivo_cambio VARCHAR(500), -- Por qué se reemplazó (ej: "Corrección de errores")
    fecha_version TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Quién realizó el cambio
    modificado_por_secretario_id INTEGER NOT NULL,
    
    -- Auditoría de integridad
    UNIQUE (documento_id, version_numero)
);

CREATE INDEX IF NOT EXISTS idx_doc_versiones_documento ON documentos_versiones(documento_id);
CREATE INDEX IF NOT EXISTS idx_doc_versiones_fecha ON documentos_versiones(fecha_version);

COMMENT ON TABLE documentos_versiones IS 'Histórico inmutable de versiones de documentos (FDP_IFC.1)';
COMMENT ON COLUMN documentos_versiones.hash_sha256 IS 'Hash SHA-256 de esta versión del documento';
COMMENT ON COLUMN documentos_versiones.version_numero IS 'Número secuencial de versión (1, 2, 3...)';

-- ============================================================================
-- PASO 4: Tabla de accesos a documentos (auditoría de lectura)
-- Para cumplir con FAU_GEN.1 (Audit data generation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS documentos_accesos (
    acceso_id SERIAL PRIMARY KEY,
    documento_id VARCHAR(50) NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    
    -- Quién accedió
    usuario_id INTEGER NOT NULL,
    rol_usuario VARCHAR(50) NOT NULL,
    
    -- Cuándo y desde dónde
    fecha_acceso TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ip_address VARCHAR(45), -- IPv4 o IPv6
    
    -- Tipo de acceso
    tipo_acceso VARCHAR(30) NOT NULL CHECK (tipo_acceso IN ('LECTURA', 'DESCARGA', 'VISUALIZACION')),
    
    -- Resultado
    exitoso BOOLEAN DEFAULT TRUE,
    motivo_rechazo VARCHAR(255) -- Si exitoso=false, razón del rechazo
);

CREATE INDEX IF NOT EXISTS idx_doc_accesos_documento ON documentos_accesos(documento_id);
CREATE INDEX IF NOT EXISTS idx_doc_accesos_usuario ON documentos_accesos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_doc_accesos_fecha ON documentos_accesos(fecha_acceso);

COMMENT ON TABLE documentos_accesos IS 'Registro de auditoría de accesos a documentos (FAU_GEN.1)';

-- ============================================================================
-- PASO 5: Trigger para crear versión automáticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_registrar_version_documento()
RETURNS TRIGGER AS $$
DECLARE
    v_ultima_version INTEGER;
BEGIN
    -- Obtener el último número de versión
    SELECT COALESCE(MAX(version_numero), 0) INTO v_ultima_version
    FROM documentos_versiones
    WHERE documento_id = NEW.id;
    
    -- Solo registrar si cambió el hash (cambió el archivo)
    IF OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256 THEN
        INSERT INTO documentos_versiones (
            documento_id,
            hash_sha256,
            ruta_almacenamiento,
            tamanio_bytes,
            version_numero,
            motivo_cambio,
            modificado_por_secretario_id
        ) VALUES (
            NEW.id,
            NEW.hash_sha256,
            NEW.ruta_almacenamiento,
            NEW.tamanio_bytes,
            v_ultima_version + 1,
            'Actualización de documento',
            NEW.subido_por_secretario_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_documento_versionado ON documentos;
CREATE TRIGGER trg_documento_versionado
    AFTER UPDATE ON documentos
    FOR EACH ROW
    WHEN (OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256)
    EXECUTE FUNCTION fn_registrar_version_documento();

-- ============================================================================
-- PASO 6: Función para verificar integridad de documento
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_verificar_integridad_documento(
    p_documento_id VARCHAR(50),
    p_hash_calculado CHAR(64)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_hash_almacenado CHAR(64);
    v_resultado BOOLEAN;
BEGIN
    -- Obtener hash almacenado
    SELECT hash_sha256 INTO v_hash_almacenado
    FROM documentos
    WHERE id = p_documento_id;
    
    -- Comparar
    v_resultado := (v_hash_almacenado = p_hash_calculado);
    
    -- Registrar verificación en logs (esto se conectaría con db_logs)
    RAISE NOTICE 'Verificación de integridad documento %: %', 
                 p_documento_id, 
                 CASE WHEN v_resultado THEN 'OK' ELSE 'FALLÓ' END;
    
    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASO 7: Actualizar comentarios y documentación
-- ============================================================================

COMMENT ON TABLE documentos IS 'Metadatos de documentos con integridad reforzada mediante SHA-256 (Sprint 2)';
COMMENT ON COLUMN documentos.hash_sha256 IS 'Hash SHA-256 del archivo - CRÍTICO para integridad (FDP_IFC.1)';
COMMENT ON COLUMN documentos.ruta_almacenamiento IS 'Ruta en volumen seguro /app/storage/expedientes_seguros';
COMMENT ON COLUMN documentos.parte_presentante IS 'Identificación de quién presenta el documento';
COMMENT ON COLUMN documentos.subido_por_secretario_id IS 'ID del secretario que cargó el documento';

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
    v_columnas_criticas TEXT[];
    v_columna TEXT;
    v_existe BOOLEAN;
BEGIN
    v_columnas_criticas := ARRAY['hash_sha256', 'ruta_almacenamiento', 'tamanio_bytes', 
                                  'mime_type', 'subido_por_secretario_id', 'parte_presentante'];
    
    RAISE NOTICE '=== VERIFICACIÓN DE ESTRUCTURA DE DOCUMENTOS ===';
    
    FOREACH v_columna IN ARRAY v_columnas_criticas
    LOOP
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'documentos' 
            AND column_name = v_columna
        ) INTO v_existe;
        
        RAISE NOTICE 'Columna %: %', v_columna, CASE WHEN v_existe THEN '✓ OK' ELSE '✗ FALTA' END;
    END LOOP;
    
    -- Verificar tablas nuevas
    RAISE NOTICE 'Tabla documentos_versiones: %', 
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documentos_versiones')
        THEN '✓ OK' ELSE '✗ FALTA' END;
        
    RAISE NOTICE 'Tabla documentos_accesos: %', 
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documentos_accesos')
        THEN '✓ OK' ELSE '✗ FALTA' END;
    
    RAISE NOTICE '=== VERIFICACIÓN COMPLETADA ===';
END $$;
